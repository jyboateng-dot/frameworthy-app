import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useUnit } from '../../context/UnitContext';
import { getProdigiQuote, prodigiAttributesForProduct } from '../../services/prodigi';
import {
    isProdigiConfigurationAvailable,
    PRODIGI_MOUNT_COLORS,
    prodigiConfigurationFromSelection,
    prodigiHangingHardware,
    prodigiMountWidthInForSize,
    formatProdigiMountWidth,
    prodigiProductsForFrame,
    prodigiWrapsForSelection,
    prodigiBaseProductForProduct,
    resolveProdigiProduct,
} from '../../utils/prodigiFlow';

const WRAP_LABELS = {
    ImageWrap: 'Image wrap',
    MirrorWrap: 'Mirror wrap',
    White: 'White edge',
    Black: 'Black edge',
};

const GLAZE_LABELS = {
    'Acrylic / Perspex': 'Shatterproof Perspex',
    'Float glass': 'Float Glazing',
    Motheye: 'Moth-eye Anti-Reflective',
};

function FixedSelectionCard({ label, description = 'Set for this frame.' }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-900 bg-stone-50 p-3 shadow-sm">
            <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white" aria-hidden="true">
                    <Check size={12} strokeWidth={3} />
                </span>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900">{label}</p>
                    <p className="mt-0.5 text-[10px] text-stone-500">{description}</p>
                </div>
            </div>
            <span className="shrink-0 rounded-full bg-stone-200 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-stone-600">
                Only option
            </span>
        </div>
    );
}

const selectionSignature = (selection) => JSON.stringify({
    sku: selection?.sku || '',
    attributes: selection?.attributes || {},
    mountWidthIn: selection?.mountWidthIn || null,
    destinationCountryCode: selection?.destinationCountryCode || '',
});

export default function ProdigiConfigurationPanel({
    step,
    frame,
    size,
    selection,
    onSelectionChange,
    onVisualOptionsChange,
}) {
    const { unit } = useUnit();
    const initial = prodigiConfigurationFromSelection(selection);
    const [mounted, setMounted] = useState(initial.mounted);
    const [mountColor, setMountColor] = useState(initial.mountColor);
    const [glaze, setGlaze] = useState(initial.glaze);
    const [wrap, setWrap] = useState(initial.wrap);
    const destination = selection?.destinationCountryCode || 'GB';
    const [quoteError, setQuoteError] = useState('');
    const [isQuoting, setIsQuoting] = useState(false);
    const autoQuoteAttemptRef = useRef('');

    const isConfigurablePrintFrame = frame.prodigiProduct === 'box' || frame.prodigiProduct === 'classic';
    const compatibleFrameConfiguration = useMemo(() => {
        if (!isConfigurablePrintFrame) return { mounted, glaze };
        const requested = { mounted, glaze, mountColor, destinationCountryCode: destination };
        if (isProdigiConfigurationAvailable(frame, size, requested)) return requested;
        return [
            { mounted, glaze: 'Acrylic / Perspex', mountColor, destinationCountryCode: destination },
            { mounted: false, glaze: 'Acrylic / Perspex', mountColor, destinationCountryCode: destination },
            { mounted: true, glaze: 'Acrylic / Perspex', mountColor, destinationCountryCode: destination },
        ].find((option) => isProdigiConfigurationAvailable(frame, size, option)) || requested;
    }, [frame, size, mounted, glaze, mountColor, destination, isConfigurablePrintFrame]);
    const activeMounted = compatibleFrameConfiguration.mounted;
    const activeGlaze = compatibleFrameConfiguration.glaze;
    const activeMountColor = compatibleFrameConfiguration.mountColor;
    const wraps = useMemo(() => prodigiWrapsForSelection(frame, size, { mounted: activeMounted, glaze: activeGlaze, destinationCountryCode: destination }), [frame, size, activeMounted, activeGlaze, destination]);
    const activeWrap = wraps.includes(wrap) ? wrap : (wraps.includes('ImageWrap') ? 'ImageWrap' : wraps[0] || '');
    const configuration = useMemo(() => ({ mounted: activeMounted, mountColor: activeMountColor, glaze: activeGlaze, wrap: activeWrap, destinationCountryCode: destination }), [activeMounted, activeMountColor, activeGlaze, activeWrap, destination]);
    const product = useMemo(() => resolveProdigiProduct(frame, size, configuration), [frame, size, configuration]);
    const baseProduct = useMemo(() => prodigiBaseProductForProduct(product, destination), [product, destination]);
    const hangingHardware = useMemo(() => prodigiHangingHardware(frame, size), [frame, size]);
    const mountWidthIn = activeMounted ? prodigiMountWidthInForSize(size, product) : null;
    const mountWidthLabel = mountWidthIn ? formatProdigiMountWidth(size, product, unit) : 'Custom';
    const hasImportedProducts = prodigiProductsForFrame(frame).length > 0;

    useEffect(() => {
        if (!product) {
            if (selection) onSelectionChange(null);
            return;
        }
        const next = {
            sku: product.sku,
            productId: product.id,
            productFamily: product.family,
            sizeCm: product.sizeCm,
            sizeInches: product.sizeInches,
            attributes: prodigiAttributesForProduct(product),
            mountWidthIn,
            hangingHardware,
            destinationCountryCode: destination,
            shippingMethod: 'Standard',
            quoteToken: null,
            retailTotalGhs: null,
            quoteTotalGbp: null,
            quoteCurrency: null,
            quoteExpiresAt: null,
        };
        if (selectionSignature(selection) === selectionSignature(next)) {
            next.quoteToken = selection.quoteToken || null;
            next.retailTotalGhs = selection.retailTotalGhs || null;
            next.quoteTotalGbp = selection.quoteTotalGbp || null;
            next.quoteItemsGbp = selection.quoteItemsGbp || null;
            next.quoteFrameGbp = selection.quoteFrameGbp || null;
            next.quoteCustomizationsGbp = selection.quoteCustomizationsGbp || null;
            next.quoteShippingGbp = selection.quoteShippingGbp || null;
            next.quoteTaxGbp = selection.quoteTaxGbp || null;
            next.quoteCurrency = selection.quoteCurrency || null;
            next.quoteExpiresAt = selection.quoteExpiresAt || null;
            next.shippingMethod = selection.shippingMethod || 'Standard';
        }
        const hasChanged = JSON.stringify(selection || null) !== JSON.stringify(next);
        if (hasChanged) onSelectionChange(next);
    }, [product, mountWidthIn, hangingHardware, destination, selection, onSelectionChange]);

    useEffect(() => {
        const selectedMountColor = PRODIGI_MOUNT_COLORS.find((option) => option.value === activeMountColor);
        const selectedGlaze = isConfigurablePrintFrame ? activeGlaze : product?.options?.glaze;
        onVisualOptionsChange({
            matWidth: isConfigurablePrintFrame && activeMounted ? mountWidthIn : 'none',
            matColorId: selectedMountColor?.matColorId || 'white',
            glassType: selectedGlaze === 'Motheye' ? 'non-glare' : selectedGlaze === 'Float glass' ? 'float-glass' : 'standard',
        });
    }, [isConfigurablePrintFrame, activeMounted, activeMountColor, activeGlaze, mountWidthIn, product?.options?.glaze, onVisualOptionsChange]);

    const chooseConfiguration = (updates) => {
        setQuoteError('');
        if ('mounted' in updates) setMounted(updates.mounted);
        if ('mountColor' in updates) setMountColor(updates.mountColor);
        if ('glaze' in updates) setGlaze(updates.glaze);
        if ('wrap' in updates) setWrap(updates.wrap);
    };

    useEffect(() => {
        if (!product || selection?.productId !== product.id || selection?.quoteTotalGbp) return undefined;
        const quoteSignature = `${product.id}::${destination}`;
        if (autoQuoteAttemptRef.current === quoteSignature) return undefined;
        let cancelled = false;
        const timer = window.setTimeout(async () => {
            if (cancelled) return;
            autoQuoteAttemptRef.current = quoteSignature;
            setIsQuoting(true);
            setQuoteError('');
            try {
                const result = await getProdigiQuote({ product, baseProduct, destinationCountryCode: destination });
                const quote = result.quotes?.find((item) => item.shippingMethod?.toLowerCase() === 'standard') || result.quotes?.[0];
                if (!quote) throw new Error('No delivery option is currently available.');
                if (quote.total?.currency !== 'GBP') throw new Error('A GBP quote is not available for this configuration.');
                if (cancelled) return;
                onSelectionChange({
                    ...selection,
                    sku: product.sku,
                    productId: product.id,
                    productFamily: product.family,
                    sizeCm: product.sizeCm,
                    sizeInches: product.sizeInches,
                    attributes: prodigiAttributesForProduct(product),
                    destinationCountryCode: destination,
                    shippingMethod: quote.shippingMethod || 'Standard',
                    quoteToken: quote.retail?.token || null,
                    retailTotalGhs: quote.retail?.totalGhs || null,
                    quoteTotalGbp: Number(quote.total.amount),
                    quoteItemsGbp: Number(quote.items?.amount) || null,
                    quoteFrameGbp: Number(quote.retail?.frame?.amount) || null,
                    quoteCustomizationsGbp: Number(quote.retail?.customizations?.amount) || 0,
                    quoteShippingGbp: Number(quote.shipping?.amount) || null,
                    quoteTaxGbp: Number(quote.tax?.amount) || null,
                    quoteCurrency: 'GBP',
                    quoteExpiresAt: quote.retail?.expiresAt || null,
                });
            } catch (error) {
                autoQuoteAttemptRef.current = '';
                if (!cancelled) setQuoteError(error?.message?.replace(/^Firebase:\s*/i, '').replace(/Prodigi/gi, 'the fulfilment service') || 'Live pricing is unavailable right now.');
            } finally {
                if (!cancelled) setIsQuoting(false);
            }
        }, 350);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [product, baseProduct, destination, selection, onSelectionChange]);

    if (!hasImportedProducts) {
        return (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-950">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px] text-amber-700">{step}</span>
                    Product availability
                </h2>
                <p className="mt-2 text-xs leading-5 text-amber-900">This imported finish is ready for 2D, 3D and AR preview, but the current supplier catalogue does not contain an orderable SKU for this frame family.</p>
            </section>
        );
    }

    return (
        <div className="space-y-5" aria-label="Product configuration">
            <section>
                        <h2 className="mb-3 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wider text-stone-900">
                            <span className="flex min-w-0 items-center gap-2">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[10px] text-stone-500">{step}</span>
                                Mount
                            </span>
                            <span className="shrink-0 text-xs font-bold normal-case tabular-nums text-stone-900">
                                {activeMounted ? mountWidthLabel : 'No Mount'}
                            </span>
                        </h2>
                        {isConfigurablePrintFrame ? <div className="flex rounded-xl bg-stone-100 p-1">
                            {[
                                { mounted: false, label: 'No Mount' },
                                { mounted: true, label: 'Add Mount' },
                            ].map((option) => {
                                    const available = isProdigiConfigurationAvailable(frame, size, { mounted: option.mounted, mountColor: activeMountColor, glaze: activeGlaze, destinationCountryCode: destination });
                                const selected = activeMounted === option.mounted;
                                return (
                                    <button key={String(option.mounted)} type="button" disabled={!available}
                                        onClick={() => chooseConfiguration({ mounted: option.mounted })}
                                        className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${selected ? 'bg-white font-bold text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'} disabled:cursor-not-allowed disabled:opacity-35`}>
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div> : <FixedSelectionCard label="No Mount" />}
                        {activeMounted && (
                            <p className="mt-2 text-[10px] leading-4 text-stone-500">
                                Mount width is set automatically for this frame size.
                            </p>
                        )}
            </section>

                    {isConfigurablePrintFrame && activeMounted && (
                        <section>
                            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-900">Mount Colour</h2>
                            <div className="grid grid-cols-3 gap-2">
                                {PRODIGI_MOUNT_COLORS.map((option) => {
                                    const selected = activeMountColor === option.value;
                                    const available = isProdigiConfigurationAvailable(frame, size, { mounted: true, mountColor: option.value, glaze: activeGlaze, destinationCountryCode: destination });
                                    return (
                                        <button key={option.value} type="button" disabled={!available}
                                            onClick={() => chooseConfiguration({ mounted: true, mountColor: option.value })}
                                            className={`flex h-10 items-center justify-center rounded-lg border-2 transition-all ${selected ? 'scale-105 border-fw-gold shadow-md' : 'border-stone-200 hover:border-stone-300'} disabled:cursor-not-allowed disabled:opacity-35`}
                                            style={{ backgroundColor: option.hex }} title={option.label} aria-label={option.label}>
                                            {selected && <Check size={16} className={option.light ? 'text-stone-900' : 'text-white'} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    )}

            <section>
                        <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-900">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-100 text-[10px] text-stone-500">{Number(step) + 1}</span>
                            Glazing
                        </h2>
                        {isConfigurablePrintFrame ? <div className="space-y-2">
                            {[
                                { value: 'Acrylic / Perspex', name: 'Shatterproof Perspex', description: 'Clear, lightweight protection.' },
                                { value: 'Float glass', name: 'Float Glazing', description: 'Traditional glazing with a crisp reflective finish.' },
                                { value: 'Motheye', name: 'Moth-eye Anti-Reflective', description: 'Near reflection-free clarity.' },
                            ].map((option) => {
                                const available = isProdigiConfigurationAvailable(frame, size, { mounted: activeMounted, mountColor: activeMountColor, glaze: option.value, destinationCountryCode: destination });
                                const selected = activeGlaze === option.value;
                                return (
                                    <button key={option.value} type="button" disabled={!available} onClick={() => chooseConfiguration({ glaze: option.value })}
                                        className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${selected ? 'border-stone-900 bg-stone-50 shadow-sm' : 'border-stone-200 hover:border-stone-300'} disabled:cursor-not-allowed disabled:opacity-35`}>
                                        <div>
                                            <p className={`text-sm font-semibold ${selected ? 'text-stone-900' : 'text-stone-700'}`}>{option.name}</p>
                                            <p className="mt-0.5 text-[10px] text-stone-500">{option.description}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div> : (
                            <FixedSelectionCard
                                label={GLAZE_LABELS[product?.options?.glaze] || 'No glazing'}
                                description={product?.options?.glaze ? 'Set for this frame.' : 'No glazing is required for this product.'}
                            />
                        )}
            </section>

            {wraps.length > 0 && (
                <section>
                    <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-900">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-100 text-[10px] text-stone-500">{Number(step) + 2}</span>
                        Canvas Edge Finish
                    </h2>
                    {wraps.length === 1 ? (
                        <FixedSelectionCard label={WRAP_LABELS[wraps[0]] || wraps[0]} />
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {wraps.map((option) => (
                            <button key={option} type="button" onClick={() => chooseConfiguration({ wrap: option })}
                                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${product?.options.wrap === option ? 'border-stone-900 bg-stone-50 text-stone-900 shadow-sm' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'}`}>
                                {WRAP_LABELS[option] || option}
                            </button>
                            ))}
                        </div>
                    )}
                </section>
            )}

            <section>
                <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-900">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-100 text-[10px] text-stone-500">{Number(step) + (wraps.length > 0 ? 3 : 2)}</span>
                    Hardware
                </h2>
                <FixedSelectionCard
                    label={hangingHardware.label}
                    description={hangingHardware.description}
                />
                {hangingHardware.included && (
                    <p className="mt-2 text-[10px] leading-4 text-stone-500">
                        Wall nails, screws and plugs are not included.
                    </p>
                )}
            </section>

            {product ? (
                <section className="border-t border-stone-200 pt-4">
                    {isQuoting && <p className="text-center text-[10px] font-semibold text-stone-500" aria-live="polite">Updating price…</p>}
                    {(selection?.quoteItemsGbp || selection?.quoteTotalGbp) && (
                        <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900" aria-live="polite">
                            <div className="flex flex-col">
                                <span className="flex items-center gap-1.5 font-semibold"><Check size={13} /> Item price</span>
                                <span className="text-[10px] text-emerald-700">Delivery & tax calculated at checkout</span>
                            </div>
                            <span className="font-bold text-sm">£{Number(selection.quoteItemsGbp || selection.quoteTotalGbp).toFixed(2)}</span>
                        </div>
                    )}
                    {quoteError && <p role="alert" className="mt-3 rounded-xl bg-amber-100 p-3 text-xs leading-5 text-amber-950">{quoteError}</p>}
                </section>
            ) : (
                <p role="alert" className="mt-3 rounded-xl bg-amber-100 p-3 text-xs text-amber-950">This option combination is not supplied in the selected size.</p>
            )}
        </div>
    );
}
