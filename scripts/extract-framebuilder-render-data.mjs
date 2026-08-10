#!/usr/bin/env node
/**
 * Retrieves the source data used by the licensed supplier's own frame
 * builder. Product galleries can contain only perspective photography, while
 * this endpoint supplies a rectified straight-on moulding rail (`picture`) and
 * the same physical limits/dimensions used by its customizer.
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
const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));
const userAgent = 'FrameWorthy-framebuilder-ingest/1.0 (licensed catalogue ingest)';

async function fetchBinary(url) {
    let lastError;
    for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
            const { stdout } = await execFile('curl.exe', [
                '--location', '--silent', '--show-error', '--fail', '--max-time', '45',
                '--user-agent', userAgent, url,
            ], { maxBuffer: 32 * 1024 * 1024, windowsHide: true, encoding: 'buffer' });
            return stdout;
        } catch (error) {
            lastError = error;
            await sleep(1_000 * (attempt + 1));
        }
    }
    throw lastError;
}

async function fetchJson(url) {
    return JSON.parse((await fetchBinary(url)).toString('utf8'));
}

async function saveManifest(data) {
    data.generatedAt = new Date().toISOString();
    const body = `${JSON.stringify(data, null, 2)}\n`;
    // Keep a valid checkpoint before replacing the large generated manifest.
    await writeFile(`${manifestPath}.bak`, body);
    await writeFile(manifestPath, body);
}

function parseFraction(value) {
    if (value == null) return null;
    const text = String(value).trim();
    if (!text) return null;
    const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    const fraction = text.match(/^(\d+)\/(\d+)$/);
    if (fraction) return Number(fraction[1]) / Number(fraction[2]);
    const numeric = Number(text);
    return Number.isFinite(numeric) ? numeric : null;
}

function builderEndpoint(host, sku) {
    return `https://${host}/rest/cpf/V1/framebuilder/frameoptionsmanager/getDataByProductSku?isCheckout=0&productSku=${encodeURIComponent(sku)}`;
}

async function fetchBuilderJson(sku) {
    const hosts = ['frameworthy.com', 'www.custompictureframes.com'];
    let lastError;
    for (const host of hosts) {
        const sourceUrl = builderEndpoint(host, sku);
        try {
            const payload = await fetchJson(sourceUrl);
            // The endpoint nests mats under `framebuilder`, but exposes the
            // selected frame's picture and physical sizes at the response root.
            if (payload.picture) return { payload, sourceUrl };
            lastError = new Error('frame-builder response has no straight-on picture');
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}

async function saveRail(pictureUrl, id) {
    const binary = await fetchBinary(pictureUrl);
    await sharp(binary).rotate().resize({ width: 1800, height: 420, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 90, smartSubsample: true })
        .toFile(resolve(assetDir, `${id}-front-h.webp`));
    await sharp(binary).rotate().rotate(90).resize({ width: 420, height: 1800, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 90, smartSubsample: true })
        .toFile(resolve(assetDir, `${id}-front-v.webp`));
}

function measurementFromBuilder(sizes, existing) {
    const width = parseFraction(sizes?.mouldingWidthFraction ?? sizes?.mouldingWidth);
    const depth = parseFraction(sizes?.depth);
    if (!width && !depth) return existing || null;
    return {
        ...existing,
        mouldingWidth: width ? { inches: width, millimetres: Number((width * 25.4).toFixed(3)), display: `${width} in` } : existing?.mouldingWidth,
        rabbetDepth: depth ? { inches: depth, millimetres: Number((depth * 25.4).toFixed(3)), display: `${sizes.depth} in` } : existing?.rabbetDepth,
        evidence: { source: 'supplier frame-builder API', sku: sizes?.sku },
    };
}

async function main() {
    const onlyFrame = process.argv.find(argument => argument.startsWith('--frame='))?.slice('--frame='.length);
    const onlyFailed = process.argv.includes('--only-failed');
    const data = JSON.parse(await readFile(manifestPath, 'utf8'));
    await mkdir(assetDir, { recursive: true });
    const work = data.records.filter(record =>
        record.sourceSku && !record.renderAssets?.front?.localHorizontalPath
        && (!onlyFailed || record.frameBuilderAssetStatus === 'source-fetch-failed')
        && (!onlyFrame || record.frameworthyFrameId === onlyFrame),
    );
    console.log(`Retrieving frame-builder rails and dimensions for ${work.length} records.`);

    for (let index = 0; index < work.length; index += 1) {
        const record = work[index];
        try {
            const { payload, sourceUrl: builderSourceUrl } = await fetchBuilderJson(record.sourceSku);
            const builder = payload;
            const pictureUrl = builder.picture;
            if (!pictureUrl) throw new Error('frame-builder response has no straight-on picture');
            await saveRail(pictureUrl, record.frameworthyFrameId);
            const existingAssets = record.renderAssets || {};
            record.renderAssets = {
                ...existingAssets,
                schemaVersion: 2,
                front: {
                    localHorizontalPath: `/frames/render-assets/${record.frameworthyFrameId}-front-h.webp`,
                    localVerticalPath: `/frames/render-assets/${record.frameworthyFrameId}-front-v.webp`,
                    sourceUrl: pictureUrl,
                    derivedFromCompleteFrame: false,
                    source: 'supplier-frame-builder',
                },
                builder: {
                    sourceUrl: builderSourceUrl,
                    pictureUrl,
                    mouldingWidthIn: parseFraction(builder.sizes?.mouldingWidthFraction ?? builder.sizes?.mouldingWidth),
                    rabbetDepthIn: parseFraction(builder.sizes?.depth),
                    maxArtworkWidthIn: parseFraction(builder.sizes?.maxArtworkWidthSize),
                    maxArtworkHeightIn: parseFraction(builder.sizes?.maxArtworkHeightSize),
                },
                status: 'front-ready',
            };
            record.customizerMeasurements = measurementFromBuilder(builder.sizes, record.customizerMeasurements);
            delete record.frameBuilderAssetStatus;
            delete record.frameBuilderAssetError;
            await saveManifest(data);
            console.log(`[${index + 1}/${work.length}] ${record.frameworthyFrameId}: front-ready`);
        } catch (error) {
            record.frameBuilderAssetStatus = 'source-fetch-failed';
            record.frameBuilderAssetError = error.message;
            await saveManifest(data);
            console.warn(`[${index + 1}/${work.length}] ${record.frameworthyFrameId}: ${error.message}`);
        }
        await sleep(400);
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
