import { describe, it, expect, vi } from 'vitest';

vi.mock('./firebase', () => ({ functions: {} }));
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn(() => vi.fn()) }));

const { isHumanHandoffRequested } = await import('./aiAgent');

describe('isHumanHandoffRequested', () => {
    it('matches genuine human-handoff requests', () => {
        expect(isHumanHandoffRequested('can I speak to a human?')).toBe(true);
        expect(isHumanHandoffRequested('I want a real person')).toBe(true);
        expect(isHumanHandoffRequested('let me talk to a representative')).toBe(true);
        expect(isHumanHandoffRequested('can the manager call me')).toBe(true);
        expect(isHumanHandoffRequested('is the owner around?')).toBe(true);
    });

    it('does not false-positive on words that merely contain a keyword as a substring', () => {
        expect(isHumanHandoffRequested('can this be personalized?')).toBe(false);
        expect(isHumanHandoffRequested('what is my personal delivery estimate')).toBe(false);
        expect(isHumanHandoffRequested('is the homeowner responsible for signing?')).toBe(false);
        expect(isHumanHandoffRequested('do you support agentic workflows')).toBe(false);
    });

    it('is case-insensitive', () => {
        expect(isHumanHandoffRequested('I NEED TO SPEAK TO A HUMAN')).toBe(true);
    });

    it('returns false for empty or unrelated messages', () => {
        expect(isHumanHandoffRequested('')).toBe(false);
        expect(isHumanHandoffRequested(undefined)).toBe(false);
        expect(isHumanHandoffRequested('what sizes do you offer?')).toBe(false);
    });
});
