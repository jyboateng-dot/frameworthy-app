#!/usr/bin/env node
/**
 * Saves a self-contained supplier record for every catalogue style: the full
 * local manifest entry, source product-page HTML, and the raw frame-builder
 * configuration (measurements, limits and customizer options). This remains
 * separate from image mirroring so each collection can resume independently.
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'src/data/frameworthy-frame-details.json');
const profilePath = resolve(root, 'src/data/frameRenderProfiles.json');
const archiveDir = resolve(root, 'catalog_downloads/supplier-source-archive/frames');
const indexPath = resolve(root, 'catalog_downloads/supplier-source-archive/frame-record-index.json');
const execFile = promisify(execFileCallback);
const userAgent = 'FrameWorthy-supplier-record-archive/1.0 (licensed catalogue mirror)';
const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));

async function exists(path) {
    try { await access(path, fsConstants.F_OK); return true; }
    catch { return false; }
}

async function fetchBuffer(url) {
    let lastError;
    for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
            const { stdout } = await execFile('curl.exe', [
                '--location', '--silent', '--show-error', '--fail', '--max-time', '60',
                '--user-agent', userAgent, url,
            ], { encoding: 'buffer', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
            return stdout;
        } catch (error) {
            lastError = error;
            await sleep(1_000 * (attempt + 1));
        }
    }
    throw lastError;
}

async function fetchBuilder(sku) {
    let lastError;
    for (const host of ['frameworthy.com', 'www.custompictureframes.com']) {
        const url = `https://${host}/rest/cpf/V1/framebuilder/frameoptionsmanager/getDataByProductSku?isCheckout=0&productSku=${encodeURIComponent(sku)}`;
        try {
            return { url, data: JSON.parse((await fetchBuffer(url)).toString('utf8')) };
        } catch (error) { lastError = error; }
    }
    throw lastError;
}

async function main() {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const profiles = JSON.parse(await readFile(profilePath, 'utf8'));
    await mkdir(archiveDir, { recursive: true });
    const rows = [];
    for (let index = 0; index < manifest.records.length; index += 1) {
        const record = manifest.records[index];
        const dir = join(archiveDir, record.frameworthyFrameId);
        const recordPath = join(dir, 'record.json');
        const pagePath = join(dir, 'supplier-product-page.html');
        const builderPath = join(dir, 'frame-builder.json');
        try {
            await mkdir(dir, { recursive: true });
            const localRecord = {
                archivedAt: new Date().toISOString(),
                frameworthyFrameId: record.frameworthyFrameId,
                supplierRecord: record,
                renderProfile: profiles.profiles?.[record.frameworthyFrameId] || null,
                localArchive: {
                    supplierProductPageHtml: `catalog_downloads/supplier-source-archive/frames/${record.frameworthyFrameId}/supplier-product-page.html`,
                    frameBuilderJson: record.sourceSku ? `catalog_downloads/supplier-source-archive/frames/${record.frameworthyFrameId}/frame-builder.json` : null,
                },
            };
            await writeFile(recordPath, `${JSON.stringify(localRecord, null, 2)}\n`);
            if (record.sourceUrl && !await exists(pagePath)) await writeFile(pagePath, await fetchBuffer(record.sourceUrl));
            let builderStatus = 'not-applicable';
            if (record.sourceSku) {
                if (!await exists(builderPath)) {
                    const builder = await fetchBuilder(record.sourceSku);
                    await writeFile(builderPath, `${JSON.stringify({ sourceUrl: builder.url, retrievedAt: new Date().toISOString(), payload: builder.data }, null, 2)}\n`);
                }
                builderStatus = 'ready';
            }
            rows.push({ frameId: record.frameworthyFrameId, status: 'ready', builderStatus, recordPath: recordPath.slice(root.length + 1).replaceAll('\\', '/') });
            console.log(`[${index + 1}/${manifest.records.length}] ready ${record.frameworthyFrameId}`);
        } catch (error) {
            rows.push({ frameId: record.frameworthyFrameId, status: 'failed', error: error.message, recordPath: recordPath.slice(root.length + 1).replaceAll('\\', '/') });
            console.warn(`[${index + 1}/${manifest.records.length}] failed ${record.frameworthyFrameId}`);
        }
        await sleep(350);
    }
    const index = {
        generatedAt: new Date().toISOString(), totalFrames: rows.length,
        ready: rows.filter(row => row.status === 'ready').length,
        failed: rows.filter(row => row.status === 'failed').length, rows,
    };
    await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
    console.log(JSON.stringify({ total: index.totalFrames, ready: index.ready, failed: index.failed }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
