import React from 'react';
import { logClientError } from '../services/errorLogging';

// Route pages are code-split and fetched on demand by filename (see App.jsx's
// lazy() imports). Every deploy changes those filenames. A tab that's been
// open since before the latest deploy — very common on mobile, where tabs
// stay backgrounded for days — still has the *old* filenames baked into its
// already-loaded page, so the first navigation to a not-yet-visited route
// (sign-in is a common one, being off the happy path) tries to fetch a chunk
// that no longer exists on the server. Firebase Hosting's SPA rewrite then
// serves index.html for that missing path instead of a 404, and the
// browser's module loader throws one of these — wording differs by engine
// (Safari/iOS gives the MIME-type message, Chromium gives "Failed to fetch").
// None of this is a real app bug, so instead of the dead-end "Something went
// wrong" screen, auto-reload once — that fetches the current index.html and
// its correct chunk filenames, and the navigation the user was making just
// works on the retry.
const CHUNK_LOAD_ERROR_PATTERNS = [
    /failed to fetch dynamically imported module/i,
    /is not a valid javascript mime type/i,
    /importing a module script failed/i,
    /error loading dynamically imported module/i,
];

function isChunkLoadError(message) {
    return CHUNK_LOAD_ERROR_PATTERNS.some((re) => re.test(message || ''));
}

// Guards against a reload loop if the reload itself doesn't fix it (e.g.
// genuinely offline) — at most one auto-reload per attempt. Cleared a few
// seconds after a successful mount (see main.jsx) so a *later*, unrelated
// chunk failure later in the same tab session still gets its own retry
// instead of being permanently blocked by this run's flag.
const RELOAD_GUARD_KEY = 'fw_chunk_reload_attempted';

class ErrorBoundary extends React.Component {
    state = { hasError: false, isReloadingForNewVersion: false };

    static getDerivedStateFromError(error) {
        return { hasError: true, isReloadingForNewVersion: isChunkLoadError(error?.message) };
    }

    componentDidCatch(error, info) {
        logClientError({
            message: error.message,
            stack: error.stack,
            componentStack: info.componentStack,
            type: 'react-error-boundary',
        });

        if (isChunkLoadError(error?.message)) {
            let alreadyAttempted = true;
            try {
                alreadyAttempted = sessionStorage.getItem(RELOAD_GUARD_KEY) === '1';
                if (!alreadyAttempted) sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
            } catch {
                // Private browsing / storage disabled — fall through and
                // still attempt the one reload; just can't guard against a
                // loop, which is an acceptable trade over never recovering.
                alreadyAttempted = false;
            }
            if (!alreadyAttempted) {
                window.location.reload();
            }
        }
    }

    render() {
        if (this.state.hasError) {
            if (this.state.isReloadingForNewVersion) {
                return (
                    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-[#faf9f8]">
                        <p className="text-sm text-stone-500">Updating to the latest version…</p>
                    </div>
                );
            }
            return (
                <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-[#faf9f8]">
                    <p className="text-sm text-stone-500">Something went wrong. Please reload the page.</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2.5 rounded-full bg-[#0a0a0a] text-white text-sm font-bold hover:bg-stone-800 transition"
                    >
                        Reload
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
