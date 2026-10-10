import { useEffect, useState } from 'react';
import { isProdigiOrderable, resolveProdigiSku } from '../data/prodigiSku';
import { getProdigiQuote } from '../services/prodigi';

const IDLE = { status: 'idle' };

// Live Prodigi price for the selected frame and size, shipped to
// `destination`. status is one of:
//   idle         not a Prodigi frame
//   unorderable  a Prodigi frame that can't be ordered yet (Classic, Aluminium)
//   unavailable  Prodigi doesn't make this frame in the selected size
//   loading      fetching the SKU or quote
//   ready        `quote` and `sku` are set
//   error        the quote failed; `message` says why
export function useProdigiQuote(frame, size, destination) {
    // Results are tagged with the selection they belong to, so a stale
    // answer for a previous frame or size never shows as current.
    const [result, setResult] = useState({ key: null });
    const width = size?.width;
    const height = size?.height;
    const orderable = Boolean(frame?.prodigiProduct) && isProdigiOrderable(frame);
    const key = `${frame?.id}|${width}x${height}|${destination}`;

    useEffect(() => {
        if (!orderable) return undefined;
        let cancelled = false;
        (async () => {
            let next;
            try {
                const sku = await resolveProdigiSku(frame, { width, height }, destination);
                if (cancelled) return;
                if (!sku) {
                    next = { status: 'unavailable' };
                } else {
                    const quote = await getProdigiQuote({ sku: sku.sku, attributes: sku.attributes, destinationCountryCode: destination });
                    next = { status: 'ready', sku, quote };
                }
            } catch (error) {
                next = { status: 'error', message: error?.message || 'Could not get a price' };
            }
            if (!cancelled) setResult({ key, ...next });
        })();
        return () => { cancelled = true; };
    }, [orderable, frame, width, height, destination, key]);

    if (!frame?.prodigiProduct) return IDLE;
    if (!orderable) return { status: 'unorderable' };
    if (result.key !== key) return { status: 'loading' };
    return result;
}
