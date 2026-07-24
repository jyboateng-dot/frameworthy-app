// Customer <-> Admin chat service — Firestore-backed, real-time.
//
// One thread per customer at chats/{uid} (their Firebase Auth uid), with an
// immutable messages subcollection. The thread doc carries denormalized
// lastMessage/unreadBy* fields so both the admin inbox list and the
// customer's collapsed-bubble badge can subscribe to one cheap query
// instead of fanning out into every subcollection.
import { db } from './firebase';
import { collection, doc, addDoc, setDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';

export const sendMessage = async (uid, text, senderRole, userMeta = {}) => {
    await addDoc(collection(db, 'chats', uid, 'messages'), {
        text,
        senderRole,
        senderId: senderRole === 'admin' ? 'admin' : uid,
        createdAt: serverTimestamp(),
    });

    const threadRef = doc(db, 'chats', uid);
    await setDoc(threadRef, {
        userId: uid,
        ...(senderRole === 'customer' ? {
            userEmail: userMeta.email || null,
            userDisplayName: userMeta.displayName || null,
        } : {}),
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
        unreadByAdmin: senderRole === 'customer',
        unreadByCustomer: senderRole === 'admin',
    }, { merge: true });
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
