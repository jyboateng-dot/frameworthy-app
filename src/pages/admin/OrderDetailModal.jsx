import React from 'react';
import { X, Download, Layers, ImageOff } from 'lucide-react';
import { GLASS_LABELS, HARDWARE_LABELS, matWidthLabel } from '../../utils/itemFormatters';
import { getPrintQualityJpegUrl } from '../../services/storage';
import { openExternalLinkFromEvent } from '../../utils/nativeLinks';

// Collage image entries have shown up as either bare URL strings or objects
// with a url/src/image key depending on where they were produced — normalize
// defensively rather than assuming one shape.
const collageImageUrl = (entry) => (typeof entry === 'string' ? entry : (entry?.url || entry?.src || entry?.image || null));

const SpecRow = ({ label, children }) => (
    <div className="flex items-center gap-1.5 border-b border-gray-100 pb-1.5 last:border-0 last:pb-0">
        <span className="text-gray-500 min-w-[80px]">{label}: </span>
        <span className="font-bold text-gray-900">{children}</span>
    </div>
);

const ItemFulfillmentCard = ({ item }) => {
    const printUrl = getPrintQualityJpegUrl(item.image, item);
    const hasMat = item.matWidth && item.matWidth !== 'none' && item.matColor;

    let productTitle = 'Custom Photo Frame';
    if (item.collageImages?.length > 0) productTitle = 'Custom Photo Collage';
    else if (item.isPreset) productTitle = 'Curated Artwork Frame';

    return (
        <div className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
            <div className="flex flex-col md:flex-row gap-6">
                {/* Images Section */}
                <div className="flex gap-3 shrink-0">
                    <div className="w-32 h-32 relative">
                        <div className="w-full h-full bg-gray-50 rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center">
                            {(item.visualizerImage || item.productionImage || item.uploadedImage || item.presetImage || item.image) ? (
                                <img src={item.visualizerImage || item.productionImage || item.uploadedImage || item.presetImage || item.image} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <ImageOff size={24} className="text-gray-300" />
                            )}
                        </div>
                        <span className="absolute -top-2 -left-2 text-[10px] font-bold uppercase tracking-wide bg-black text-white px-2 py-1 rounded shadow-sm">
                            Preview
                        </span>
                    </div>

                    {item.selectedFrame && (
                        <div className="w-32 h-32 relative">
                            <div className="w-full h-full bg-white rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center p-2">
                                {item.selectedFrame.previewImg ? (
                                    <img src={item.selectedFrame.previewImg} alt={item.selectedFrame.name} className="w-full h-full object-contain drop-shadow-sm" />
                                ) : (
                                    <ImageOff size={24} className="text-gray-300" />
                                )}
                            </div>
                            <span className="absolute -top-2 -left-2 text-[10px] font-bold uppercase tracking-wide bg-stone-500 text-white px-2 py-1 rounded shadow-sm">
                                Frame
                            </span>
                        </div>
                    )}
                </div>

                {/* Specs Section */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h3 className="font-black text-lg text-gray-900 tracking-tight">{productTitle}</h3>
                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-0.5">Quantity: {item.quantity || 1}</div>
                        </div>
                        {item.image && (
                            <a
                                href={printUrl}
                                download
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => openExternalLinkFromEvent(e, printUrl)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors"
                            >
                                <Download size={14} /> Download Print File
                            </a>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <SpecRow label="Frame">{item.selectedFrame?.name || item.frame || '—'} {item.selectedFrame?.category && <span className="text-gray-400 font-normal">({item.selectedFrame.category})</span>}</SpecRow>
                        <SpecRow label="Size">{item.selectedSize?.label || item.size || '—'}</SpecRow>
                        <SpecRow label="Orientation"><span className="capitalize">{item.orientation || '—'}</span></SpecRow>
                        <SpecRow label="Glazing">{GLASS_LABELS[item.glassType] || item.glassType || '—'}</SpecRow>
                        <SpecRow label="Hardware">{HARDWARE_LABELS[item.hardwareType] || item.hardwareType || '—'}</SpecRow>
                        <SpecRow label="Mat">
                            {hasMat ? (
                                <span className="flex items-center gap-1.5">
                                    <span
                                        className="w-3.5 h-3.5 rounded-full border border-gray-300 inline-block shadow-sm"
                                        style={{ backgroundColor: item.matColor.hex }}
                                        title={item.matColor.hex}
                                    />
                                    {item.matColor.name} ({matWidthLabel(item.matWidth)})
                                </span>
                            ) : (
                                <span className="text-gray-400">No Mat</span>
                            )}
                        </SpecRow>
                    </div>

                    {item.posterMeta && (
                        <p className="text-xs text-gray-500 mt-3 font-medium">
                            {item.posterMeta.artist
                                ? `Music Poster: ${item.posterMeta.artist}${item.posterMeta.trackCount ? ` — ${item.posterMeta.trackCount} tracks` : ''}`
                                : item.posterMeta.director
                                    ? `Movie Poster: Directed by ${item.posterMeta.director}`
                                    : null}
                        </p>
                    )}

                    {item.isPreset && item.presetTitle && (
                        <p className="text-xs text-gray-500 mt-3 font-medium">
                            Preset artwork: {item.presetTitle}{item.presetDims ? ` (${item.presetDims})` : ''}
                        </p>
                    )}
                </div>
            </div>

            {item.collageImages && item.collageImages.length > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-500 mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                        <Layers size={14} /> Collage layout: {item.activeLayout || 'custom'} ({item.collageImages.length} photos)
                    </p>
                    <div className="flex gap-3 flex-wrap">
                        {item.collageImages.map((entry, ci) => {
                            const src = collageImageUrl(entry);
                            if (!src) return null;
                            return (
                                <a
                                    key={ci}
                                    href={getPrintQualityJpegUrl(src)}
                                    download
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => openExternalLinkFromEvent(e, getPrintQualityJpegUrl(src))}
                                    className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden block hover:ring-2 hover:ring-blue-400 hover:-translate-y-0.5 transition-all shadow-sm"
                                    title={`Download photo ${ci + 1}`}
                                >
                                    <img src={src} alt={`Collage photo ${ci + 1}`} className="w-full h-full object-cover" />
                                </a>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const OrderDetailModal = ({ order, onClose }) => {
    if (!order) return null;

    const items = order.items || [];

    return (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
                    <div>
                        <h2 className="text-lg font-black text-gray-900">Order {order.id.slice(0, 8).toUpperCase()}</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleString() : 'Unknown date'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition" aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Customer</p>
                            <p className="font-medium text-gray-900">{order.userEmail}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Deliver To</p>
                            <p className="text-gray-900">{order.shippingAddress?.address}</p>
                            <p className="text-gray-900">{order.shippingAddress?.city}, {order.shippingAddress?.zip}</p>
                            <p className="text-gray-900">{order.shippingAddress?.phone}</p>
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                            Items to produce ({items.length})
                        </p>
                        <div className="space-y-4">
                            {items.map((item, i) => (
                                <ItemFulfillmentCard key={i} item={item} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderDetailModal;
