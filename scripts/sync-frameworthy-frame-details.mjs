#!/usr/bin/env node
/**
 * Licensed supplier catalogue synchronizer.
 *
 * Reads the frame SKUs already used by FrameWorthy, finds their public
 * FrameWorthy.com product records, and writes source facts plus all exposed
 * catalogue image variants to a provenance-preserving JSON manifest. It does
 * not change the customer-facing catalogue or renderer.
 *
 * Run: node scripts/sync-frameworthy-frame-details.mjs
 * Resume: re-run; successfully fetched records are retained.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';

const ROOT = resolve(import.meta.dirname, '..');
const CONSTANTS_PATH = resolve(ROOT, 'src/data/constants.jsx');
const OUTPUT_PATH = resolve(ROOT, 'src/data/frameworthy-frame-details.json');
const SITEMAP_URL = 'https://frameworthy.com/media/sitemap/sitemap.xml';
const FETCH_OPTIONS = {
    headers: {
        'User-Agent': 'FrameWorthy-catalog-sync/1.0 (licensed catalogue ingest)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
};
const STOP_WORDS = new Set(['a', 'an', 'and', 'with', 'the', 'picture', 'frame', 'frames', 'wood', 'style']);
const execFile = promisify(execFileCallback);

const sleep = (ms) => new Promise(resolveSleep => setTimeout(resolveSleep, ms));
const decode = (value = '') => value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const stripHtml = (value) => decode(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
const field = (body, name) => body.match(new RegExp(`${name}:\\s*'([^']*)'`))?.[1] ?? null;

function readCurrentFrames(source) {
    const frames = [];
    for (const match of source.matchAll(/\{\s*id:\s*'([^']+)'([\s\S]*?)\n\s*\},/g)) {
        const [, id, body] = match;
        const name = field(body, 'name');
        if (!name || /isCanvas:\s*true/.test(body)) continue;
        frames.push({ id, name, filename: field(body, 'filename'), previewImg: field(body, 'previewImg') });
    }
    return frames;
}

function terms(value) {
    return new Set(decode(value).toLowerCase().replace(/\.html$/i, '').replace(/[^a-z0-9]+/g, ' ')
        .split(' ').filter(token => token.length > 1 && !STOP_WORDS.has(token)));
}

function scoreCandidate(frame, url) {
    const wanted = terms(frame.name);
    const candidate = terms(new URL(url).pathname);
    const overlap = [...wanted].filter(token => candidate.has(token)).length;
    const union = new Set([...wanted, ...candidate]).size;
    const exact = [...wanted].every(token => candidate.has(token));
    return (overlap / Math.max(wanted.size, 1)) * 0.8 + (overlap / Math.max(union, 1)) * 0.2 + (exact ? 0.15 : 0);
}

function findProductUrl(frame, urls) {
    const scored = urls.map(url => ({ url, score: scoreCandidate(frame, url) }))
        .filter(candidate => candidate.score >= 0.55)
        .sort((a, b) => b.score - a.score || a.url.length - b.url.length);
    const best = scored[0];
    if (!best) return null;
    const second = scored[1];
    return {
        ...best,
        // Keep borderline, ambiguous matches out of the automatic ingest.
        confident: best.score >= 0.82 && (!second || best.score - second.score >= 0.08),
        alternatives: scored.slice(1, 4),
    };
}

function filenameKey(value) {
    return (value || '').split('/').pop().replace(/\.(?:jpe?g|webp|png)$/i, '').toLowerCase();
}

function parseListingPage(html) {
    const records = [];
    // A product card is self-contained in FrameWorthy.com's Hyvä listing
    // markup. Restricting extraction to each card avoids navigation/menu links.
    // The card wrapper's other attributes vary by page, but its x-data value
    // is stable. Splitting on that attribute (not the entire opening tag)
    // keeps every product card separate.
    for (const block of html.split(/x-data="productItem\d+\(\)"/i).slice(1)) {
        const productUrl = block.match(/https:\/\/frameworthy\.com\/([^'"?\s]+\.html)/i)?.[0];
        if (!productUrl) continue;
        const imageUrls = [...block.matchAll(/https?:\\?\/\\?\/frameworthy\.com\\?\/media\\?\/catalog\\?\/product[^"'\s<\\]*/gi)]
            .map(match => decode(match[0]).replace(/\\\//g, '/').replace(/\\/g, ''));
        for (const imageUrl of imageUrls) records.push({ imageUrl, productUrl });
    }
    return records;
}

async function loadListingIndex() {
    const index = new Map();
    // The supplier catalogue currently contains about 350 picture-frame SKUs.
    // Ten 36-card pages cover it without requesting an unsupported huge page.
    for (let page = 1; page <= 10; page += 1) {
        const url = `https://frameworthy.com/custom-picture-frames.html?product_list_limit=36&product_list_order=name&p=${page}`;
        const html = await fetchText(url);
        const items = parseListingPage(html);
        console.log(`Listing page ${page}: ${items.length} media references.`);
        for (const item of items) {
            const key = filenameKey(item.imageUrl);
            if (key && !index.has(key)) index.set(key, item);
        }
        if (items.length === 0) break;
        await sleep(750);
    }
    return index;
}

function parseProductPage(html, sourceUrl) {
    const details = {};
    for (const match of html.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>/gi)) {
        const key = stripHtml(match[1]);
        const value = stripHtml(match[2]);
        if (key && value) details[key] = value;
    }
    const first = (pattern) => decode(html.match(pattern)?.[1] ?? '').replace(/\\\//g, '/');
    const productName = details['Product Name'] || first(/<meta name="title" content="([^"|]+?)(?:\s*\||")/i);
    const sku = first(/"SKU":"([^"]+)"/i);
    const productId = first(/"ProductID":"([^"]+)"/i);
    const categories = first(/"Categories":(\[[^\]]*\])/i);
    const imageUrls = [...html.matchAll(/https?:\\?\/\\?\/frameworthy\.com\\?\/media\\?\/catalog\\?\/product[^"'\s<\\]*/gi)]
        .map(match => decode(match[0]).replace(/\\\//g, '/').replace(/\\/g, ''));
    const uniqueImages = [...new Set(imageUrls)].map(url => ({
        url,
        role: /corner|_b\.|_c\.|angle/i.test(url) ? 'corner-or-angle' : /_a(?:_|\.)/i.test(url) ? 'primary-or-rail' : 'gallery',
    }));
    return {
        sourceUrl,
        sourceProductId: productId || null,
        sourceSku: sku || null,
        productName: productName || null,
        categories: categories ? JSON.parse(categories) : [],
        details,
        images: uniqueImages,
    };
}

async function fetchText(url) {
    // FrameWorthy.com's Cloudflare edge rejects Node's default fetch client,
    // while it accepts the same licensed, identified request via curl. Curl
    // also gives us reliable, bounded retry behaviour for a long resume-safe
    // catalogue run on Windows.
    let lastError;
    for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
            const { stdout } = await execFile('curl.exe', [
                '--location', '--silent', '--show-error', '--fail',
                '--retry', '2', '--retry-delay', '3', '--max-time', '35',
                '--user-agent', FETCH_OPTIONS.headers['User-Agent'],
                url,
            ], { maxBuffer: 16 * 1024 * 1024, windowsHide: true });
            return stdout;
        } catch (error) {
            lastError = error;
            const waitMs = Math.min(60_000, 5_000 * (2 ** attempt));
            console.warn(`Fetch attempt ${attempt + 1}/6 failed for ${url}; retrying in ${Math.round(waitMs / 1000)}s.`);
            await sleep(waitMs);
        }
    }
    throw lastError;
}

async function fetchBinary(url) {
    let lastError;
    for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
            const { stdout } = await execFile('curl.exe', [
                '--location', '--silent', '--show-error', '--fail', '--max-time', '35',
                '--user-agent', FETCH_OPTIONS.headers['User-Agent'], url,
            ], { maxBuffer: 16 * 1024 * 1024, windowsHide: true, encoding: 'buffer' });
            return stdout;
        } catch (error) {
            lastError = error;
            await sleep(5_000 * (attempt + 1));
        }
    }
    throw lastError;
}

async function imageSimilarity(localPath, remoteUrl) {
    const remote = await fetchBinary(remoteUrl);
    const fingerprint = (input) => sharp(input)
        .rotate()
        .resize(48, 48, { fit: 'fill' })
        .removeAlpha()
        .grayscale()
        .raw()
        .toBuffer();
    const [localPixels, remotePixels] = await Promise.all([fingerprint(localPath), fingerprint(remote)]);
    let difference = 0;
    for (let i = 0; i < localPixels.length; i += 1) difference += Math.abs(localPixels[i] - remotePixels[i]);
    return 1 - difference / (localPixels.length * 255);
}

async function saveManifest({ records, unresolved }) {
    const payload = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        source: { name: 'FrameWorthy.com licensed catalogue', sitemap: SITEMAP_URL },
        records,
        unresolved,
    };
    await mkdir(dirname(OUTPUT_PATH), { recursive: true });
    const body = `${JSON.stringify(payload, null, 2)}\n`;
    // Keep an intact checkpoint before replacing a large generated manifest.
    // If Windows interrupts the second write, recovery can resume from this
    // sidecar rather than losing every previously ingested record.
    await writeFile(`${OUTPUT_PATH}.bak`, body);
    await writeFile(OUTPUT_PATH, body);
}

async function main() {
    const constants = await readFile(CONSTANTS_PATH, 'utf8');
    const frames = readCurrentFrames(constants);
    const previous = await readFile(OUTPUT_PATH, 'utf8').then(JSON.parse).catch(() => ({ records: [], unresolved: [] }));
    const existing = new Map(previous.records.map(record => [record.frameworthyFrameId, record]));

    console.log(`Reading supplier sitemap for ${frames.length} active non-canvas frames...`);
    const sitemap = await fetchText(SITEMAP_URL);
    const urls = [...sitemap.matchAll(/<loc>(https:\/\/frameworthy\.com\/[^<]+\.html)<\/loc>/g)].map(match => decode(match[1]));
    console.log(`Found ${urls.length} product-like URLs.`);

    const candidates = frames.map(frame => ({ frame, match: findProductUrl(frame, urls) }));
    const visualVerify = process.argv.includes('--visual-verify');
    if (process.argv.includes('--filename-pass')) {
        console.log('Building supplier filename-to-product index for abbreviated catalogue names...');
        const listingIndex = await loadListingIndex();
        for (const candidate of candidates) {
            if (candidate.match?.confident) continue;
            const listing = listingIndex.get(filenameKey(candidate.frame.filename));
            if (listing) candidate.match = {
                url: listing.productUrl,
                listingImageUrl: listing.imageUrl,
                score: 1,
                confident: true,
                alternatives: [],
            };
        }
        console.log(`Filename index contains ${listingIndex.size} unique supplier image names.`);
    }
    const toFetch = candidates.filter(({ frame, match }) => match?.confident && !existing.has(frame.id));
    const unresolved = candidates.filter(({ frame, match }) => !match?.confident).map(({ frame, match }) => ({
        ...frame,
        reason: match ? 'ambiguous-name-match' : 'no-name-match',
        candidates: match ? [{ url: match.url, score: Number(match.score.toFixed(3)) }, ...match.alternatives.map(item => ({ url: item.url, score: Number(item.score.toFixed(3)) }))] : [],
    }));
    console.log(`Matched ${candidates.length - unresolved.length}; fetching ${toFetch.length}; unresolved ${unresolved.length}.`);
    await saveManifest({ records: frames.map(frame => existing.get(frame.id)).filter(Boolean), unresolved });

    for (let index = 0; index < toFetch.length; index += 1) {
        const { frame, match } = toFetch[index];
        try {
            const page = await fetchText(match.url);
            const product = parseProductPage(page, match.url);
            // A filename-derived mapping must prove itself against the product
            // page gallery before it is allowed into the renderer source data.
            // This guards against listing-markup changes accidentally pairing
            // an image rail with a neighbouring product card.
            const localImage = resolve(ROOT, 'public', 'frames', frame.filename || '');
            let listingImageMatch = null;
            if (match.score === 1 && visualVerify && match.listingImageUrl && existsSync(localImage)) {
                listingImageMatch = await imageSimilarity(localImage, match.listingImageUrl);
                if (listingImageMatch < 0.93) {
                    console.warn(`[${index + 1}/${toFetch.length}] rejected ${frame.id}: listing image similarity ${listingImageMatch.toFixed(3)}`);
                    unresolved.push({
                        ...frame,
                        reason: 'listing-image-mismatch',
                        candidates: [{ url: match.url, score: Number(listingImageMatch.toFixed(3)) }],
                    });
                    continue;
                }
            }
            if (match.score === 1 && !listingImageMatch && !product.images.some(image => filenameKey(image.url) === filenameKey(frame.filename))) {
                console.warn(`[${index + 1}/${toFetch.length}] rejected ${frame.id}: gallery did not contain ${frame.filename}`);
                unresolved.push({
                    ...frame,
                    reason: 'gallery-filename-mismatch',
                    candidates: [{ url: match.url, score: Number(match.score.toFixed(3)) }],
                });
                continue;
            }
            existing.set(frame.id, {
                frameworthyFrameId: frame.id,
                currentName: frame.name,
                currentFilename: frame.filename,
                currentPreview: frame.previewImg,
                matchConfidence: Number(match.score.toFixed(3)),
                fetchedAt: new Date().toISOString(),
                listingImageUrl: match.listingImageUrl || null,
                imageMatchScore: listingImageMatch === null ? null : Number(listingImageMatch.toFixed(4)),
                ...product,
            });
            await saveManifest({ records: frames.map(currentFrame => existing.get(currentFrame.id)).filter(Boolean), unresolved });
            console.log(`[${index + 1}/${toFetch.length}] ${frame.id} ← ${product.productName || match.url}`);
        } catch (error) {
            console.warn(`[${index + 1}/${toFetch.length}] failed ${frame.id}: ${error.message}`);
            unresolved.push({
                ...frame,
                reason: 'source-fetch-failed',
                candidates: [{ url: match.url, score: Number(match.score.toFixed(3)) }],
            });
        }
        // One deliberate, sequential request at a time avoids stressing the
        // licensed supplier's Magento/Cloudflare origin and is resume-safe.
        await sleep(450);
    }

    const records = frames.map(frame => existing.get(frame.id)).filter(Boolean);
    await saveManifest({ records, unresolved });
    console.log(`Wrote ${records.length} records to ${OUTPUT_PATH}; ${unresolved.length} still require a mapping review.`);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
