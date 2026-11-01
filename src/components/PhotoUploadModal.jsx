import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Cloud, HardDrive, ImageUp, Link2, Loader2, Upload, X } from 'lucide-react';
import {
    ARTWORK_IMPORT_SOURCES,
    importArtworkFromCloud,
    importArtworkFromDevice,
    importArtworkFromUrl,
    preloadArtworkCloudPickers,
} from '../services/artworkImport';

export default function PhotoUploadModal({
    isOpen,
    onClose,
    navigate,
    onStartFraming,
    onFile,
    isPlaceholder = true,
}) {
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [cloudPending, setCloudPending] = useState(false);
    const [error, setError] = useState('');
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const fileInputRef = useRef(null);
    const urlInputRef = useRef(null);
    const modalRef = useRef(null);
    const cloudAttempt = useRef(0);

    const isReplacing = Boolean(onFile && !isPlaceholder);

    // Reset state on modal open/close
    useEffect(() => {
        if (!isOpen) {
            cloudAttempt.current += 1;
            setIsDragging(false);
            setIsLoading(false);
            setLoadingMessage('');
            setCloudPending(false);
            setError('');
            setShowUrlInput(false);
            setImageUrl('');
        } else {
            preloadArtworkCloudPickers();
        }
    }, [isOpen]);

    // Handle Escape key
    useEffect(() => {
        if (!isOpen) return undefined;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Focus URL input when toggled open
    useEffect(() => {
        if (showUrlInput) {
            requestAnimationFrame(() => urlInputRef.current?.focus());
        }
    }, [showUrlInput]);

    // Process a normalized artwork File and hand off to customizer or caller
    const processArtworkFile = useCallback((file) => {
        if (!file) return;
        setIsLoading(true);
        setError('');

        try {
            if (typeof onFile === 'function') {
                onClose?.();
                onFile(file);
                return;
            }

            const localUrl = URL.createObjectURL(file);
            const rawName = file.name ? file.name.replace(/\.[^.]+$/, '') : 'Your Photo';
            const title = rawName.trim() || 'Your Photo';

            onClose?.();

            const state = {
                uploadedFile: file,
                presetImage: localUrl,
                productionImage: localUrl,
                presetTitle: title,
            };

            if (onStartFraming) {
                onStartFraming(state);
            } else if (navigate) {
                navigate('/frame/customize', { state });
            }
        } catch (err) {
            setError(err?.message || 'Could not load that photo. Please try another.');
            setIsLoading(false);
            setLoadingMessage('');
        }
    }, [navigate, onClose, onFile, onStartFraming]);

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setError('');
        try {
            const normalized = await importArtworkFromDevice(file);
            await processArtworkFile(normalized.file);
        } catch (err) {
            setError(err?.message || 'Please select a valid image file.');
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        setError('');
        try {
            const normalized = await importArtworkFromDevice(file);
            await processArtworkFile(normalized.file);
        } catch (err) {
            setError(err?.message || 'Please drop a valid image file.');
        }
    };

    const handleCloudImport = async (provider) => {
        const attempt = ++cloudAttempt.current;
        const providerName = provider === 'drive' ? 'Google Drive' : 'Dropbox';
        setError('');

        if (!ARTWORK_IMPORT_SOURCES[provider]?.available) {
            const requiredVars = provider === 'drive'
                ? 'VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_DRIVE_API_KEY'
                : 'VITE_DROPBOX_APP_KEY';
            setError(`${providerName} is not configured yet (missing ${requiredVars} in environment). Please upload directly from your device or paste an image link.`);
            return;
        }

        setIsLoading(true);
        setCloudPending(true);
        setLoadingMessage(`Opening ${providerName}...`);
        try {
            const normalized = await importArtworkFromCloud(provider);
            if (attempt !== cloudAttempt.current) return;
            if (normalized?.file) {
                processArtworkFile(normalized.file);
            }
        } catch (err) {
            if (attempt !== cloudAttempt.current) return;
            if (err?.message !== 'No image was selected.') {
                setError(err?.message || `Could not import from ${providerName}.`);
            }
            setIsLoading(false);
            setCloudPending(false);
            setLoadingMessage('');
        }
    };

    const handleUrlImport = async (e) => {
        e.preventDefault();
        const trimmed = imageUrl.trim();
        if (!trimmed) return;
        setIsLoading(true);
        setLoadingMessage('Fetching image from link...');
        setError('');
        try {
            const normalized = await importArtworkFromUrl(trimmed);
            if (normalized?.file) {
                await processArtworkFile(normalized.file);
            }
        } catch (err) {
            setError(err?.message || 'Could not load that image link.');
            setIsLoading(false);
            setLoadingMessage('');
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-6 animate-in fade-in duration-200"
            onClick={(e) => {
                if (modalRef.current && !modalRef.current.contains(e.target)) {
                    onClose?.();
                }
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="photo-upload-modal-title"
        >
            <div
                ref={modalRef}
                className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border border-stone-200/80 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 flex flex-col max-h-[92vh] sm:max-h-[90vh]"
            >
                {/* Mobile bottom-sheet handle */}
                <div className="w-10 h-1 rounded-full bg-stone-300 mx-auto mt-2.5 sm:hidden shrink-0" aria-hidden="true" />

                {/* Header */}
                <div className="flex items-start justify-between px-5 pt-4 pb-3.5 sm:p-6 sm:pb-4 border-b border-stone-100">
                    <div>
                        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#a8892f] block mb-1">
                            {isReplacing ? 'Update artwork' : 'Step one'}
                        </span>
                        <h2 id="photo-upload-modal-title" className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
                            {isReplacing ? 'Replace your photo or artwork' : 'Upload your photo or artwork'}
                        </h2>
                        <p className="text-xs sm:text-sm text-stone-500 mt-1">
                            Choose an image to custom frame with instant live preview.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 flex items-center justify-center transition-colors shrink-0 ml-3"
                        aria-label="Close photo upload dialog"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
                    {/* Error Banner */}
                    {error && (
                        <div
                            role="alert"
                            className="flex items-start gap-2.5 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm"
                        >
                            <AlertCircle size={16} className="shrink-0 text-red-600 mt-0.5" />
                            <div className="flex-1">{error}</div>
                        </div>
                    )}

                    {/* Drag and Drop Primary Zone */}
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`relative rounded-2xl border-2 border-dashed p-5 sm:p-7 text-center transition-all ${
                            isDragging
                                ? 'border-[#c9a84c] bg-[#faf6ea]'
                                : 'border-stone-300 hover:border-stone-400 bg-stone-50/60'
                        }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="photo-upload-file-input"
                            aria-label="Upload photo from device"
                        />
                        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-stone-200 flex items-center justify-center mx-auto mb-3 text-stone-900">
                            <ImageUp size={24} className="text-[#a8892f]" />
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-stone-900 mb-1">
                            {isDragging ? 'Drop your photo here' : 'Choose a photo from your device'}
                        </h3>
                        <p className="text-xs text-stone-500 mb-3.5 max-w-xs mx-auto">
                            Drag and drop an image here, or browse your camera roll and files.
                        </p>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            className="inline-flex items-center gap-2 rounded-full bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            <Upload size={15} /> Browse photos
                        </button>
                        <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                            <span className="px-2 py-0.5 rounded-full bg-white border border-stone-200/80 text-stone-500">JPG</span>
                            <span className="px-2 py-0.5 rounded-full bg-white border border-stone-200/80 text-stone-500">PNG</span>
                            <span className="px-2 py-0.5 rounded-full bg-white border border-stone-200/80 text-stone-500">WebP</span>
                            <span className="px-2 py-0.5 rounded-full bg-white border border-stone-200/80 text-stone-500">HEIC</span>
                            <span className="px-2 py-0.5 rounded-full bg-white border border-stone-200/80 text-stone-500">Up to 20 MB</span>
                        </div>
                    </div>

                    {/* Secondary Options Divider */}
                    <div className="relative flex items-center justify-center py-0.5">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-stone-200" />
                        </div>
                        <span className="relative bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-stone-400">
                            or import from
                        </span>
                    </div>

                    {/* Cloud Sources & Direct Link */}
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => handleCloudImport('drive')}
                            disabled={isLoading}
                            className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-2.5 py-2.5 sm:py-3 rounded-xl border border-stone-200 hover:border-stone-300 hover:bg-stone-50 text-xs font-semibold text-stone-700 transition-colors disabled:opacity-50"
                        >
                            <HardDrive size={15} className="text-stone-500 shrink-0" />
                            <span className="truncate">Google Drive</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleCloudImport('dropbox')}
                            disabled={isLoading}
                            className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-2.5 py-2.5 sm:py-3 rounded-xl border border-stone-200 hover:border-stone-300 hover:bg-stone-50 text-xs font-semibold text-stone-700 transition-colors disabled:opacity-50"
                        >
                            <Cloud size={15} className="text-stone-500 shrink-0" />
                            <span className="truncate">Dropbox</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowUrlInput((prev) => !prev);
                                setError('');
                            }}
                            disabled={isLoading}
                            className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-2.5 py-2.5 sm:py-3 rounded-xl border transition-colors text-xs font-semibold ${
                                showUrlInput
                                    ? 'border-stone-900 bg-stone-900 text-white'
                                    : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50 text-stone-700'
                            } disabled:opacity-50`}
                        >
                            <Link2 size={15} className={`shrink-0 ${showUrlInput ? 'text-white' : 'text-stone-500'}`} />
                            <span className="truncate">Paste image link</span>
                        </button>
                    </div>

                    {/* Image URL Input Form */}
                    {showUrlInput && (
                        <form
                            onSubmit={handleUrlImport}
                            className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150"
                        >
                            <label htmlFor="photo-upload-url-input" className="block text-xs font-semibold text-stone-700">
                                Direct image URL (JPG, PNG, WebP)
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    ref={urlInputRef}
                                    id="photo-upload-url-input"
                                    type="url"
                                    value={imageUrl}
                                    onChange={(e) => setImageUrl(e.target.value)}
                                    placeholder="https://example.com/photo.jpg"
                                    disabled={isLoading}
                                    className="flex-1 min-w-0 bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-500 disabled:opacity-60"
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading || !imageUrl.trim()}
                                    className="shrink-0 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40"
                                >
                                    Import <ArrowRight size={14} />
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Loading Overlay */}
                {isLoading && (
                    <div className="absolute inset-0 z-30 bg-white/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150">
                        <Loader2 size={32} className="animate-spin text-[#a8892f] mb-3" />
                        <p className="text-sm font-bold text-stone-900">{loadingMessage || 'Loading...'}</p>
                        <p className="text-xs text-stone-500 mt-1">
                            {cloudPending ? 'The picker opens in a separate window. If it did not open, try Chrome or Safari.' : 'Calibrating photo for high-resolution framing'}
                        </p>
                        {cloudPending && (
                            <button
                                type="button"
                                onClick={() => {
                                    cloudAttempt.current += 1;
                                    setCloudPending(false);
                                    setIsLoading(false);
                                    setLoadingMessage('');
                                }}
                                className="mt-4 text-sm font-semibold underline text-stone-700"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
