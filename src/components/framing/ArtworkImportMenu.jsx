import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Cloud, HardDrive, ImageUp, Link2, Loader2 } from 'lucide-react';
import {
    ARTWORK_IMPORT_SOURCES,
    importArtworkFromCloud,
    importArtworkFromDevice,
    importArtworkFromUrl,
} from '../../services/artworkImport';

const CLOUD_ICONS = { drive: HardDrive, dropbox: Cloud };

export default function ArtworkImportMenu({ isPlaceholder, isUploading, onFile, disabled }) {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState('sources');
    const [url, setUrl] = useState('');
    const [pendingSource, setPendingSource] = useState('');
    const [error, setError] = useState('');
    const rootRef = useRef(null);
    const urlInputRef = useRef(null);
    const busy = Boolean(isUploading || disabled || pendingSource);

    const reset = useCallback(() => {
        setView('sources');
        setUrl('');
        setPendingSource('');
        setError('');
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        reset();
    }, [reset]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const handlePointerDown = (event) => {
            if (rootRef.current && !rootRef.current.contains(event.target)) close();
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') close();
        };
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [close, isOpen]);

    useEffect(() => {
        if (view === 'url') requestAnimationFrame(() => urlInputRef.current?.focus());
    }, [view]);

    const finishImport = (artwork) => {
        onFile(artwork.file);
        close();
    };

    const handleDeviceFile = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) {
            close();
            return;
        }
        setError('');
        try {
            finishImport(await importArtworkFromDevice(file));
        } catch (importError) {
            setError(importError.message);
        }
    };

    const handleCloudImport = async (provider) => {
        setPendingSource(provider);
        setError('');
        try {
            finishImport(await importArtworkFromCloud(provider));
        } catch (importError) {
            if (importError.message === 'No image was selected.') {
                close();
                return;
            }
            setError(importError.message || 'Could not import that image.');
            setPendingSource('');
        }
    };

    const handleUrlImport = async (event) => {
        event.preventDefault();
        if (!url.trim() || pendingSource) return;
        setPendingSource('url');
        setError('');
        try {
            finishImport(await importArtworkFromUrl(url));
        } catch (importError) {
            setError(importError.message || 'Could not load that image.');
            setPendingSource('');
        }
    };

    const tileClass = `relative w-full border-2 border-dashed ${
        isPlaceholder ? 'border-stone-300 hover:border-stone-400' : 'border-stone-950 bg-stone-50/50'
    } rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-colors h-[72px] text-center disabled:cursor-default disabled:opacity-100`;

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => {
                    if (busy) return;
                    setIsOpen((open) => {
                        if (open) reset();
                        return !open;
                    });
                }}
                disabled={busy}
                className={tileClass}
                aria-haspopup="menu"
                aria-expanded={isOpen}
            >
                {isUploading ? (
                    <Loader2 size={16} className="animate-spin text-stone-600" />
                ) : (
                    <>
                        <ImageUp size={16} className={isPlaceholder ? 'text-stone-500' : 'text-stone-950'} />
                        <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-700 truncate w-full">
                            {isPlaceholder ? 'Upload Image' : 'Replace Image'}
                        </span>
                    </>
                )}
            </button>

            {isOpen && (
                <div className="absolute z-20 top-full left-0 mt-1.5 w-64 bg-white border border-stone-200 rounded-lg shadow-lg overflow-hidden">
                    {view === 'sources' ? (
                        <div role="menu" className="py-1">
                            <FileSourceRow onChange={handleDeviceFile} />
                            {Object.entries(ARTWORK_IMPORT_SOURCES).map(([key, source]) => {
                                if (!source.available) return null;
                                const Icon = CLOUD_ICONS[key];
                                return (
                                    <SourceRow
                                        key={key}
                                        icon={Icon}
                                        label={source.label}
                                        loading={pendingSource === key}
                                        disabled={Boolean(pendingSource)}
                                        onClick={() => handleCloudImport(key)}
                                    />
                                );
                            })}
                            <SourceRow icon={Link2} label="Paste image link" onClick={() => { setView('url'); setError(''); }} />
                            {error && <p role="alert" className="px-3 py-2 text-[11px] text-red-600 border-t border-stone-100">{error}</p>}
                        </div>
                    ) : (
                        <form onSubmit={handleUrlImport} className="p-2.5">
                            <div className="flex items-center gap-1.5 mb-2">
                                <button
                                    type="button"
                                    onClick={() => { setView('sources'); setError(''); }}
                                    className="w-6 h-6 flex items-center justify-center text-stone-400 hover:text-stone-700"
                                    aria-label="Back to image sources"
                                >
                                    <ArrowLeft size={14} />
                                </button>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">Paste image link</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <input
                                    ref={urlInputRef}
                                    type="url"
                                    inputMode="url"
                                    value={url}
                                    onChange={(event) => setUrl(event.target.value)}
                                    placeholder="https://example.com/image.jpg"
                                    disabled={pendingSource === 'url'}
                                    aria-label="Image URL"
                                    className="flex-1 min-w-0 border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-stone-500 disabled:opacity-60"
                                />
                                <button
                                    type="submit"
                                    disabled={pendingSource === 'url' || !url.trim()}
                                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-stone-900 text-white disabled:opacity-40 hover:bg-stone-800 transition-colors"
                                    aria-label="Import image from link"
                                >
                                    {pendingSource === 'url' ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
                                </button>
                            </div>
                            {error && <p role="alert" className="mt-1.5 text-[11px] text-red-600">{error}</p>}
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}

function SourceRow({ icon, label, onClick, loading = false, disabled = false }) {
    const Icon = icon;
    return (
        <button
            type="button"
            role="menuitem"
            onClick={onClick}
            disabled={disabled}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-stone-700 hover:bg-stone-50 transition-colors text-left disabled:opacity-50"
        >
            {loading ? <Loader2 size={14} className="animate-spin text-stone-500 shrink-0" /> : <Icon size={14} className="text-stone-400 shrink-0" />}
            {loading ? `Opening ${label}...` : label}
        </button>
    );
}

function FileSourceRow({ onChange }) {
    return (
        <label role="menuitem" className="flex items-center gap-2.5 px-3 py-2.5 text-xs text-stone-700 hover:bg-stone-50 cursor-pointer">
            <ImageUp size={14} className="text-stone-400 shrink-0" />
            Device
            <input type="file" className="hidden" accept="image/*" onChange={onChange} />
        </label>
    );
}
