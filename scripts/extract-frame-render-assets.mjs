#!/usr/bin/env node
/**
 * Extracts renderer-specific assets from the licensed supplier gallery.
 *
 * The supplier's `framingengine` image is a rectified, front-on frame that
 * feeds 2D nine-slice composition. Corner and profile photos are retained as
 * 3D references. Front assets are converted to local WebP so the visualizer
 * never needs cross-origin image access at runtime.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'src/data/frameworthy-frame-details.json');
const assetDir = resolve(root, 'public/frames/render-assets');
const execFile = promisify(execFileCallback);
const sleep = (ms) => new Promise(resolveSleep => setTimeout(resolveSleep, ms));
const userAgent = 'FrameWorthy-render-asset-sync/1.0 (licensed catalogue ingest)';

async function fetchText(url) {
    let lastError;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
            const { stdout } = await execFile('curl.exe', [
                '--location', '--silent', '--show-error', '--fail', '--max-time', '35',
                '--user-agent', userAgent, url,
            ], { maxBuffer: 16 * 1024 * 1024, windowsHide: true });
            return stdout;
        } catch (error) {
            lastError = error;
            await sleep(1_500 * (attempt + 1));
        }
    }
    throw lastError;
}

async function fetchBinary(url) {
    let lastError;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
            const { stdout } = await execFile('curl.exe', [
                '--location', '--silent', '--show-error', '--fail', '--max-time', '45',
                '--user-agent', userAgent, url,
            ], { maxBuffer: 32 * 1024 * 1024, windowsHide: true, encoding: 'buffer' });
            return stdout;
        } catch (error) {
            lastError = error;
            await sleep(1_500 * (attempt + 1));
        }
    }
    throw lastError;
}

function galleryPayload(html) {
    const marker = '"initialImages":';
    const start = html.indexOf(marker);
    if (start < 0) return [];
    const source = html.slice(start + marker.length);
    let depth = 0;
    let inQuote = false;
    let escaped = false;
    for (let index = 0; index < source.length; index += 1) {
        const char = source[index];
        if (inQuote) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') inQuote = false;
            continue;
        }
        if (char === '"') { inQuote = true; continue; }
        if (char === '[') depth += 1;
        if (char === ']' && --depth === 0) {
            try { return JSON.parse(source.slice(0, index + 1).replace(/\\\//g, '/')); }
            catch { return []; }
        }
    }
    return [];
}

function roles(images) {
    // Keep the supplier's gallery order: its main/flat product view is
    // normally listed before angled detail shots, even on older products
    // whose filenames do not describe the view.
    const urls = images
        .map((image, index) => ({ url: image.full || image.img, isMain: Boolean(image.isMain), index }))
        .filter(entry => entry.url)
        .sort((a, b) => Number(b.isMain) - Number(a.isMain) || a.index - b.index);
    const unique = [...new Map(urls.map(entry => [entry.url, entry.url])).values()];
    const pick = (test) => unique.find(url => test.test(url)) || null;
    return {
        // This is the supplier's own flat, rectangular framing preview.
        frontSourceUrl: pick(/framingengine/i),
        // Some older products expose a complete flat frame rather than an
        // individual rail. It is still a strong 2D source: rails are derived
        // from the clean middle of each side, while its mitred corners remain
        // available for the eventual nine-slice compositor.
        completeFrameSourceUrl: pick(/imagemanipulator.*default_swap|(?:complete|full)[-_]?(?:frame|preview)/i),
        profileSourceUrl: pick(/profile/i),
        cornerSourceUrls: unique.filter(url => /corner|_b\.(?:jpe?g|webp)$/i.test(url)),
        gallerySourceUrls: unique,
    };
}

async function saveManifest(data) {
    data.generatedAt = new Date().toISOString();
    const body = `${JSON.stringify(data, null, 2)}\n`;
    // Windows antivirus/indexing can briefly lock this large generated file.
    // Retrying preserves the resumable ingest instead of treating that local
    // transient as a supplier-data failure.
    let lastError;
    for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
            await writeFile(`${manifestPath}.bak`, body);
            await writeFile(manifestPath, body);
            return;
        } catch (error) {
            lastError = error;
            await sleep(300 * (attempt + 1));
        }
    }
    throw lastError;
}

async function saveWebp(sourceUrl, fileName, { rotate = false } = {}) {
    const binary = await fetchBinary(sourceUrl);
    let image = sharp(binary).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true });
    if (rotate) image = image.rotate(90);
    await image.webp({ quality: 90, smartSubsample: true }).toFile(resolve(assetDir, fileName));
}

function isFramePixel(r, g, b, alpha) {
    if (alpha < 16) return false;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    // Pure white is the supplier's studio background/opening; coloured,
    // metallic, textured, and darker neutral mouldings all remain detected.
    return max < 244 || max - min > 13;
}

async function deriveRailsFromCompleteFrame(sourceUrl, id, suppliedBinary = null) {
    const binary = suppliedBinary || await fetchBinary(sourceUrl);
    const { data, info } = await sharp(binary).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const at = (x, y) => {
        const offset = (y * info.width + x) * 4;
        return isFramePixel(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
    };
    // Determine each boundary where a straight rail actually crosses the
    // horizontal/vertical centreline. Bounding-box extremes are often a
    // miter tip, so using them makes otherwise valid complete frames fail.
    const midX = Math.floor(info.width / 2);
    const midY = Math.floor(info.height / 2);
    const first = (limit, test) => {
        for (let position = 0; position < limit; position += 1) if (test(position)) return position;
        return -1;
    };
    const last = (limit, test) => {
        for (let position = limit - 1; position >= 0; position -= 1) if (test(position)) return position;
        return -1;
    };
    const top = first(midY, y => at(midX, y));
    const bottom = last(info.height, y => at(midX, y));
    const left = first(midX, x => at(x, midY));
    const right = last(info.width, x => at(x, midY));
    if (top < 0 || bottom <= top || left < 0 || right <= left) return null;
    let innerTop = top;
    while (innerTop < midY && at(midX, innerTop)) innerTop += 1;
    let innerLeft = left;
    while (innerLeft < midX && at(innerLeft, midY)) innerLeft += 1;
    const railH = innerTop - top;
    const railW = innerLeft - left;
    if (railH < 3 || railW < 3) return null;
    const insetX = Math.min(Math.round(railW * 1.5), Math.round((right - left) * 0.2));
    const insetY = Math.min(Math.round(railH * 1.5), Math.round((bottom - top) * 0.2));
    const horizontal = sharp(binary).rotate().extract({
        left: left + insetX, top, width: Math.max(1, right - left - insetX * 2 + 1), height: railH,
    }).resize({ width: 1800, height: 320, fit: 'inside', withoutEnlargement: true });
    const vertical = sharp(binary).rotate().extract({
        left, top: top + insetY, width: railW, height: Math.max(1, bottom - top - insetY * 2 + 1),
    }).resize({ width: 320, height: 1800, fit: 'inside', withoutEnlargement: true });
    await horizontal.webp({ quality: 90, smartSubsample: true }).toFile(resolve(assetDir, `${id}-front-h.webp`));
    await vertical.webp({ quality: 90, smartSubsample: true }).toFile(resolve(assetDir, `${id}-front-v.webp`));
    return { sourceUrl, railH, railW, derived: true };
}

async function flatFrameScore(binary) {
    const { data, info } = await sharp(binary).rotate().resize(160, 160, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const coverage = (x0, y0, x1, y1) => {
        let marked = 0;
        let total = 0;
        for (let y = y0; y < y1; y += 1) {
            for (let x = x0; x < x1; x += 1) {
                const offset = (y * info.width + x) * 4;
                if (isFramePixel(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) marked += 1;
                total += 1;
            }
        }
        return marked / Math.max(total, 1);
    };
    const bands = [
        coverage(52, 0, 108, 48),   // top rail through its straight middle
        coverage(52, 112, 108, 160), // bottom rail
        coverage(0, 52, 48, 108),   // left rail
        coverage(112, 52, 160, 108), // right rail
    ];
    const centre = coverage(60, 60, 100, 100);
    const sides = bands.filter(value => value > 0.018).length;
    // A genuine front-on frame has all four side bands but a mostly-empty
    // opening. A perspective corner normally produces only one or two bands.
    return { score: sides - centre, sides, centre };
}

async function recoverCompleteFrame(images) {
    for (const sourceUrl of images) {
        try {
            const binary = await fetchBinary(sourceUrl);
            const result = await flatFrameScore(binary);
            if (result.sides === 4 && result.centre < 0.18) return { sourceUrl, binary, ...result };
        } catch {
            // Individual gallery files occasionally receive a transient CDN
            // error; continue checking the other supplier-provided views.
        }
    }
    return null;
}

async function main() {
    const onlyFrame = process.argv.find(argument => argument.startsWith('--frame='))?.slice('--frame='.length);
    const onlyMissingFlat = process.argv.includes('--only-missing-flat');
    const onlyFailed = process.argv.includes('--only-failed');
    const data = JSON.parse(await readFile(manifestPath, 'utf8'));
    await mkdir(assetDir, { recursive: true });
    const work = data.records.filter(record =>
        record.sourceUrl && (!record.renderAssets?.front?.localHorizontalPath || !record.renderAssets?.profile?.localPath)
        && (!onlyMissingFlat || !record.renderAssets?.front?.localHorizontalPath)
        && (!onlyFailed || record.renderAssets?.status === 'source-fetch-failed')
        && (!onlyFrame || record.frameworthyFrameId === onlyFrame),
    );
    console.log(`Extracting renderer assets for ${work.length} records.`);

    for (let index = 0; index < work.length; index += 1) {
            const record = work[index];
        try {
            const html = await fetchText(record.sourceUrl);
            const assets = roles(galleryPayload(html));
            const recoveredComplete = !assets.frontSourceUrl && !assets.completeFrameSourceUrl
                ? await recoverCompleteFrame(assets.gallerySourceUrls)
                : null;
            const completeFrameSourceUrl = assets.completeFrameSourceUrl || recoveredComplete?.sourceUrl || null;
            const railSourceUrl = assets.frontSourceUrl || completeFrameSourceUrl;
            const existingFront = record.renderAssets?.front;
            const localHorizontalPath = existingFront?.localHorizontalPath || (railSourceUrl
                ? `/frames/render-assets/${record.frameworthyFrameId}-front-h.webp`
                : null);
            const localVerticalPath = existingFront?.localVerticalPath || (railSourceUrl
                ? `/frames/render-assets/${record.frameworthyFrameId}-front-v.webp`
                : null);
            if (!existingFront?.localHorizontalPath && assets.frontSourceUrl) {
                await saveWebp(assets.frontSourceUrl, `${record.frameworthyFrameId}-front-h.webp`);
                await saveWebp(assets.frontSourceUrl, `${record.frameworthyFrameId}-front-v.webp`, { rotate: true });
            } else if (!existingFront?.localHorizontalPath && completeFrameSourceUrl) {
                const derived = await deriveRailsFromCompleteFrame(completeFrameSourceUrl, record.frameworthyFrameId, recoveredComplete?.binary);
                if (!derived) throw new Error('could not derive straight rails from complete frame image');
            }
            const profileLocalPath = assets.profileSourceUrl
                ? `/frames/render-assets/${record.frameworthyFrameId}-profile.webp`
                : null;
            if (assets.profileSourceUrl) await saveWebp(assets.profileSourceUrl, `${record.frameworthyFrameId}-profile.webp`);
            const corners = [];
            for (let cornerIndex = 0; cornerIndex < assets.cornerSourceUrls.length; cornerIndex += 1) {
                const sourceUrl = assets.cornerSourceUrls[cornerIndex];
                const localPath = `/frames/render-assets/${record.frameworthyFrameId}-corner-${cornerIndex + 1}.webp`;
                await saveWebp(sourceUrl, `${record.frameworthyFrameId}-corner-${cornerIndex + 1}.webp`);
                corners.push({ sourceUrl, localPath });
            }
            record.renderAssets = {
                schemaVersion: 1,
                front: localHorizontalPath ? {
                    localHorizontalPath,
                    localVerticalPath,
                    sourceUrl: existingFront?.sourceUrl || railSourceUrl,
                    derivedFromCompleteFrame: existingFront?.derivedFromCompleteFrame ?? !assets.frontSourceUrl,
                } : null,
                profile: profileLocalPath ? { sourceUrl: assets.profileSourceUrl, localPath: profileLocalPath } : null,
                corners,
                galleryCount: assets.gallerySourceUrls.length,
                status: localHorizontalPath ? 'front-ready' : 'no-flat-front-image',
            };
            await saveManifest(data);
            console.log(`[${index + 1}/${work.length}] ${record.frameworthyFrameId}: ${record.renderAssets.status}`);
        } catch (error) {
            record.renderAssets = { schemaVersion: 1, status: 'source-fetch-failed', error: error.message };
            await saveManifest(data);
            console.warn(`[${index + 1}/${work.length}] ${record.frameworthyFrameId}: ${error.message}`);
        }
        await sleep(500);
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
