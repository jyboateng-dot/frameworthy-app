import React from 'react';
import { logClientError } from '../services/errorLogging';

class ErrorBoundary extends React.Component {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        logClientError({
            message: error.message,
            stack: error.stack,
            componentStack: info.componentStack,
            type: 'react-error-boundary',
        });
    }

    render() {
        if (this.state.hasError) {
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
