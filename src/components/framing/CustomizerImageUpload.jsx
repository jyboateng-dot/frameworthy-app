import React, { useEffect, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import ArtworkImportMenu from './ArtworkImportMenu';
import { importArtworkFromDevice } from '../../services/artworkImport';

export default function CustomizerImageUpload({
    isPlaceholder,
    isUploading,
    onFile,
    onBrowseMuseumArt,
}) {
    const [isDragging, setIsDragging] = useState(false);
    const [dragError, setDragError] = useState('');

    useEffect(() => {
        if (!dragError) return undefined;
        const timer = window.setTimeout(() => setDragError(''), 4000);
        return () => window.clearTimeout(timer);
    }, [dragError]);

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (isUploading) return;
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        setDragError('');
        try {
            const normalized = await importArtworkFromDevice(file);
            onFile(normalized.file);
        } catch (err) {
            setDragError(err?.message || 'Please drop a valid image file.');
        }
    };

    return (
        <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-3">
                <div
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
                    className={isDragging ? 'rounded-xl ring-2 ring-[#c9a84c] bg-[#faf6ea]' : ''}
                >
                    <ArtworkImportMenu
                        isPlaceholder={isPlaceholder}
                        isUploading={isUploading}
                        onFile={onFile}
                    />
                </div>

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

            {dragError && (
                <p role="alert" className="text-[11px] text-red-600">
                    {dragError}
                </p>
            )}
        </div>
    );
}
