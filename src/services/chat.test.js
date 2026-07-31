import { describe, it, expect, vi, beforeEach } from 'vitest';

// chat.js talks to Firestore through the modular SDK — mock just the calls
// it makes, keyed by a fake in-memory "thread doc" so triggerAiResponse's
// getDoc(threadRef) sees whatever state a test sets up.
let threadState;

vi.mock('../services/firebase', () => ({ db: {} }));
vi.mock('./aiAgent', () => ({
    generateAiResponse: vi.fn().mockResolvedValue('AI reply'),
    isHumanHandoffRequested: vi.fn().mockReturnValue(false),
}));
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => ({})),
    doc: vi.fn(() => ({})),
    addDoc: vi.fn().mockResolvedValue({}),
    setDoc: vi.fn((_ref, data) => {
        threadState = { ...threadState, ...data };
        return Promise.resolve();
    }),
    getDoc: vi.fn(() => Promise.resolve({
        exists: () => !!threadState,
        data: () => threadState,
    })),
    onSnapshot: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(() => 'server-timestamp'),
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    limit: vi.fn(),
}));

const { addDoc } = await import('firebase/firestore');
const { sendMessage } = await import('./chat');

describe('chat.js — AI takeover gating', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        threadState = undefined;
    });

    it('does not let the AI respond after an admin has replied (regression: humanRequested was wrongly required)', async () => {
        // sendMessage(..., 'admin') sets exactly this state on a real thread.
        threadState = { aiEnabled: false, humanRequested: false };

        await sendMessage('uid1', 'are you still there?', 'customer');
        // triggerAiResponse is fire-and-forget from sendMessage. Wait out its
        // full possible duration (not just one tick) even on the skip path —
        // otherwise, under a buggy condition that fails to skip, its ~800ms
        // delayed addDoc would fire later and bleed into a *different* test's
        // assertions instead of failing this one directly.
        await new Promise((r) => setTimeout(r, 850));

        const assistantPosts = addDoc.mock.calls.filter(([, data]) => data?.senderRole === 'assistant');
        expect(assistantPosts).toHaveLength(0);
    });

    it('does not let the AI respond after the explicit AI-off toggle (same aiEnabled:false, humanRequested:false shape)', async () => {
        threadState = { aiEnabled: false, humanRequested: false };

        await sendMessage('uid1', 'hello?', 'customer');
        await new Promise((r) => setTimeout(r, 850));

        const assistantPosts = addDoc.mock.calls.filter(([, data]) => data?.senderRole === 'assistant');
        expect(assistantPosts).toHaveLength(0);
    });

    it('still lets the AI respond on a fresh thread with no prior state', async () => {
        threadState = undefined;

        await sendMessage('uid1', 'hi, what sizes do you offer?', 'customer');
        await new Promise((r) => setTimeout(r, 850)); // triggerAiResponse has an ~800ms typing delay

        const assistantPosts = addDoc.mock.calls.filter(([, data]) => data?.senderRole === 'assistant');
        expect(assistantPosts).toHaveLength(1);
    });

    it('still lets the AI respond once re-enabled via the toggle (aiEnabled: true)', async () => {
        threadState = { aiEnabled: true, humanRequested: false };

        await sendMessage('uid1', 'one more question', 'customer');
        await new Promise((r) => setTimeout(r, 850));

        const assistantPosts = addDoc.mock.calls.filter(([, data]) => data?.senderRole === 'assistant');
        expect(assistantPosts).toHaveLength(1);
    });
});
