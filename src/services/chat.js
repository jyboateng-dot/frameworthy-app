// Customer <-> Admin <-> AI Assistant chat service — Firestore-backed, real-time.
import { db } from './firebase';
import { collection, doc, addDoc, setDoc, getDoc, onSnapshot, query, orderBy, serverTimestamp, getDocs, limit } from 'firebase/firestore';
import { generateAiResponse, isHumanHandoffRequested } from './aiAgent';

export const sendMessage = async (uid, text, senderRole, userMeta = {}) => {
    // 1. Add the message doc
    await addDoc(collection(db, 'chats', uid, 'messages'), {
        text,
        senderRole,
        senderId: senderRole === 'admin' ? 'admin' : (senderRole === 'assistant' ? 'ai-assistant' : uid),
        createdAt: serverTimestamp(),
    });

    // 2. Update thread summary doc
    const threadRef = doc(db, 'chats', uid);
    
    // If a human admin replies, automatically disable AI auto-reply on this thread for seamless human takeover
    const threadUpdate = {
        userId: uid,
        ...(senderRole === 'customer' ? {
            userEmail: userMeta.email || null,
            userDisplayName: userMeta.displayName || null,
        } : {}),
        ...(senderRole === 'admin' ? {
            aiEnabled: false, // Automatic Human Takeover
            humanRequested: false,
        } : {}),
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
        unreadByAdmin: senderRole === 'customer',
        unreadByCustomer: senderRole === 'admin' || senderRole === 'assistant',
    };

    await setDoc(threadRef, threadUpdate, { merge: true });

    // 3. Trigger AI Auto-Reply or Human Handoff if message is from a customer
    if (senderRole === 'customer') {
        triggerAiResponse(uid, text, userMeta).catch(err => {
            console.error('Error triggering AI response:', err);
        });
    }
};

/**
 * Trigger AI Response / Human Handoff Engine
 */
async function triggerAiResponse(uid, text, userMeta) {
    const threadRef = doc(db, 'chats', uid);
    const threadSnap = await getDoc(threadRef);
    const data = threadSnap.exists() ? threadSnap.data() : {};
    
    // Only pause AI if a human agent has explicitly been requested and takeover is active
    if (data.humanRequested === true && data.aiEnabled === false) {
        return;
    }

    // Mark AI as typing on thread
    await setDoc(threadRef, { isAiTyping: true, aiEnabled: true }, { merge: true });

    try {
        const userWantsHuman = isHumanHandoffRequested(text);
        let aiResponseText = '';

        if (userWantsHuman) {
            // Handoff message
            aiResponseText = "I've notified our studio support team! A human representative will take over this conversation shortly. You can also call us directly at 0261 549 517 / 0501 648 227 (Mon-Sat, 8am-6pm GMT).";
        } else {
            // Fetch recent messages for conversation context
            const q = query(collection(db, 'chats', uid, 'messages'), orderBy('createdAt', 'desc'), limit(8));
            const snap = await getDocs(q);
            const history = snap.docs.map(d => d.data()).reverse();
            aiResponseText = await generateAiResponse(text, history);
        }

        // Simulate natural typing delay (800ms)
        await new Promise(resolve => setTimeout(resolve, 800));

        // Clear typing indicator
        await setDoc(threadRef, { 
            isAiTyping: false,
            ...(userWantsHuman ? { aiEnabled: false, humanRequested: true } : {})
        }, { merge: true });

        // Post AI response
        await addDoc(collection(db, 'chats', uid, 'messages'), {
            text: aiResponseText,
            senderRole: 'assistant',
            senderId: 'ai-assistant',
            createdAt: serverTimestamp(),
        });

        await setDoc(threadRef, {
            lastMessage: aiResponseText,
            lastMessageAt: serverTimestamp(),
            unreadByCustomer: true,
        }, { merge: true });
    } catch (err) {
        console.error('AI Response generation error:', err);
        await setDoc(threadRef, { isAiTyping: false }, { merge: true });
    }
}

/**
 * Toggle AI Auto-Reply ON/OFF for a specific customer thread
 */
export const toggleAiAutoReply = async (uid, enabled) => {
    const threadRef = doc(db, 'chats', uid);
    await setDoc(threadRef, { aiEnabled: enabled, humanRequested: false }, { merge: true });
};

// Returns the unsubscribe function — callers must invoke it on cleanup.
export const subscribeToMessages = (uid, callback) => {
    const q = query(collection(db, 'chats', uid, 'messages'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
};

export const subscribeToThread = (uid, callback) => {
    const ref = doc(db, 'chats', uid);
    return onSnapshot(ref, (snap) => {
        callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
};

export const subscribeToAllThreads = (callback) => {
    const q = query(collection(db, 'chats'), orderBy('lastMessageAt', 'desc'));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
};

export const markThreadRead = async (uid, role) => {
    const ref = doc(db, 'chats', uid);
    await setDoc(ref, role === 'admin' ? { unreadByAdmin: false } : { unreadByCustomer: false }, { merge: true });
};
