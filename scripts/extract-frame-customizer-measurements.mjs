#!/usr/bin/env node
/**
 * Adds physical customizer measurements to already verified supplier records.
 * Overall size is stored as a formula because it changes with artwork and mat
 * selection; moulding width and rabbet depth are fixed per moulding profile.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

const ROOT = resolve(import.meta.dirname, '..');
const DATA_PATH = resolve(ROOT, 'src/data/frameworthy-frame-details.json');
const execFile = promisify(execFileCallback);
const sleep = (ms) => new Promise(resolveSleep => setTimeout(resolveSleep, ms));
const USER_AGENT = 'FrameWorthy-catalog-sync/1.0 (licensed catalogue ingest)';

const decode = (value = '') => value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function inches(value) {
    const raw = String(value || '').trim().replace(/\s+/g, ' ');
    if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
    const mixed = raw.match(/^(\d+)\s*(?:-|\s)\s*(\d+)\/(\d+)$/);
    if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    const fraction = raw.match(/^(\d+)\/(\d+)$/);
    return fraction ? Number(fraction[1]) / Number(fraction[2]) : null;
}

function firstMetaContent(html, property) {
    const tag = [...html.matchAll(/<meta\b[^>]*>/gi)].find(match =>
        new RegExp(`(?:property|name)\s*=\s*["']${property}["']`, 'i').test(match[0]),
    );
    return tag?.[0].match(/content\s*=\s*(["'])(.*?)\1/i)?.[2] || null;
}

function firstAttribute(html, attribute) {
    const match = html.match(new RegExp(`${attribute}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
    return match?.[2] || null;
}

function measurementEvidence(html) {
    // Supplier pages expose these values in the customizer data attribute, too.
    return [firstMetaContent(html, 'og:description'), firstAttribute(html, 'data-product-description')]
        .filter(Boolean)
        .map(value => decode(value).replace(/<[^>]+>/g, ' '))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function measurementsFromPage(html, record) {
    const description = measurementEvidence(html);
    const widthRaw = description.match(/Moulding\s+Width\s*:\s*([\d./\s-]+?)\s*IN\b/i)?.[1]?.trim();
    const rabbetRaw = description.match(/Rabbet\s+Depth\s*:\s*([\d./\s-]+?)\s*IN\b/i)?.[1]?.trim()
        || record.details?.['Rabbet Depth'] || null;
    const mouldingWidthIn = inches(widthRaw);
    const rabbetDepthIn = inches(rabbetRaw);
    if (mouldingWidthIn === null) return null;
    return {
        mouldingWidth: {
            inches: mouldingWidthIn,
            millimetres: Number((mouldingWidthIn * 25.4).toFixed(2)),
            display: `${widthRaw} in`,
        },
        rabbetDepth: rabbetDepthIn === null ? null : {
            inches: rabbetDepthIn,
            millimetres: Number((rabbetDepthIn * 25.4).toFixed(2)),
            display: `${rabbetRaw} in`,
        },
        overallSize: {
            noMatFormula: 'artwork dimension + (2 × moulding width)',
            widthFormula: `artworkWidthIn + ${(mouldingWidthIn * 2).toFixed(4)}`,
            heightFormula: `artworkHeightIn + ${(mouldingWidthIn * 2).toFixed(4)}`,
        },
        evidence: { source: 'supplier customizer product description', description },
    };
}

async function fetchPage(url) {
    let lastError;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
            const { stdout } = await execFile('curl.exe', [
                '--location', '--silent', '--show-error', '--fail', '--max-time', '35',
                '--user-agent', USER_AGENT, url,
            ], { maxBuffer: 16 * 1024 * 1024, windowsHide: true });
            return stdout;
        } catch (error) {
            lastError = error;
            await sleep(Math.min(60_000, 5_000 * (2 ** attempt)));
        }
    }
    throw lastError;
}

async function save(data) {
    data.generatedAt = new Date().toISOString();
    await writeFile(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`);
}

async function main() {
    const data = JSON.parse(await readFile(DATA_PATH, 'utf8'));
    const targetId = process.argv.find(argument => argument.startsWith('--frame='))?.slice('--frame='.length);
    const work = data.records.filter(record =>
        !record.customizerMeasurements && record.sourceUrl && (!targetId || record.frameworthyFrameId === targetId),
    );
    console.log(`Extracting customizer measurements for ${work.length} verified frame records.`);
    for (let index = 0; index < work.length; index += 1) {
        const record = work[index];
        try {
            const html = await fetchPage(record.sourceUrl);
            const measurements = measurementsFromPage(html, record);
            if (measurements) {
                record.customizerMeasurements = measurements;
                await save(data);
                console.log(`[${index + 1}/${work.length}] ${record.frameworthyFrameId}: ${measurements.mouldingWidth.display}`);
            } else {
                record.customizerMeasurementStatus = 'not-exposed-in-page-description';
                console.log(`[${index + 1}/${work.length}] ${record.frameworthyFrameId}: no moulding width exposed`);
            }
        } catch (error) {
            record.customizerMeasurementStatus = 'source-fetch-failed';
            console.warn(`[${index + 1}/${work.length}] ${record.frameworthyFrameId}: ${error.message}`);
        }
        await sleep(500);
    }
    await save(data);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
