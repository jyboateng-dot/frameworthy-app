import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, ImageUp, Loader2 } from 'lucide-react';
import { importArtworkFromDevice } from '../../services/artworkImport';

export default function CustomizerImageUpload({
    isPlaceholder,
    isUploading,
    onFile,
    onBrowseMuseumArt,
}) {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (!error) return undefined;
        const timer = window.setTimeout(() => setError(''), 4000);
        return () => window.clearTimeout(timer);
    }, [error]);

    const handleDeviceFile = async (file) => {
        if (!file) return;
        setError('');
        try {
            const normalized = await importArtworkFromDevice(file);
            onFile(normalized.file);
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
        if (isUploading) return;
        const file = e.dataTransfer?.files?.[0];
        await handleDeviceFile(file);
    };

    return (
        <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!isUploading) setIsDragging(true);
                    }}
                    onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragging(false);
                    }}
                    onDrop={handleDrop}
                    disabled={isUploading}
                    className={`relative w-full border-2 border-dashed ${
                        isDragging
                            ? 'border-[#c9a84c] bg-[#faf6ea]'
                            : isPlaceholder
                                ? 'border-stone-300 hover:border-stone-400'
                                : 'border-stone-950 bg-stone-50/50'
                    } rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-colors h-[72px] text-center disabled:cursor-default`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleInputChange}
                        className="hidden"
                        aria-label="Upload photo from device"
                    />
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

                {/* Inspiration Trigger */}
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

            {error && (
                <p role="alert" className="text-[11px] text-red-600">
                    {error}
                </p>
            )}
        </div>
    );
}
