import React, { useRef } from 'react';
import { ImageUp } from 'lucide-react';
import { FileUploaderRegular } from '@uploadcare/react-uploader';
import '@uploadcare/react-uploader/core.css';

const UPLOADCARE_PUBLIC_KEY = import.meta.env.VITE_UPLOADCARE_PUBLIC_KEY;

// Sources shown in the picker window. The cloud ones (gdrive, gphotos,
// dropbox, onedrive) must ALSO be switched on in the Uploadcare dashboard
// (Settings → File Uploader → Upload sources) or they won't appear.
const SOURCE_LIST = 'local, camera, url, gdrive, gphotos, dropbox, onedrive';

/**
 * The "Upload Image / Replace Image" tile in the frame studio.
 *
 * When an Uploadcare public key is configured it opens Uploadcare's picker
 * window — the customer can pull an image from their device, camera, a URL,
 * Google Drive, Google Photos, Dropbox or OneDrive. Without the key it falls
 * back to the plain OS file dialog so the app still works in local/dev.
 *
 * Either way the chosen image is handed back as a `File` via `onFile`, and the
 * caller's existing upload pipeline (local preview + background upload to
 * ImageKit) takes over unchanged.
 */
export default function ImageUploadField({ isPlaceholder, isUploading, onFile, disabled }) {
    const apiRef = useRef(null);
    const busyRef = useRef(false);

    const label = isPlaceholder ? 'Upload Image' : 'Replace Image';
    // w-full: this tile is now a plain child of a wrapping div (see the
    // return below) rather than the grid's own direct child, so it no
    // longer picks up the grid's default stretch-to-column-width for
    // free — without this it shrinks to its own content size instead of
    // matching the Inspiration tile beside it.
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

    // ── Fallback: no Uploadcare key → plain OS file dialog ──
    if (!UPLOADCARE_PUBLIC_KEY) {
        return (
            <label className={tileClass}>
                <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    disabled={isUploading || disabled}
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

    // ── Uploadcare picker window ──
    const openPicker = () => {
        if (isUploading || disabled) return;
        apiRef.current?.getAPI?.()?.initFlow?.();
    };

    const handleSuccess = async (entry) => {
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

    // A single wrapping element, not a fragment: FileUploaderRegular
    // (headless, so invisible) still renders its own DOM node, and as a
    // sibling of the button — both direct children of the caller's
    // grid — that was a second grid item, pushing Inspiration onto its
    // own row instead of sitting beside Upload. This div is the one
    // grid cell instead; the button stays a plain button rather than
    // nesting the uploader's own interactive web component inside it,
    // which isn't valid inside a <button>.
    return (
        <div>
            <button
                type="button"
                onClick={openPicker}
                disabled={isUploading || disabled}
                className={tileClass}
            >
                {inner}
            </button>
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
                onFileUploadSuccess={handleSuccess}
            />
        </div>
    );
}
