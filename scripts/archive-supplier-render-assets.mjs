#!/usr/bin/env node
/**
 * Mirrors every unique supplier image referenced by the local catalogue into
 * a resumable local archive. The manifest already preserves descriptions and
 * physical details; this archive makes the visual source set independent of
 * future supplier-page availability.
 */
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'src/data/frameworthy-frame-details.json');
const archiveDir = resolve(root, 'catalog_downloads/supplier-source-archive');
const indexPath = resolve(archiveDir, 'index.json');
const execFile = promisify(execFileCallback);
const userAgent = 'FrameWorthy-supplier-archive/1.0 (licensed catalogue mirror)';
const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));

const canonicalUrl = value => String(value || '')
    .replace(/\/media\/catalog\/product\/cache\/[^/]+\//, '/media/catalog/product/')
    .replace(/\?.*$/, '');

function archivePathFor(url) {
    const parsed = new URL(url);
    const safeHost = parsed.hostname.replace(/[^a-z0-9.-]/gi, '_');
    const parts = parsed.pathname.split('/').filter(Boolean).map(part => part.replace(/[^a-z0-9._-]/gi, '_'));
    return join(archiveDir, safeHost, ...parts);
}

async function exists(path) {
    try { await access(path, fsConstants.F_OK); return true; }
    catch { return false; }
}

async function fetchFile(url, destination) {
    let lastError;
    for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
            await mkdir(resolve(destination, '..'), { recursive: true });
            await execFile('curl.exe', [
                '--location', '--silent', '--show-error', '--fail', '--max-time', '60',
                '--user-agent', userAgent, '--output', destination, url,
            ], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
            return;
        } catch (error) {
            lastError = error;
            await sleep(1_000 * (attempt + 1));
        }
    }
    throw lastError;
}

function collectAssets(records) {
    const items = new Map();
    const add = (url, record, role) => {
        const canonical = canonicalUrl(url);
        if (!/\.(?:jpe?g|png|webp)$/i.test(canonical)) return;
        const entry = items.get(canonical) || { url: canonical, frames: [], roles: [] };
        if (!entry.frames.includes(record.frameworthyFrameId)) entry.frames.push(record.frameworthyFrameId);
        if (!entry.roles.includes(role)) entry.roles.push(role);
        items.set(canonical, entry);
    };
    for (const record of records) {
        for (const image of record.images || []) add(image.url, record, 'supplier-gallery');
        const assets = record.renderAssets || {};
        add(assets.front?.sourceUrl, record, 'front-rail');
        add(assets.profile?.sourceUrl, record, 'profile');
        add(assets.builder?.pictureUrl, record, 'frame-builder-rail');
        for (const corner of assets.corners || []) add(corner.sourceUrl, record, 'corner');
    }
    return [...items.values()].sort((a, b) => a.url.localeCompare(b.url));
}

async function main() {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    await mkdir(archiveDir, { recursive: true });
    const assets = collectAssets(manifest.records);
    console.log(`Archiving ${assets.length} unique supplier source images.`);
    const results = [];
    let nextIndex = 0;
    const workers = Array.from({ length: 3 }, async () => {
        while (nextIndex < assets.length) {
            const index = nextIndex++;
            const asset = assets[index];
            const localPath = archivePathFor(asset.url);
            try {
                if (!await exists(localPath) || (await stat(localPath)).size === 0) await fetchFile(asset.url, localPath);
                results[index] = { ...asset, localPath: localPath.slice(root.length + 1).replaceAll('\\', '/'), status: 'ready' };
                console.log(`[${index + 1}/${assets.length}] ready ${asset.url}`);
            } catch (error) {
                results[index] = { ...asset, localPath: localPath.slice(root.length + 1).replaceAll('\\', '/'), status: 'failed', error: error.message };
                console.warn(`[${index + 1}/${assets.length}] failed ${asset.url}`);
            }
        }
    });
    await Promise.all(workers);
    const index = {
        generatedAt: new Date().toISOString(),
        totalUniqueAssets: results.length,
        ready: results.filter(result => result.status === 'ready').length,
        failed: results.filter(result => result.status === 'failed').length,
        assets: results,
    };
    await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
    console.log(JSON.stringify({ total: index.totalUniqueAssets, ready: index.ready, failed: index.failed, indexPath }, null, 2));
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
