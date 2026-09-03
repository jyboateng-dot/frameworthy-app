import React, { useState } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { importFromGooglePhotos } from '../../utils/importFromGooglePhotos';

/**
 * The free, self-built Google Photos source — same story as
 * ImageUrlImportField: Uploadcare's own Google Photos source is paid-locked,
 * so this one was cheap enough to just build (Google Photos Picker API,
 * no server component needed). Hands back a File via `onFile`, same
 * contract as ImageUploadField/ImageUrlImportField.
 */
export default function GooglePhotosPickerField({ onFile, disabled }) {
    const [status, setStatus] = useState('idle'); // idle | loading | error
    const [error, setError] = useState('');

    const handleClick = async () => {
        if (status === 'loading') return;
        setStatus('loading');
        setError('');
        try {
            const file = await importFromGooglePhotos();
            onFile(file);
            setStatus('idle');
        } catch (err) {
            setStatus('error');
            setError(err.message || 'Couldn’t import from Google Photos.');
        }
    };

    return (
        <div className="mt-1.5">
            <button
                type="button"
                onClick={handleClick}
                disabled={disabled || status === 'loading'}
                className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
                {status === 'loading' ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
                {status === 'loading' ? 'Waiting for Google Photos…' : 'Or import from Google Photos'}
            </button>
            {status === 'error' && <p className="mt-1.5 text-[11px] text-red-600">{error}</p>}
        </div>
    );
}
