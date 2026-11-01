import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Cloud, HardDrive, ImagePlus, ImageUp, Link2, Loader2, X } from 'lucide-react';
import {
    ARTWORK_IMPORT_SOURCES,
    importArtworkFromCloud,
    importArtworkFromDevice,
    importArtworkFromUrl,
    preloadArtworkCloudPickers,
} from '../../services/artworkImport';
import { getThumbnailUrl } from '../../services/storage';

export default function CustomizerImageUpload({
    isPlaceholder,
    isUploading,
    uploadedImage,
    onFile,
    onBrowseMuseumArt,
}) {
    const [isDragging, setIsDragging] = useState(false);
    const [pendingSource, setPendingSource] = useState('');
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);
    const urlInputRef = useRef(null);

    const busy = Boolean(isUploading || pendingSource);

    useEffect(() => {
        preloadArtworkCloudPickers();
    }, []);

    useEffect(() => {
        if (showUrlInput) {
            requestAnimationFrame(() => urlInputRef.current?.focus());
        }
    }, [showUrlInput]);

    const handleDeviceFile = async (file) => {
        if (!file) return;
        setError('');
        try {
            const normalized = await importArtworkFromDevice(file);
            onFile(normalized.file);
            setShowUrlInput(false);
            setUrl('');
        } catch (err) {
            setError(err?.message || 'Please select a valid image file.');
        }
    };

    const handleInputChange = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        await handleDeviceFile(file);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (busy) return;
        const file = e.dataTransfer?.files?.[0];
        await handleDeviceFile(file);
    };

    const handleCloudImport = async (provider) => {
        if (busy) return;
        const providerName = provider === 'drive' ? 'Google Drive' : 'Dropbox';
        setError('');

        if (!ARTWORK_IMPORT_SOURCES[provider]?.available) {
            setError(`${providerName} is not available right now.`);
            return;
        }

        setPendingSource(provider);
        try {
            const normalized = await importArtworkFromCloud(provider);
            if (normalized?.file) {
                onFile(normalized.file);
                setShowUrlInput(false);
                setUrl('');
            }
        } catch (err) {
            if (err?.message !== 'No image was selected.') {
                setError(err?.message || `Could not import from ${providerName}.`);
            }
        } finally {
            setPendingSource('');
        }
    };

    const handleUrlSubmit = async (e) => {
        e.preventDefault();
        const trimmed = url.trim();
        if (!trimmed || busy) return;
        setPendingSource('url');
        setError('');
        try {
            const normalized = await importArtworkFromUrl(trimmed);
            if (normalized?.file) {
                onFile(normalized.file);
                setShowUrlInput(false);
                setUrl('');
            }
        } catch (err) {
            setError(err?.message || 'Could not load that image link.');
        } finally {
            setPendingSource('');
        }
    };

    return (
        <div className="space-y-2">
            {/* Primary 2-Column Action Row: 1-Click Device Upload + Museum Art */}
            <div className="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => !busy && fileInputRef.current?.click()}
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!busy) setIsDragging(true);
                    }}
                    onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragging(false);
                    }}
                    onDrop={handleDrop}
                    disabled={busy}
                    className={`relative w-full h-[72px] rounded-xl p-3 flex flex-col items-center justify-center transition-colors text-center disabled:opacity-60 ${
                        isDragging
                            ? 'border-2 border-dashed border-[#c9a84c] bg-[#faf6ea]'
                            : isPlaceholder
                                ? 'border-2 border-dashed border-stone-300 hover:border-stone-400 hover:bg-stone-50/70'
                                : 'border border-stone-900 bg-stone-50/60 hover:bg-stone-100/70'
                    }`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleInputChange}
                        className="hidden"
                        aria-label="Upload photo from device"
                    />
                    {isUploading || pendingSource === 'device' ? (
                        <>
                            <Loader2 size={16} className="text-stone-600 animate-spin" />
                            <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-700 truncate w-full">
                                Uploading…
                            </span>
                        </>
                    ) : !isPlaceholder && uploadedImage ? (
                        <div className="flex items-center gap-2.5 w-full justify-center">
                            <div
                                className="w-8 h-8 rounded-lg bg-cover bg-center border border-stone-200 shadow-inner shrink-0"
                                style={{ backgroundImage: `url(${getThumbnailUrl(uploadedImage, 80)})` }}
                            />
                            <div className="text-left min-w-0">
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-900 truncate">
                                    Replace Image
                                </span>
                                <span className="block text-[10px] text-stone-500 truncate">
                                    From device
                                </span>
                            </div>
                        </div>
                    ) : (
                        <>
                            <ImageUp size={16} className="text-stone-500" />
                            <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-700 truncate w-full">
                                Upload Image
                            </span>
                        </>
                    )}
                </button>

                <button
                    type="button"
                    onClick={onBrowseMuseumArt}
                    className="border border-stone-200 rounded-xl p-3 flex flex-col items-center justify-center hover:bg-stone-50 hover:border-stone-400 transition-colors h-[72px] text-center"
                >
                    <ImagePlus size={16} className="text-stone-500" />
                    <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-700 truncate w-full">
                        Museum Art
                    </span>
                </button>
            </div>

            {/* Secondary 1-Click Cloud & Link Pills */}
            <div className="grid grid-cols-3 gap-1.5">
                {ARTWORK_IMPORT_SOURCES.drive?.available && (
                    <button
                        type="button"
                        onClick={() => handleCloudImport('drive')}
                        disabled={busy}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-stone-200/90 bg-stone-50/60 hover:bg-stone-100 hover:border-stone-300 text-[11px] font-medium text-stone-600 hover:text-stone-900 transition-colors disabled:opacity-50"
                    >
                        {pendingSource === 'drive' ? (
                            <Loader2 size={12} className="animate-spin text-stone-500 shrink-0" />
                        ) : (
                            <HardDrive size={12} className="text-stone-400 shrink-0" />
                        )}
                        <span className="truncate">Google Drive</span>
                    </button>
                )}

                {ARTWORK_IMPORT_SOURCES.dropbox?.available && (
                    <button
                        type="button"
                        onClick={() => handleCloudImport('dropbox')}
                        disabled={busy}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-stone-200/90 bg-stone-50/60 hover:bg-stone-100 hover:border-stone-300 text-[11px] font-medium text-stone-600 hover:text-stone-900 transition-colors disabled:opacity-50"
                    >
                        {pendingSource === 'dropbox' ? (
                            <Loader2 size={12} className="animate-spin text-stone-500 shrink-0" />
                        ) : (
                            <Cloud size={12} className="text-stone-400 shrink-0" />
                        )}
                        <span className="truncate">Dropbox</span>
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => {
                        setShowUrlInput((prev) => !prev);
                        setError('');
                    }}
                    disabled={busy}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-colors disabled:opacity-50 ${
                        showUrlInput
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-200/90 bg-stone-50/60 hover:bg-stone-100 hover:border-stone-300 text-stone-600 hover:text-stone-900'
                    }`}
                >
                    <Link2 size={12} className={`shrink-0 ${showUrlInput ? 'text-white' : 'text-stone-400'}`} />
                    <span className="truncate">Paste Link</span>
                </button>
            </div>

            {/* Inline URL Input */}
            {showUrlInput && (
                <form onSubmit={handleUrlSubmit} className="flex items-center gap-1.5 pt-0.5">
                    <input
                        ref={urlInputRef}
                        type="url"
                        inputMode="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com/photo.jpg"
                        disabled={pendingSource === 'url'}
                        aria-label="Image URL"
                        className="flex-1 min-w-0 border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-500 disabled:opacity-60"
                    />
                    <button
                        type="submit"
                        disabled={pendingSource === 'url' || !url.trim()}
                        className="shrink-0 h-7 px-2.5 flex items-center justify-center gap-1 rounded-lg bg-stone-900 text-white text-[11px] font-semibold disabled:opacity-40 hover:bg-stone-800 transition-colors"
                        aria-label="Import image from link"
                    >
                        {pendingSource === 'url' ? <Loader2 size={12} className="animate-spin" /> : <>Import <ArrowRight size={12} /></>}
                    </button>
                </form>
            )}

            {/* Inline Error */}
            {error && (
                <div role="alert" className="flex items-start justify-between gap-2 rounded-lg bg-red-50 border border-red-200 px-2.5 py-1.5 text-[11px] text-red-700">
                    <span className="flex-1">{error}</span>
                    <button
                        type="button"
                        onClick={() => setError('')}
                        className="text-red-400 hover:text-red-700 shrink-0 mt-0.5"
                        aria-label="Dismiss error"
                    >
                        <X size={12} />
                    </button>
                </div>
            )}
        </div>
    );
}
