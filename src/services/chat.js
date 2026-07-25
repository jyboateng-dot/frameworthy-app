// Customer <-> Admin <-> AI Assistant chat service — Firestore-backed, real-time.
import { db } from './firebase';
import { collection, doc, addDoc, setDoc, getDoc, onSnapshot, query, orderBy, serverTimestamp, getDocs, limit } from 'firebase/firestore';
import { generateAiResponse, isHumanHandoffRequested } from './aiAgent';
import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_STUDIO_TEMPLATE_ID || import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

// Last email notification timestamp per user to avoid email spam (max 1 email per 2 minutes per user)
const emailCoolOffMap = new Map();

/**
 * Send an email notification to admin with a direct jump link to the specific chat thread.
 */
export const notifyAdminViaEmail = async (uid, text, userMeta = {}, isHandoff = false) => {
    const lastSent = emailCoolOffMap.get(uid) || 0;
    const now = Date.now();
    // Allow immediate send if it's an explicit handoff request, otherwise enforce 2-min cooloff
    if (!isHandoff && now - lastSent < 120000) return;
    
    emailCoolOffMap.set(uid, now);

    if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
        try {
            const origin = typeof window !== 'undefined' ? window.location.origin : 'https://frameworthyco-9c78c.web.app';
            const chatLink = `${origin}/admin/messages?chat=${uid}`;
            const userName = userMeta.displayName || 'Customer';
            const userEmail = userMeta.email || 'Anonymous/Guest Customer';

            await emailjs.send(
                EMAILJS_SERVICE_ID,
                EMAILJS_TEMPLATE_ID,
                {
                    to_email: 'admin@frameworthyco.com',
                    to_name: 'FrameWorthy Admin',
                    user_name: userName,
                    user_email: userEmail,
                    subject: isHandoff ? `🚨 URGENT: Human Assistance Requested by ${userName}` : `💬 New Customer Message from ${userName}`,
                    message: `Customer Message: "${text}"\n\nDirect Chat Link: ${chatLink}`,
                },
                EMAILJS_PUBLIC_KEY
            );
            console.log('Admin email notification sent successfully.');
        } catch (err) {
            console.error('Failed to send admin notification email:', err);
        }
    }
};

export const requestHumanSupport = async (uid, userMeta = {}) => {
    const threadRef = doc(db, 'chats', uid);
    await setDoc(threadRef, {
        aiEnabled: false,
        humanRequested: true,
        unreadByAdmin: true,
        lastMessage: "🚨 Customer requested human support",
        lastMessageAt: serverTimestamp(),
    }, { merge: true });

    await notifyAdminViaEmail(uid, "Customer requested human support directly in chat.", userMeta, true);
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
        notifyAdminViaEmail(uid, text, userMeta).catch(err => console.error('Notification error:', err));
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
