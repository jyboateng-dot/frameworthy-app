import React, { useEffect, useRef, useState } from 'react';
import { ImageUp, HardDrive, Image as ImageIcon, Link2, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { importImageFromUrl } from '../../utils/importImageFromUrl';
import { importFromGooglePhotos } from '../../utils/importFromGooglePhotos';
import { importFromGoogleDrive } from '../../utils/importFromGoogleDrive';
import { importFromDropbox } from '../../utils/importFromDropbox';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_DRIVE_API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY;
const DROPBOX_APP_KEY = import.meta.env.VITE_DROPBOX_APP_KEY;

const DRIVE_ENABLED = Boolean(GOOGLE_CLIENT_ID && GOOGLE_DRIVE_API_KEY);
const PHOTOS_ENABLED = Boolean(GOOGLE_CLIENT_ID);
const DROPBOX_ENABLED = Boolean(DROPBOX_APP_KEY);

// Fire-and-wait cloud sources: click the row, a picker opens outside this
// app (Google's, Dropbox's), and this app waits for the result. All three
// share the same loading/error UI in the dropdown — see handlePickFromSource.
const CLOUD_SOURCES = {
    drive: { label: 'Google Drive', importer: importFromGoogleDrive },
    photos: { label: 'Google Photos', importer: importFromGooglePhotos },
    dropbox: { label: 'Dropbox', importer: importFromDropbox },
};

/**
 * The single "Upload Image / Replace Image" tile in the frame studio.
 *
 * Entirely self-built — no third-party picker widget (Uploadcare was
 * dropped; see cloud-upload-feature memory for why and what it cost to
 * build each source directly). One tile, one dropdown: Device always works
 * (a plain file input, no config — its own OS picker already offers the
 * camera on mobile, so there's no separate Camera row); each cloud source
 * (Drive/Photos/Dropbox) independently disappears from the menu if its
 * config isn't set, rather than erroring; "Paste an image link" always
 * works (it's this app's own Firebase Function, always deployed).
 *
 * Either way the chosen image is handed back as a `File` via `onFile`, and
 * the caller's existing upload pipeline (local preview + background upload
 * to ImageKit) takes over unchanged.
 */
export default function AddImageMenu({ isPlaceholder, isUploading, onFile, disabled }) {
    const [open, setOpen] = useState(false);
    const [panel, setPanel] = useState('menu'); // 'menu' | 'url' | 'drive' | 'photos' | 'dropbox'
    const [urlValue, setUrlValue] = useState('');
    const [urlStatus, setUrlStatus] = useState('idle'); // idle | loading | error
    const [urlError, setUrlError] = useState('');
    const [sourceStatus, setSourceStatus] = useState('idle'); // idle | loading | error
    const [sourceError, setSourceError] = useState('');

    const rootRef = useRef(null);
    const urlInputRef = useRef(null);

    const label = isPlaceholder ? 'Upload Image' : 'Replace Image';
    const busy = isUploading || disabled;

    const resetPanel = () => {
        setPanel('menu');
        setUrlValue('');
        setUrlStatus('idle');
        setUrlError('');
        setSourceStatus('idle');
        setSourceError('');
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

    const toggleMenu = () => {
        if (busy) return;
        setOpen((prev) => {
            const next = !prev;
            if (!next) resetPanel();
            return next;
        });
    };

    const handleDeviceFile = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) {
            onFile(file);
            closeMenu();
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

    const handlePickFromSource = async (sourceKey) => {
        const { importer, label: sourceLabel } = CLOUD_SOURCES[sourceKey];
        setPanel(sourceKey);
        setSourceStatus('loading');
        setSourceError('');
        try {
            const file = await importer();
            onFile(file);
            closeMenu();
        } catch (err) {
            setSourceStatus('error');
            setSourceError(err.message || `Couldn’t import from ${sourceLabel}.`);
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

    return (
        <div ref={rootRef} className="relative">
            <button type="button" onClick={toggleMenu} disabled={busy} className={tileClass}>
                {inner}
            </button>

            {open && (
                <div className="absolute z-20 top-full left-0 mt-1.5 w-64 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden">
                    {panel === 'menu' && (
                        <div className="py-1">
                            {/* No separate "Camera" row — the device file
                                input's own OS picker already offers "Take
                                Photo" alongside the photo library on mobile,
                                so a dedicated Camera entry was a duplicate
                                path to the same native chooser. */}
                            <FileMenuRow icon={ImageUp} label="Device" onChange={handleDeviceFile} />
                            {DRIVE_ENABLED && (
                                <MenuRow icon={HardDrive} label="Google Drive" onClick={() => handlePickFromSource('drive')} />
                            )}
                            {PHOTOS_ENABLED && (
                                <MenuRow icon={ImageIcon} label="Google Photos" onClick={() => handlePickFromSource('photos')} />
                            )}
                            {DROPBOX_ENABLED && (
                                <MenuRow icon={HardDrive} label="Dropbox" onClick={() => handlePickFromSource('dropbox')} />
                            )}
                            <MenuRow icon={Link2} label="Paste an image link" onClick={() => setPanel('url')} />
                        </div>
                    )}

                    {panel === 'url' && (
                        <form onSubmit={handleUrlSubmit} className="p-2.5">
                            <PanelHeader label="Paste an image link" onBack={() => setPanel('menu')} />
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

                    {panel in CLOUD_SOURCES && (
                        <div className="p-3">
                            {sourceStatus === 'loading' && (
                                <div className="flex items-center gap-2 text-xs text-stone-600">
                                    <Loader2 size={13} className="animate-spin shrink-0" />
                                    Waiting for {CLOUD_SOURCES[panel].label}…
                                </div>
                            )}
                            {sourceStatus === 'error' && (
                                <div>
                                    <p className="text-[11px] text-red-600 mb-2">{sourceError}</p>
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

function FileMenuRow({ icon: Icon, label, onChange }) {
    return (
        <label className="flex items-center gap-2.5 px-3 py-2.5 text-xs text-stone-700 hover:bg-stone-50 cursor-pointer">
            <Icon size={14} className="text-stone-400 shrink-0" />
            {label}
            <input type="file" className="hidden" accept="image/*" onChange={onChange} />
        </label>
    );
}

function PanelHeader({ label, onBack }) {
    return (
        <div className="flex items-center gap-1.5 mb-1.5">
            <button type="button" onClick={onBack} className="text-stone-400 hover:text-stone-700 shrink-0" aria-label="Back">
                <ArrowLeft size={13} />
            </button>
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">{label}</span>
        </div>
    );
}
