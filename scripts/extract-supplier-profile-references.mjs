#!/usr/bin/env node
/**
 * Archives every supplier detail/perspective image for styles that do not yet
 * have a named profile image. Product galleries use inconsistent filenames,
 * so the full visual reference set is retained rather than guessing away
 * potentially useful 3D information.
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
const userAgent = 'FrameWorthy-profile-reference-ingest/1.0 (licensed catalogue ingest)';
const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));

async function fetchBuffer(url) {
    let lastError;
    for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
            const { stdout } = await execFile('curl.exe', ['--location', '--silent', '--show-error', '--fail', '--max-time', '60', '--user-agent', userAgent, url], { encoding: 'buffer', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
            return stdout;
        } catch (error) { lastError = error; await sleep(1_000 * (attempt + 1)); }
    }
    throw lastError;
}

function galleryPayload(html) {
    const marker = '"initialImages":';
    const start = html.indexOf(marker);
    if (start < 0) return [];
    const source = html.slice(start + marker.length);
    let depth = 0; let inQuote = false; let escaped = false;
    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];
        if (inQuote) { if (escaped) escaped = false; else if (character === '\\') escaped = true; else if (character === '"') inQuote = false; continue; }
        if (character === '"') { inQuote = true; continue; }
        if (character === '[') depth += 1;
        if (character === ']' && --depth === 0) { try { return JSON.parse(source.slice(0, index + 1).replace(/\\\//g, '/')); } catch { return []; } }
    }
    return [];
}

async function saveManifest(data) {
    data.generatedAt = new Date().toISOString();
    const body = `${JSON.stringify(data, null, 2)}\n`;
    await writeFile(`${manifestPath}.bak`, body);
    await writeFile(manifestPath, body);
}

async function saveWebp(url, fileName) {
    await sharp(await fetchBuffer(url)).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 90, smartSubsample: true }).toFile(resolve(assetDir, fileName));
}

async function main() {
    const data = JSON.parse(await readFile(manifestPath, 'utf8'));
    await mkdir(assetDir, { recursive: true });
    const work = data.records.filter(record => !record.renderAssets?.profileReferences?.length);
    console.log(`Extracting supplier profile-reference sets for ${work.length} styles.`);
    for (let index = 0; index < work.length; index += 1) {
        const record = work[index];
        try {
            const images = galleryPayload((await fetchBuffer(record.sourceUrl)).toString('utf8'));
            const detailImages = images.filter(image => !image.isMain && image.full)
                .filter(image => !/framingengine|imagemanipulator.*default_swap/i.test(image.full));
            const unique = [...new Map(detailImages.map(image => [image.full, image])).values()];
            const refs = [];
            for (let refIndex = 0; refIndex < unique.length; refIndex += 1) {
                const image = unique[refIndex];
                const localPath = `/frames/render-assets/${record.frameworthyFrameId}-profile-reference-${refIndex + 1}.webp`;
                await saveWebp(image.full, `${record.frameworthyFrameId}-profile-reference-${refIndex + 1}.webp`);
                refs.push({ sourceUrl: image.full, localPath, caption: image.caption || '', position: image.position || '' });
            }
            record.renderAssets = { ...(record.renderAssets || {}), profileReferences: refs };
            await saveManifest(data);
            console.log(`[${index + 1}/${work.length}] ${record.frameworthyFrameId}: ${refs.length} references`);
        } catch (error) {
            record.profileReferenceStatus = 'source-fetch-failed';
            record.profileReferenceError = error.message;
            await saveManifest(data);
            console.warn(`[${index + 1}/${work.length}] ${record.frameworthyFrameId}: ${error.message}`);
        }
        await sleep(500);
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
