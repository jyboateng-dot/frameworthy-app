import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, Cloud, HardDrive, ImagePlus, ImageUp, Link2, Loader2 } from 'lucide-react';
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
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [menuView, setMenuView] = useState('sources');
    const [pendingSource, setPendingSource] = useState('');
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');
    const rootRef = useRef(null);
    const fileInputRef = useRef(null);
    const urlInputRef = useRef(null);

    const busy = Boolean(isUploading || pendingSource);

    const closeMenu = useCallback(() => {
        setIsMenuOpen(false);
        setMenuView('sources');
        setUrl('');
        setError('');
    }, []);

    useEffect(() => {
        if (!isMenuOpen) return undefined;
        preloadArtworkCloudPickers();
        const handlePointerDown = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                closeMenu();
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') closeMenu();
        };
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [closeMenu, isMenuOpen]);

    useEffect(() => {
        if (menuView === 'url') {
            requestAnimationFrame(() => urlInputRef.current?.focus());
        }
    }, [menuView]);

    const handleDeviceFile = async (file) => {
        if (!file) return;
        setError('');
        try {
            const normalized = await importArtworkFromDevice(file);
            onFile(normalized.file);
            closeMenu();
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
                closeMenu();
            }
        } catch (err) {
            if (err?.message === 'No image was selected.') {
                closeMenu();
            } else {
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
                closeMenu();
            }
        } catch (err) {
            setError(err?.message || 'Could not load that image link.');
        } finally {
            setPendingSource('');
        }
    };

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
                {/* Split Button Tile: Left triggers 1-Click Device Upload, Right Chevron opens Cloud/Link Menu */}
                <div
                    ref={rootRef}
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
                    className={`relative flex items-stretch h-[72px] rounded-xl transition-colors ${
                        isDragging
                            ? 'border-2 border-dashed border-[#c9a84c] bg-[#faf6ea]'
                            : isPlaceholder
                                ? 'border-2 border-dashed border-stone-300 hover:border-stone-400'
                                : 'border border-stone-900 bg-stone-50/60'
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

                    {/* Primary 1-Click Device Upload Action */}
                    <button
                        type="button"
                        onClick={() => !busy && fileInputRef.current?.click()}
                        disabled={busy}
                        className="flex-1 min-w-0 px-2.5 py-2 flex flex-col items-center justify-center hover:bg-stone-50/80 rounded-l-xl transition-colors text-center disabled:opacity-60"
                    >
                        {isUploading || pendingSource ? (
                            <>
                                <Loader2 size={16} className="text-stone-600 animate-spin" />
                                <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-700 truncate w-full">
                                    {pendingSource ? 'Importing…' : 'Uploading…'}
                                </span>
                            </>
                        ) : !isPlaceholder && uploadedImage ? (
                            <div className="flex items-center gap-2 w-full justify-center">
                                <div
                                    className="w-7 h-7 rounded-md bg-cover bg-center border border-stone-200 shadow-inner shrink-0"
                                    style={{ backgroundImage: `url(${getThumbnailUrl(uploadedImage, 80)})` }}
                                />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-900 truncate">
                                    Replace
                                </span>
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

                    {/* Split Divider + More Sources Trigger */}
                    <button
                        type="button"
                        onClick={() => {
                            if (busy) return;
                            setIsMenuOpen((prev) => {
                                if (prev) {
                                    setMenuView('sources');
                                    setError('');
                                }
                                return !prev;
                            });
                        }}
                        disabled={busy}
                        aria-label="More upload sources (Google Drive, Dropbox, Link)"
                        aria-haspopup="menu"
                        aria-expanded={isMenuOpen}
                        title="Import from Google Drive, Dropbox, or Link"
                        className={`w-8 shrink-0 border-l flex items-center justify-center rounded-r-xl transition-colors disabled:opacity-50 ${
                            isPlaceholder ? 'border-stone-200/90' : 'border-stone-200'
                        } ${isMenuOpen ? 'bg-stone-900 text-white' : 'hover:bg-stone-100 text-stone-500 hover:text-stone-900'}`}
                    >
                        <ChevronDown size={14} className={`transition-transform duration-150 ${isMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Split Button Dropdown Menu for Cloud & Link */}
                    {isMenuOpen && (
                        <div
                            role="menu"
                            className="absolute z-30 top-full left-0 mt-1.5 w-60 bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                        >
                            {menuView === 'sources' ? (
                                <div className="py-1">
                                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 border-b border-stone-100">
                                        Import from
                                    </div>
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            closeMenu();
                                            fileInputRef.current?.click();
                                        }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-stone-700 hover:bg-stone-50 transition-colors text-left"
                                    >
                                        <ImageUp size={14} className="text-stone-400 shrink-0" />
                                        Device files
                                    </button>
                                    {ARTWORK_IMPORT_SOURCES.drive?.available && (
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => handleCloudImport('drive')}
                                            disabled={busy}
                                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-stone-700 hover:bg-stone-50 transition-colors text-left disabled:opacity-50"
                                        >
                                            <HardDrive size={14} className="text-stone-400 shrink-0" />
                                            Google Drive
                                        </button>
                                    )}
                                    {ARTWORK_IMPORT_SOURCES.dropbox?.available && (
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => handleCloudImport('dropbox')}
                                            disabled={busy}
                                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-stone-700 hover:bg-stone-50 transition-colors text-left disabled:opacity-50"
                                        >
                                            <Cloud size={14} className="text-stone-400 shrink-0" />
                                            Dropbox
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            setMenuView('url');
                                            setError('');
                                        }}
                                        disabled={busy}
                                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-stone-700 hover:bg-stone-50 transition-colors text-left disabled:opacity-50"
                                    >
                                        <Link2 size={14} className="text-stone-400 shrink-0" />
                                        Paste image link
                                    </button>
                                    {error && (
                                        <p role="alert" className="px-3 py-2 text-[11px] text-red-600 border-t border-stone-100">
                                            {error}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <form onSubmit={handleUrlSubmit} className="p-2.5">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMenuView('sources');
                                                setError('');
                                            }}
                                            className="w-6 h-6 flex items-center justify-center text-stone-400 hover:text-stone-700"
                                            aria-label="Back to image sources"
                                        >
                                            <ArrowLeft size={14} />
                                        </button>
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">
                                            Paste image link
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            ref={urlInputRef}
                                            type="url"
                                            inputMode="url"
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            placeholder="https://example.com/photo.jpg"
                                            disabled={pendingSource === 'url'}
                                            aria-label="Image URL"
                                            className="flex-1 min-w-0 border border-stone-300 rounded-lg px-2.5 py-1.5 text-base sm:text-xs focus:outline-none focus:border-stone-500 disabled:opacity-60"
                                        />
                                        <button
                                            type="submit"
                                            disabled={pendingSource === 'url' || !url.trim()}
                                            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-stone-900 text-white disabled:opacity-40 hover:bg-stone-800 transition-colors"
                                            aria-label="Import image from link"
                                        >
                                            {pendingSource === 'url' ? (
                                                <Loader2 size={13} className="animate-spin" />
                                            ) : (
                                                <ArrowRight size={13} />
                                            )}
                                        </button>
                                    </div>
                                    {error && <p role="alert" className="mt-1.5 text-[11px] text-red-600">{error}</p>}
                                </form>
                            )}
                        </div>
                    )}
                </div>

                {/* Museum Art Tile */}
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

            {error && !isMenuOpen && (
                <p role="alert" className="text-[11px] text-red-600">
                    {error}
                </p>
            )}
        </div>
    );
}
