import React, { useEffect, useRef, useState } from 'react';
import { ImageUp, Link2, Image as ImageIcon, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { FileUploaderRegular } from '@uploadcare/react-uploader';
import '@uploadcare/react-uploader/core.css';
import { importImageFromUrl } from '../../utils/importImageFromUrl';
import { importFromGooglePhotos } from '../../utils/importFromGooglePhotos';

const UPLOADCARE_PUBLIC_KEY = import.meta.env.VITE_UPLOADCARE_PUBLIC_KEY;
const GOOGLE_PHOTOS_CLIENT_ID = import.meta.env.VITE_GOOGLE_PHOTOS_CLIENT_ID;

// Parked 2026-09-03 at the user's request — both flows are fully built and
// tested (see importImageFromUrl.js / importFromGooglePhotos.js and their
// tests), just not surfaced in the UI for now. Flip this back to true to
// bring the dropdown back with all three options; nothing else needs to
// change. See cloud-upload-feature memory.
const SHOW_EXTRA_SOURCES = false;

// Sources shown inside Uploadcare's own popup. The cloud ones (gdrive,
// dropbox) must ALSO be switched on in the Uploadcare dashboard (Settings →
// File Uploader → Upload sources) or they won't appear. gphotos/url are
// listed too, but both are locked behind Uploadcare's paid plan — they're
// left in the list in case that ever changes, but "Paste an image link" and
// "Import from Google Photos" below are this app's own free replacements
// for those two, not duplicates.
const SOURCE_LIST = 'local, camera, url, gdrive, gphotos, dropbox, onedrive';

/**
 * The single "Upload Image / Replace Image" tile in the frame studio.
 *
 * One tile, one dropdown, every source in one place — even though under the
 * hood two of the options ("Paste an image link", "Import from Google
 * Photos") are this app's own free-built flows and the rest come from
 * Uploadcare's own popup window (a separate, third-party widget we can't
 * inject custom sources into). See cloud-upload-feature memory for why.
 *
 * Either way the chosen image is handed back as a `File` via `onFile`, and
 * the caller's existing upload pipeline (local preview + background upload
 * to ImageKit) takes over unchanged.
 */
export default function AddImageMenu({ isPlaceholder, isUploading, onFile, disabled }) {
    const [open, setOpen] = useState(false);
    const [panel, setPanel] = useState('menu'); // 'menu' | 'url' | 'google-photos'
    const [urlValue, setUrlValue] = useState('');
    const [urlStatus, setUrlStatus] = useState('idle'); // idle | loading | error
    const [urlError, setUrlError] = useState('');
    const [googleStatus, setGoogleStatus] = useState('idle'); // idle | loading | error
    const [googleError, setGoogleError] = useState('');

    const rootRef = useRef(null);
    const apiRef = useRef(null);
    const busyRef = useRef(false);
    const urlInputRef = useRef(null);

    const label = isPlaceholder ? 'Upload Image' : 'Replace Image';
    const busy = isUploading || disabled;

    const resetPanel = () => {
        setPanel('menu');
        setUrlValue('');
        setUrlStatus('idle');
        setUrlError('');
        setGoogleStatus('idle');
        setGoogleError('');
    };

    const closeMenu = () => {
        setOpen(false);
        resetPanel();
    };

    // Close on outside click / Escape.
    useEffect(() => {
        if (!open) return undefined;
        const handlePointerDown = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) closeMenu();
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
    }, [open]);

    useEffect(() => {
        if (panel === 'url') requestAnimationFrame(() => urlInputRef.current?.focus());
    }, [panel]);

    const openUploadcarePicker = () => {
        closeMenu();
        apiRef.current?.getAPI?.()?.initFlow?.();
    };

    const toggleMenu = () => {
        if (busy) return;
        // Parked: skip the dropdown entirely and go straight to Uploadcare's
        // popup, same single-click behavior as before the two extra sources
        // existed.
        if (!SHOW_EXTRA_SOURCES) {
            openUploadcarePicker();
            return;
        }
        setOpen((prev) => {
            const next = !prev;
            if (!next) resetPanel();
            return next;
        });
    };

    const handleUploadcareSuccess = async (entry) => {
        const url = entry?.cdnUrl;
        if (!url || busyRef.current) return;
        busyRef.current = true;
        try {
            const resp = await fetch(url);
            const blob = await resp.blob();
            const ext = (entry.mimeType || blob.type || '').split('/')[1];
            const name = entry.name || (ext ? `upload.${ext}` : 'upload.jpg');
            const file = new File([blob], name, { type: entry.mimeType || blob.type || 'image/jpeg' });
            onFile(file);
        } catch (err) {
            console.error('Failed to retrieve the picked image from Uploadcare:', err);
        } finally {
            const api = apiRef.current?.getAPI?.();
            api?.doneFlow?.();
            api?.removeAllFiles?.();
            busyRef.current = false;
        }
    };

    const handleUrlSubmit = async (e) => {
        e.preventDefault();
        if (urlStatus === 'loading' || !urlValue.trim()) return;
        setUrlStatus('loading');
        setUrlError('');
        try {
            const file = await importImageFromUrl(urlValue);
            onFile(file);
            closeMenu();
        } catch (err) {
            setUrlStatus('error');
            setUrlError(err.message || 'Couldn’t load that image.');
        }
    };

    const handleGooglePhotos = async () => {
        setPanel('google-photos');
        setGoogleStatus('loading');
        setGoogleError('');
        try {
            const file = await importFromGooglePhotos();
            onFile(file);
            closeMenu();
        } catch (err) {
            setGoogleStatus('error');
            setGoogleError(err.message || 'Couldn’t import from Google Photos.');
        }
    };

    // w-full: this tile is a plain child of a wrapping div (see the return
    // below) rather than the grid's own direct child, so it no longer picks
    // up the grid's default stretch-to-column-width for free — without this
    // it shrinks to its own content size instead of matching the
    // Inspiration tile beside it.
    const tileClass = `relative w-full border-2 border-dashed ${
        isPlaceholder ? 'border-stone-300 hover:border-stone-400' : 'border-stone-950 bg-stone-50/50'
    } rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-colors h-[72px] text-center disabled:cursor-default disabled:opacity-100`;

    const inner = isUploading ? (
        <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
    ) : (
        <>
            <ImageUp size={16} className={isPlaceholder ? 'text-stone-500' : 'text-stone-950'} />
            <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-700 truncate w-full">
                {label}
            </span>
        </>
    );

    // Nothing configured at all → the plain OS file dialog, same as always.
    // (Google Photos only matters to this check once SHOW_EXTRA_SOURCES is
    // back on — while parked, Uploadcare alone decides the fallback.)
    const noSourcesConfigured = SHOW_EXTRA_SOURCES
        ? !UPLOADCARE_PUBLIC_KEY && !GOOGLE_PHOTOS_CLIENT_ID
        : !UPLOADCARE_PUBLIC_KEY;
    if (noSourcesConfigured) {
        return (
            <label className={tileClass}>
                <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    disabled={busy}
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) onFile(file);
                    }}
                />
                {inner}
            </label>
        );
    }

    return (
        <div ref={rootRef} className="relative">
            <button type="button" onClick={toggleMenu} disabled={busy} className={tileClass}>
                {inner}
            </button>

            {UPLOADCARE_PUBLIC_KEY && (
                <FileUploaderRegular
                    apiRef={apiRef}
                    headless
                    pubkey={UPLOADCARE_PUBLIC_KEY}
                    sourceList={SOURCE_LIST}
                    imgOnly
                    multiple={false}
                    confirmUpload={false}
                    useCloudImageEditor={false}
                    removeCopyright
                    accept="image/*"
                    onFileUploadSuccess={handleUploadcareSuccess}
                />
            )}

            {open && (
                <div className="absolute z-20 top-full left-0 mt-1.5 w-64 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden">
                    {panel === 'menu' && (
                        <div className="py-1">
                            {UPLOADCARE_PUBLIC_KEY ? (
                                <MenuRow icon={ImageUp} label="Device, camera, or cloud storage" onClick={openUploadcarePicker} />
                            ) : (
                                <label className="flex items-center gap-2.5 px-3 py-2.5 text-xs text-stone-700 hover:bg-stone-50 cursor-pointer">
                                    <ImageUp size={14} className="text-stone-400 shrink-0" />
                                    Choose a file
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            e.target.value = '';
                                            if (file) {
                                                onFile(file);
                                                closeMenu();
                                            }
                                        }}
                                    />
                                </label>
                            )}
                            <MenuRow icon={Link2} label="Paste an image link" onClick={() => setPanel('url')} />
                            {GOOGLE_PHOTOS_CLIENT_ID && (
                                <MenuRow icon={ImageIcon} label="Import from Google Photos" onClick={handleGooglePhotos} />
                            )}
                        </div>
                    )}

                    {panel === 'url' && (
                        <form onSubmit={handleUrlSubmit} className="p-2.5">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <button
                                    type="button"
                                    onClick={() => setPanel('menu')}
                                    className="text-stone-400 hover:text-stone-700 shrink-0"
                                    aria-label="Back"
                                >
                                    <ArrowLeft size={13} />
                                </button>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Paste an image link</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <input
                                    ref={urlInputRef}
                                    type="url"
                                    inputMode="url"
                                    value={urlValue}
                                    onChange={(e) => setUrlValue(e.target.value)}
                                    placeholder="https://…"
                                    disabled={urlStatus === 'loading'}
                                    className="flex-1 min-w-0 border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-stone-500 disabled:opacity-60"
                                />
                                <button
                                    type="submit"
                                    disabled={urlStatus === 'loading' || !urlValue.trim()}
                                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-stone-900 text-white disabled:opacity-40 hover:bg-stone-800 transition-colors"
                                    aria-label="Import image"
                                >
                                    {urlStatus === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
                                </button>
                            </div>
                            {urlStatus === 'error' && <p className="mt-1.5 text-[11px] text-red-600">{urlError}</p>}
                        </form>
                    )}

                    {panel === 'google-photos' && (
                        <div className="p-3">
                            {googleStatus === 'loading' && (
                                <div className="flex items-center gap-2 text-xs text-stone-600">
                                    <Loader2 size={13} className="animate-spin shrink-0" />
                                    Waiting for Google Photos…
                                </div>
                            )}
                            {googleStatus === 'error' && (
                                <div>
                                    <p className="text-[11px] text-red-600 mb-2">{googleError}</p>
                                    <button
                                        type="button"
                                        onClick={() => setPanel('menu')}
                                        className="text-[11px] text-stone-500 hover:text-stone-800 flex items-center gap-1"
                                    >
                                        <ArrowLeft size={12} /> Back
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function MenuRow({ icon: Icon, label, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-stone-700 hover:bg-stone-50 transition-colors text-left"
        >
            <Icon size={14} className="text-stone-400 shrink-0" />
            {label}
        </button>
    );
}
