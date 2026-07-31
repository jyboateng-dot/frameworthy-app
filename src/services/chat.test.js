import { describe, it, expect, vi, beforeEach } from 'vitest';

// chat.js talks to Firestore through the modular SDK — mock just the calls
// it makes, keyed by a fake in-memory "thread doc" so triggerAiResponse's
// runTransaction(threadRef) sees whatever state a test sets up. This mock
// doesn't model real concurrent contention (there's no actual parallelism
// in a single-threaded test) — that atomicity guarantee is Firestore's own
// backend property, not something a unit test can exercise. What IS tested
// here is that the claim logic itself (skip when isAiTyping/aiEnabled say
// so, claim otherwise) is correct — a real race just means two callers
// evaluate that same correct logic at slightly different times, and
// Firestore's transaction retry ensures only one sees a not-yet-claimed slot.
let threadState;

vi.mock('../services/firebase', () => ({ db: {}, functions: {} }));
vi.mock('./aiAgent', () => ({
    generateAiResponse: vi.fn().mockResolvedValue('AI reply'),
    isHumanHandoffRequested: vi.fn().mockReturnValue(false),
}));
// notifyAdminViaEmail now calls the notifyAdminOfChatMessage Cloud Function
// instead of sending via emailjs directly — mock httpsCallable to return a
// stub so sendMessage's fire-and-forget notification call doesn't throw.
const notifyAdminOfChatMessageMock = vi.fn().mockResolvedValue({ data: { sent: true } });
vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => notifyAdminOfChatMessageMock),
}));
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => ({})),
    doc: vi.fn(() => ({})),
    addDoc: vi.fn().mockResolvedValue({}),
    setDoc: vi.fn((_ref, data) => {
        threadState = { ...threadState, ...data };
        return Promise.resolve();
    }),
    runTransaction: vi.fn((_db, updateFn) => {
        const tx = {
            get: vi.fn(() => Promise.resolve({
                exists: () => !!threadState,
                data: () => threadState,
            })),
            set: vi.fn((_ref, data) => {
                threadState = { ...threadState, ...data };
            }),
        };
        return Promise.resolve(updateFn(tx));
    }),
    onSnapshot: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(() => 'server-timestamp'),
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    limit: vi.fn(),
}));

const { addDoc } = await import('firebase/firestore');
const { sendMessage, requestHumanSupport } = await import('./chat');

describe('chat.js — admin email notification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        threadState = undefined;
    });

    it('calls notifyAdminOfChatMessage with the message text on a customer send', async () => {
        await sendMessage('uid1', 'do you deliver to Tema?', 'customer');
        expect(notifyAdminOfChatMessageMock).toHaveBeenCalledWith({ text: 'do you deliver to Tema?', isHandoff: false });
        // sendMessage's own triggerAiResponse call is also fire-and-forget —
        // wait it out so its delayed addDoc doesn't leak into a later test.
        await new Promise((r) => setTimeout(r, 850));
    });

    it('calls it with isHandoff: true on an explicit human-support request', async () => {
        await requestHumanSupport('uid1');
        expect(notifyAdminOfChatMessageMock).toHaveBeenCalledWith({
            text: 'Customer requested human support directly in chat.',
            isHandoff: true,
        });
    });

    it('does not throw if the notification call fails — it is fire-and-forget best effort', async () => {
        notifyAdminOfChatMessageMock.mockRejectedValueOnce(new Error('network down'));
        await expect(sendMessage('uid1', 'hi', 'customer')).resolves.toBeUndefined();
        await new Promise((r) => setTimeout(r, 850));
    });
});

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

    it('does not respond a second time while a response is already in flight (isAiTyping claimed)', async () => {
        // Simulates the moment right after a first message already claimed
        // the slot — a second concurrent trigger must see isAiTyping: true
        // and back off rather than also proceeding.
        threadState = { isAiTyping: true };

        await sendMessage('uid1', 'second message while AI is still typing', 'customer');
        await new Promise((r) => setTimeout(r, 850));

        const assistantPosts = addDoc.mock.calls.filter(([, data]) => data?.senderRole === 'assistant');
        expect(assistantPosts).toHaveLength(0);
    });
});
