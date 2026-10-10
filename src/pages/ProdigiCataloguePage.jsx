import React, { useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, Info, PackageCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import prodigiCatalog from '../data/prodigiCatalog.json';
import { PRODIGI_PRESENTATION } from '../data/prodigiProductPresentation';

const FAMILY_OPTIONS = [
    { id: 'box', label: 'Box frame · no mount', group: 'Box frames', presentation: 'box', description: 'Wood box frame with clear acrylic / Perspex glaze.' },
    { id: 'box-mounted', label: 'Box frame · mounted', group: 'Box frames', presentation: 'box', description: 'Box frame with a 2.4 mm Snow White mount and clear acrylic glaze.' },
    { id: 'box-motheye', label: 'Box frame · Motheye glaze', group: 'Box frames', presentation: 'box', description: 'No-mount box frame with Prodigi Motheye anti-reflective glaze.' },
    { id: 'box-mounted-motheye', label: 'Mounted box · Motheye glaze', group: 'Box frames', presentation: 'box', description: 'Mounted box frame with Prodigi Motheye anti-reflective glaze.' },
    { id: 'canvas-float', label: 'Float-framed canvas · 38 mm', group: 'Canvas frames', presentation: 'canvas-float', description: '400 gsm cotton canvas with a 38 mm float frame.' },
    { id: 'canvas-classic', label: 'Classic framed canvas · 19 mm', group: 'Canvas frames', presentation: 'canvas-classic', description: '400 gsm canvas on 19 mm bars with a classic frame.' },
    { id: 'canvas-eco', label: 'Eco framed canvas · 38 mm', group: 'Canvas frames', presentation: 'canvas-eco', description: 'Recycled 330 gsm canvas with a 38 mm float frame.' },
    { id: 'stretched-canvas', label: 'Stretched canvas · 38 mm', group: 'Canvas styles', presentation: 'stretched-canvas', description: '400 gsm cotton canvas hand-stretched over pine bars, with four edge finishes.' },
];

const FRAME_COLORS = {
    black: '#242321',
    natural: '#b08a5a',
    white: '#f4f1e9',
    brown: '#68472f',
    gold: '#c4a357',
    silver: '#aaa9a5',
    'light grey': '#c3c1bd',
    'dark grey': '#555451',
};

const money = (value, currency = 'GBP') => new Intl.NumberFormat('en-GB', {
    style: 'currency', currency, maximumFractionDigits: 2,
}).format(value || 0);

const preferredSku = (products) => {
    for (const dimension of ['16X20', '12X16', '12X18', '16X16', '12X12']) {
        const match = products.find((product) => product.sku.endsWith(`-${dimension}`));
        if (match) return match.sku;
    }
    return products[0]?.sku || '';
};

const prettifyWrap = (value) => ({
    ImageWrap: 'Image wrap',
    MirrorWrap: 'Mirror wrap',
    White: 'White edge',
    Black: 'Black edge',
}[value] || value);

const defaultPreviewForFamily = (familyId) => {
    const familyOption = FAMILY_OPTIONS.find((item) => item.id === familyId);
    const familyPresentation = PRODIGI_PRESENTATION[familyOption?.presentation];
    return Object.keys(familyPresentation?.colors || {}).length > 0
        ? 'finish'
        : familyPresentation?.views[0]?.id || 'finish';
};

export default function ProdigiCataloguePage() {
    const [destination, setDestination] = useState('JE');
    const [family, setFamily] = useState('box');
    const [sku, setSku] = useState('');
    const [color, setColor] = useState('');
    const [wrap, setWrap] = useState('');
    const [activePreview, setActivePreview] = useState(() => defaultPreviewForFamily('box'));

    const familyProducts = useMemo(() => prodigiCatalog.products.filter((item) =>
        item.family === family && item.markets[destination]), [family, destination]);
    const availableSkus = useMemo(() => [...new Map(familyProducts.map((item) => [item.sku, item])).values()], [familyProducts]);
    const activeSku = availableSkus.some((item) => item.sku === sku) ? sku : preferredSku(availableSkus);
    const sizeVariants = useMemo(() => familyProducts.filter((item) => item.sku === activeSku), [familyProducts, activeSku]);
    const colors = useMemo(() => [...new Set(sizeVariants.map((item) => item.options.color).filter(Boolean))], [sizeVariants]);
    const activeColor = colors.includes(color) ? color : (colors.includes('natural') ? 'natural' : colors.includes('black') ? 'black' : colors[0] || '');
    const colorVariants = sizeVariants.filter((item) => item.options.color === activeColor);
    const wraps = [...new Set(colorVariants.map((item) => item.options.wrap).filter(Boolean))];
    const activeWrap = wraps.includes(wrap) ? wrap : (wraps.includes('ImageWrap') ? 'ImageWrap' : wraps[0] || '');
    const selected = colorVariants.find((item) => item.options.wrap === activeWrap) || colorVariants[0] || sizeVariants[0];
    const familyDetail = FAMILY_OPTIONS.find((item) => item.id === family) || FAMILY_OPTIONS[0];
    const presentation = PRODIGI_PRESENTATION[familyDetail.presentation];
    const selectedColorAsset = (activeColor && presentation.colors[activeColor.toLowerCase()]) || presentation.thumbnail;
    const activeView = presentation.views.find((view) => view.id === activePreview);
    const visualizerImage = activePreview === 'finish' ? selectedColorAsset : (activeView?.src || presentation.thumbnail);
    const selectedMarket = selected?.markets[destination];
    const sourceUrl = family === 'stretched-canvas'
        ? (destination === 'JE' ? prodigiCatalog.source.urls.stretchedCanvasJE : prodigiCatalog.source.urls.stretchedCanvasGB)
        : family.startsWith('canvas')
            ? (destination === 'JE' ? prodigiCatalog.source.urls.framedCanvasJE : prodigiCatalog.source.urls.framedCanvasGB)
        : (destination === 'JE' ? prodigiCatalog.source.urls.framedPrintsJE : prodigiCatalog.source.urls.framedPrintsGB);

    const selectFamily = (nextFamily) => {
        setFamily(nextFamily);
        const products = prodigiCatalog.products.filter((item) => item.family === nextFamily && item.markets[destination]);
        setSku(preferredSku([...new Map(products.map((item) => [item.sku, item])).values()]));
        setColor('');
        setWrap('');
        setActivePreview(defaultPreviewForFamily(nextFamily));
    };

    const selectDestination = (nextDestination) => {
        setDestination(nextDestination);
        const products = prodigiCatalog.products.filter((item) => item.family === family && item.markets[nextDestination]);
        setSku(preferredSku([...new Map(products.map((item) => [item.sku, item])).values()]));
        setColor('');
        setWrap('');
        setActivePreview(defaultPreviewForFamily(family));
    };

    const lineTotal = selectedMarket
        ? (selectedMarket.productPrice || 0) + (selectedMarket.shippingPrice || 0)
        : 0;

    return (
        <main className="min-h-[calc(100vh-56px)] bg-[#faf9f8] px-4 py-8 sm:px-8">
            <div className="mx-auto max-w-6xl">
                <Link to="/frame/customize" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-950">
                    <ArrowLeft size={16} /> Back to Frame Studio
                </Link>

                <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#947735]">Fulfilment catalogue · Prodigi</p>
                        <h1 className="font-serif text-3xl font-bold text-stone-950 sm:text-4xl">Frame & canvas catalogue</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                            Explore Prodigi’s box frames and canvas styles by destination, available size and finish. Supplier prices are shown separately from any future FrameWorthy retail price.
                        </p>
                    </div>
                    <label className="flex shrink-0 flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-600">
                        Shipping to
                        <select value={destination} onChange={(event) => selectDestination(event.target.value)} className="min-w-56 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-stone-900 outline-none focus:border-[#b8964a]">
                            <option value="JE">Jersey</option>
                            <option value="GB">Mainland United Kingdom</option>
                        </select>
                    </label>
                </div>

                <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {FAMILY_OPTIONS.map((item) => {
                        const itemPresentation = PRODIGI_PRESENTATION[item.presentation];
                        return (
                            <button key={item.id} type="button" onClick={() => selectFamily(item.id)} aria-pressed={family === item.id}
                                className={`overflow-hidden rounded-2xl border text-left transition ${family === item.id ? 'border-[#b8964a] bg-[#fbf8ef] shadow-sm ring-1 ring-[#b8964a]/40' : 'border-stone-200 bg-white hover:border-stone-400'}`}>
                                <span className="block aspect-[16/9] overflow-hidden bg-stone-100">
                                    <img src={itemPresentation.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 hover:scale-[1.03]" />
                                </span>
                                <span className="block p-4">
                                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">{item.group}</span>
                                    <span className="block text-sm font-bold text-stone-900">{item.label}</span>
                                    <span className="mt-1 block text-xs leading-5 text-stone-500">{item.description}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                {!selected ? (
                    <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                        This Prodigi family currently has no listed price for {destination === 'JE' ? 'Jersey' : 'the United Kingdom'}.
                    </div>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7" aria-label="Product options">
                            <div className="mb-6 flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-bold text-stone-950">{familyDetail.label}</h2>
                                    <p className="mt-1 text-sm text-stone-500">{familyDetail.description}</p>
                                </div>
                                <span className="rounded-full bg-stone-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-stone-600">{sizeVariants[0]?.frame || 'Prodigi'}</span>
                            </div>

                            <label className="mb-5 block text-xs font-bold uppercase tracking-wide text-stone-600">
                                Available size
                                <select value={activeSku} onChange={(event) => { setSku(event.target.value); setColor(''); setWrap(''); }} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm font-semibold normal-case tracking-normal text-stone-900 outline-none focus:border-[#b8964a]">
                                    {availableSkus.map((item) => <option key={item.sku} value={item.sku}>{item.sizeInches} · {item.sizeCm} {item.sku.match(/-(A\d)$/)?.[1] ? `· ${item.sku.match(/-(A\d)$/)?.[1]}` : ''}</option>)}
                                </select>
                            </label>

                            {colors.length > 0 && (
                                <fieldset className="mb-5">
                                    <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-600">Frame colour · {activeColor}</legend>
                                    <div className="flex flex-wrap gap-2">
                                        {colors.map((option) => {
                                            const finishImage = presentation.colors[option.toLowerCase()];
                                            return <button key={option} type="button" onClick={() => { setColor(option); setWrap(''); setActivePreview('finish'); }} aria-label={option} aria-pressed={activeColor === option} title={option}
                                                className={`group w-[76px] overflow-hidden rounded-xl border bg-white text-center transition ${activeColor === option ? 'border-[#b8964a] ring-2 ring-[#b8964a]/30 ring-offset-1' : 'border-stone-200 hover:border-stone-400'}`}>
                                                <span className="block h-12 overflow-hidden bg-stone-100">
                                                    {finishImage ? <img src={finishImage} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="block h-full w-full" style={{ backgroundColor: FRAME_COLORS[option.toLowerCase()] || '#c5b9a8' }} />}
                                                </span>
                                                <span className="block truncate px-1 py-1.5 text-[10px] font-semibold capitalize text-stone-700">{option}</span>
                                            </button>
                                        })}
                                    </div>
                                </fieldset>
                            )}

                            {wraps.length > 0 && (
                                <fieldset className="mb-5">
                                    <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-600">Canvas edge finish</legend>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        {wraps.map((option) => (
                                            <button key={option} type="button" onClick={() => setWrap(option)} aria-pressed={activeWrap === option}
                                                className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${activeWrap === option ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'}`}>
                                                {prettifyWrap(option)}
                                            </button>
                                        ))}
                                    </div>
                                </fieldset>
                            )}

                            <div className="mt-6 rounded-2xl bg-stone-50 p-4">
                                <div className="flex items-start gap-2 text-xs leading-5 text-stone-600">
                                    <Info size={15} className="mt-0.5 shrink-0 text-[#947735]" />
                                    <p>{selected.description} {selected.options.mount ? `Mount: ${selected.options.mount}, ${selected.options.mountColor}.` : ''} {selected.options.glaze ? `Glaze: ${selected.options.glaze}.` : ''} {selected.options.paper ? `Print: ${selected.options.paper} ${selected.options.substrateWeight}.` : ''}</p>
                                </div>
                            </div>
                        </section>

                        <aside className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7" aria-label="Selected Prodigi frame and supplier price summary">
                            <div className="mb-5">
                                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-stone-400">Selected {family === 'stretched-canvas' ? 'canvas' : 'frame'} · Prodigi product photography</p>
                                <figure className="overflow-hidden rounded-2xl bg-stone-100">
                                    <img key={visualizerImage} src={visualizerImage} alt={`${familyDetail.label}${activeColor ? `, ${activeColor} finish` : ''} — ${activeView?.label || 'frame finish detail'}`} className="aspect-[4/3] w-full object-contain" />
                                    <figcaption className="border-t border-stone-200/70 bg-white px-3 py-2 text-[11px] text-stone-500">{activePreview === 'finish' ? `${activeColor} frame finish sample` : activeView?.label}</figcaption>
                                </figure>
                                <div role="group" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Frame visualizer views">
                                    {presentation.views.map((view) => (
                                        <button key={view.id} type="button" onClick={() => setActivePreview(view.id)} aria-label={`Show ${view.label.toLowerCase()}`} aria-pressed={activePreview === view.id}
                                            className={`overflow-hidden rounded-lg border text-left ${activePreview === view.id ? 'border-[#b8964a] ring-1 ring-[#b8964a]/30' : 'border-stone-200 hover:border-stone-400'}`}>
                                            <img src={view.src} alt="" loading="lazy" className="h-14 w-full bg-stone-100 object-cover" />
                                            <span className="block truncate px-2 py-1.5 text-[10px] font-medium text-stone-600">{view.label}</span>
                                        </button>
                                    ))}
                                    {colors.length > 0 && (
                                        <button type="button" onClick={() => setActivePreview('finish')} aria-label={`Show ${activeColor} finish sample`} aria-pressed={activePreview === 'finish'}
                                            className={`overflow-hidden rounded-lg border text-left ${activePreview === 'finish' ? 'border-[#b8964a] ring-1 ring-[#b8964a]/30' : 'border-stone-200 hover:border-stone-400'}`}>
                                            <img src={selectedColorAsset} alt="" loading="lazy" className="h-14 w-full bg-stone-100 object-cover" />
                                            <span className="block truncate px-2 py-1.5 text-[10px] font-medium capitalize text-stone-600">{activeColor} finish</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <section className="mb-5 rounded-2xl bg-stone-50 p-4" aria-label="Product specifications">
                                <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-stone-500">Product specifications</h3>
                                <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                                    {presentation.specs.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[10px] text-stone-400">{label}</dt><dd className="text-xs font-medium leading-5 text-stone-700">{value}</dd></div>)}
                                </dl>
                            </section>
                            {presentation.downloads?.length > 0 && (
                                <section className="mb-5 rounded-2xl border border-stone-200 p-4" aria-label="Additional product assets">
                                    <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-stone-500">Product assets</h3>
                                    <div className="flex flex-col gap-2">
                                        {presentation.downloads.map((asset) => <a key={asset.href} href={asset.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 underline decoration-stone-300 underline-offset-2 hover:text-black">{asset.label}<ExternalLink size={12} /></a>)}
                                    </div>
                                </section>
                            )}
                            <div className="mb-5">
                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-400">Selected product</p>
                                <h2 className="mt-1 text-lg font-bold text-stone-950">{familyDetail.label}</h2>
                                <p className="mt-1 text-xs text-stone-500">{[selected.sizeInches, selected.sizeCm, activeColor, activeWrap ? prettifyWrap(activeWrap) : ''].filter(Boolean).join(' · ')}</p>
                                <p className="mt-1 font-mono text-[10px] text-stone-400">{selected.sku}</p>
                            </div>

                            <div className="space-y-3 border-y border-stone-100 py-4 text-sm">
                                <div className="flex justify-between gap-3 text-stone-600"><span>Prodigi item price</span><span className="font-semibold text-stone-900">{money(selectedMarket.productPrice, selectedMarket.productCurrency)}</span></div>
                                <div className="flex justify-between gap-3 text-stone-600"><span>Standard delivery · {destination === 'JE' ? 'Jersey' : 'UK'}</span><span className="font-semibold text-stone-900">{money(selectedMarket.shippingPrice, selectedMarket.shippingCurrency)}</span></div>
                                {selectedMarket.additionalItemShipping > 0 && <div className="flex justify-between gap-3 text-stone-500"><span>Each additional item · delivery</span><span>{money(selectedMarket.additionalItemShipping, selectedMarket.shippingCurrency)}</span></div>}
                                <div className="flex justify-between gap-3 border-t border-stone-100 pt-3 font-bold text-stone-950"><span>Supplier subtotal*</span><span>{money(lineTotal, selectedMarket.productCurrency)}</span></div>
                            </div>
                            <p className="mt-4 flex items-center gap-2 text-xs text-stone-600"><PackageCheck size={15} className="text-[#947735]" /> Standard shipping: {selectedMarket.deliveryDays.min === selectedMarket.deliveryDays.max ? `${selectedMarket.deliveryDays.min} days` : `${selectedMarket.deliveryDays.min}–${selectedMarket.deliveryDays.max} days`}{selectedMarket.tracked ? ', tracked' : ''}</p>
                            <p className="mt-4 text-[11px] leading-5 text-stone-500">*Wholesale snapshot only: excludes customer-facing markup, applicable taxes/import charges, payment fees, and any shipping upgrade. Confirm current availability and the final destination-specific quote with Prodigi before taking payment.</p>
                        </aside>
                    </div>
                )}

                <footer className="mt-6 flex flex-col gap-3 border-t border-stone-200 pt-4 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
                    <span>Price sheet dated {prodigiCatalog.source.updatedAt} · Prodigi’s listed currency is shown (some UK sizes route from the EU in EUR); live pricing may change.</span>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                        <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-stone-700 hover:text-black">Prodigi price sheet <ExternalLink size={13} /></a>
                        <a href={presentation.page} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-stone-700 hover:text-black">Product details &amp; assets <ExternalLink size={13} /></a>
                    </div>
                </footer>
            </div>
        </main>
    );
}
