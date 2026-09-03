import React, { useRef, useState } from 'react';
import { Link2, X, Loader2, ArrowRight } from 'lucide-react';
import { importImageFromUrl } from '../../utils/importImageFromUrl';

/**
 * The free, self-built alternative to Uploadcare's paid "From link" source
 * (see ar-frame-asset-gap-style scoping in chat: this one source was cheap
 * enough to just build). Collapsed to a small text trigger by default so it
 * doesn't compete with the Upload/Inspiration tiles above it; expands to a
 * single input + submit on click. Hands back a File via `onFile`, same
 * contract as ImageUploadField, so the caller's existing pipeline
 * (applyImageFile: local preview + background ImageKit upload) is unchanged.
 */
export default function ImageUrlImportField({ onFile, disabled }) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState('');
    const [status, setStatus] = useState('idle'); // idle | loading | error
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    const reset = () => {
        setOpen(false);
        setValue('');
        setStatus('idle');
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (status === 'loading' || !value.trim()) return;
        setStatus('loading');
        setError('');
        try {
            const file = await importImageFromUrl(value);
            onFile(file);
            reset();
        } catch (err) {
            setStatus('error');
            setError(err.message || 'Couldn’t load that image.');
        }
    };

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => {
                    setOpen(true);
                    requestAnimationFrame(() => inputRef.current?.focus());
                }}
                disabled={disabled}
                className="mt-2 flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
                <Link2 size={12} />
                Or paste an image link
            </button>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="mt-2">
            <div className="flex items-center gap-1.5">
                <input
                    ref={inputRef}
                    type="url"
                    inputMode="url"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Paste an image link…"
                    disabled={status === 'loading'}
                    className="flex-1 min-w-0 border border-stone-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-stone-500 disabled:opacity-60"
                />
                <button
                    type="submit"
                    disabled={status === 'loading' || !value.trim()}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-stone-900 text-white disabled:opacity-40 hover:bg-stone-800 transition-colors"
                    aria-label="Import image"
                >
                    {status === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                </button>
                <button
                    type="button"
                    onClick={reset}
                    disabled={status === 'loading'}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors disabled:opacity-40"
                    aria-label="Cancel"
                >
                    <X size={14} />
                </button>
            </div>
            {status === 'error' && <p className="mt-1.5 text-[11px] text-red-600">{error}</p>}
        </form>
    );
}
