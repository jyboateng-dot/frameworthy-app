// Customer <-> Admin <-> AI Assistant chat service — Firestore-backed, real-time.
import { db, functions } from './firebase';
import { collection, doc, addDoc, setDoc, onSnapshot, query, orderBy, serverTimestamp, getDocs, limit, runTransaction } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { generateAiResponse, isHumanHandoffRequested } from './aiAgent';

const notifyAdminOfChatMessage = httpsCallable(functions, 'notifyAdminOfChatMessage');

/**
 * Ask the notifyAdminOfChatMessage Cloud Function to email the admin about a
 * new message. The cooldown (1 per 2 minutes per user, bypassed for an
 * explicit human-handoff request) is enforced server-side now — this used to
 * be an in-memory Map here, which reset on every reload and was independent
 * per tab, and the send itself used to happen directly from the browser via
 * emailjs.send() with the public key, which meant a caller could skip this
 * throttle entirely by calling that API directly.
 */
export const notifyAdminViaEmail = async (text, isHandoff = false) => {
    try {
        await notifyAdminOfChatMessage({ text, isHandoff });
    } catch (err) {
        console.error('Failed to send admin notification email:', err);
    }
};

export const requestHumanSupport = async (uid) => {
    const threadRef = doc(db, 'chats', uid);
    await setDoc(threadRef, {
        aiEnabled: false,
        humanRequested: true,
        unreadByAdmin: true,
        lastMessage: "🚨 Customer requested human support",
        lastMessageAt: serverTimestamp(),
    }, { merge: true });

    await notifyAdminViaEmail("Customer requested human support directly in chat.", true);
};

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
        notifyAdminViaEmail(text).catch(err => console.error('Notification error:', err));
        triggerAiResponse(uid, text).catch(err => {
            console.error('Error triggering AI response:', err);
        });
    }
};

/**
 * Trigger AI Response / Human Handoff Engine
 */
async function triggerAiResponse(uid, text) {
    const threadRef = doc(db, 'chats', uid);

    // Atomically claim the "AI is responding" slot inside a transaction —
    // a plain read-then-write here (as this used to be) has a race: two
    // customer messages sent close together both read isAiTyping/aiEnabled
    // before either had written anything, so both would proceed, each
    // calling Gemini and posting its own reply (duplicate bot messages,
    // double the cost, replies answering only one of the two questions).
    // The transaction makes "check and claim" a single atomic step —
    // Firestore retries it under contention, so exactly one caller wins.
    let claimed;
    try {
        claimed = await runTransaction(db, async (tx) => {
            const snap = await tx.get(threadRef);
            const data = snap.exists() ? snap.data() : {};
            // Skip whenever the AI has been turned off for this thread, for
            // any reason — an admin's own reply, the explicit AI-off toggle,
            // or an automatic keyword-detected handoff all set
            // aiEnabled: false, and any of them should keep the AI silent.
            // Also skip if another concurrent call already claimed the slot.
            if (data.aiEnabled === false || data.isAiTyping === true) {
                return false;
            }
            tx.set(threadRef, { isAiTyping: true, aiEnabled: true }, { merge: true });
            return true;
        });
    } catch (err) {
        console.error('Failed to claim AI response slot:', err);
        return;
    }
    if (!claimed) return;

    try {
        const userWantsHuman = isHumanHandoffRequested(text);
        let aiResponseText = '';

        if (userWantsHuman) {
            // Handoff message
            aiResponseText = "I've notified our studio support team! A human representative will take over this conversation shortly. You can also call us directly at +44 7797 789598 (Mon-Sat, 8am-6pm GMT).";
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
