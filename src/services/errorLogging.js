import { Capacitor } from '@capacitor/core';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

// Caps how many errors one session will ever report, and dedupes repeats of
// the same error — without this, a tight error loop (e.g. a broken render
// that retries every frame) would flood Firestore with thousands of writes.
const MAX_ERRORS_PER_SESSION = 20;
const seenSignatures = new Set();
let sentCount = 0;

export async function logClientError({ message, stack, type, componentStack }) {
    try {
        if (sentCount >= MAX_ERRORS_PER_SESSION) return;
        const signature = `${type}:${message}`.slice(0, 200);
        if (seenSignatures.has(signature)) return;
        seenSignatures.add(signature);
        sentCount++;

        await addDoc(collection(db, 'clientErrors'), {
            message: String(message || '').slice(0, 1000),
            stack: stack ? String(stack).slice(0, 4000) : null,
            componentStack: componentStack ? String(componentStack).slice(0, 4000) : null,
            type,
            url: window.location.href,
            userAgent: navigator.userAgent,
            platform: Capacitor.getPlatform(), // 'web' | 'ios' | 'android'
            userId: auth.currentUser?.uid || 'guest',
            createdAt: serverTimestamp(),
        });
    } catch {
        // Never let error logging itself throw — that would just produce
        // more errors to log, potentially looping.
    }
}

export function initErrorLogging() {
    window.addEventListener('error', (event) => {
        logClientError({
            message: event.message,
            stack: event.error?.stack,
            type: 'error',
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        logClientError({
            message: reason?.message || String(reason),
            stack: reason?.stack,
            type: 'unhandledrejection',
        });
    });
}
