import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

vi.mock('../services/errorLogging', () => ({
    logClientError: vi.fn(),
}));

function Bomb({ message }) {
    throw new Error(message);
}

// React logs the caught error to the console; keep test output clean.
const consoleErrorSpy = () => vi.spyOn(console, 'error').mockImplementation(() => {});

// jsdom's window.location.reload isn't directly spy-able (redefining it
// throws) — swap the whole location object out for the duration of each
// test instead, same as the standard workaround for this in jsdom.
const originalLocation = window.location;
let reloadSpy;

describe('ErrorBoundary', () => {
    beforeEach(() => {
        sessionStorage.clear();
        reloadSpy = vi.fn();
        delete window.location;
        window.location = { ...originalLocation, reload: reloadSpy };
    });

    afterEach(() => {
        cleanup();
        window.location = originalLocation;
        vi.restoreAllMocks();
    });

    it('shows the generic fallback (with a manual Reload button) for a normal render error, without auto-reloading', () => {
        const errSpy = consoleErrorSpy();
        render(
            <ErrorBoundary>
                <Bomb message="Cannot read properties of undefined (reading 'foo')" />
            </ErrorBoundary>
        );

        expect(screen.getByText('Something went wrong. Please reload the page.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
        expect(reloadSpy).not.toHaveBeenCalled();
        errSpy.mockRestore();
    });

    it.each([
        "Failed to fetch dynamically imported module: https://frameworthyco.com/assets/AuthPage-abc123.js",
        "'text/html' is not a valid JavaScript MIME type.",
        'Importing a module script failed',
    ])('auto-reloads once and shows an "updating" message for a stale-chunk error: %s', (message) => {
        const errSpy = consoleErrorSpy();
        render(
            <ErrorBoundary>
                <Bomb message={message} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Updating to the latest version…')).toBeInTheDocument();
        expect(screen.queryByText('Something went wrong. Please reload the page.')).not.toBeInTheDocument();
        expect(reloadSpy).toHaveBeenCalledTimes(1);
        expect(sessionStorage.getItem('fw_chunk_reload_attempted')).toBe('1');
        errSpy.mockRestore();
    });

    it('does not auto-reload a second time within the same session (loop guard)', () => {
        sessionStorage.setItem('fw_chunk_reload_attempted', '1');
        const errSpy = consoleErrorSpy();

        render(
            <ErrorBoundary>
                <Bomb message="Failed to fetch dynamically imported module: https://frameworthyco.com/assets/CartPage-xyz.js" />
            </ErrorBoundary>
        );

        // Still recognized as a chunk error (shows the "updating" copy), but
        // the reload itself is skipped since one was already attempted.
        expect(screen.getByText('Updating to the latest version…')).toBeInTheDocument();
        expect(reloadSpy).not.toHaveBeenCalled();
        errSpy.mockRestore();
    });
});
