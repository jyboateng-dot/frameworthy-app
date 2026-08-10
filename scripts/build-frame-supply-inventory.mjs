#!/usr/bin/env node
/** Produces a human-readable, per-style inventory of locally packaged
 * rendering inputs and source-backed physical details. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(resolve(root, 'src/data/frameworthy-frame-details.json'), 'utf8'));
const renderProfiles = JSON.parse(await readFile(resolve(root, 'src/data/frameRenderProfiles.json'), 'utf8'));
const outputDir = resolve(root, 'catalog_downloads');

const rows = manifest.records.map(record => {
    const assets = record.renderAssets || {};
    const front = assets.front || {};
    const builder = assets.builder || {};
    const measurements = record.customizerMeasurements || {};
    const profile = renderProfiles.profiles?.[record.frameworthyFrameId] || {};
    const corners = assets.corners || [];
    const frontSource = front.source === 'supplier-frame-builder'
        ? 'supplier frame-builder straight rail'
        : front.derivedFromCompleteFrame
            ? 'derived from supplier complete flat frame'
            : front.localHorizontalPath
                ? 'supplier gallery straight rail'
                : 'not packaged';
    return {
        frameId: record.frameworthyFrameId,
        catalogueName: record.currentName || '',
        supplierProductName: record.productName || record.details?.['Product Name'] || '',
        supplierSku: record.sourceSku || '',
        style: record.details?.Style || '',
        color: record.details?.Color || '',
        frameType: record.details?.['Frame Type'] || '',
        supplierPage: record.sourceUrl || '',
        cataloguePreviewLocal: record.currentPreview || '',
        sourceImageVariants: record.images?.filter(image => image.url)?.length || 0,
        frontRailStatus: front.localHorizontalPath ? 'ready' : 'missing',
        frontRailSource: frontSource,
        frontRailHorizontalLocal: front.localHorizontalPath || '',
        frontRailVerticalLocal: front.localVerticalPath || '',
        frontRailSourceUrl: front.sourceUrl || '',
        completeFrameDerived: Boolean(front.derivedFromCompleteFrame),
        profileStatus: assets.profile?.localPath ? 'ready' : 'not packaged',
        profileLocal: assets.profile?.localPath || '',
        profileSourceUrl: assets.profile?.sourceUrl || profile.profileReferenceUrl || '',
        cornerReferenceCount: corners.length,
        cornerLocalPaths: corners.map(corner => corner.localPath).join(' | '),
        cornerSourceUrls: corners.map(corner => corner.sourceUrl).join(' | '),
        mouldingWidthIn: measurements.mouldingWidth?.inches ?? builder.mouldingWidthIn ?? '',
        mouldingWidthMm: measurements.mouldingWidth?.millimetres ?? '',
        rabbetDepthIn: measurements.rabbetDepth?.inches ?? builder.rabbetDepthIn ?? '',
        rabbetDepthMm: measurements.rabbetDepth?.millimetres ?? '',
        maxArtworkWidthIn: builder.maxArtworkWidthIn ?? '',
        maxArtworkHeightIn: builder.maxArtworkHeightIn ?? '',
        visualProfile: profile.profile || '',
        finish: profile.finish || '',
        renderer2D: front.localHorizontalPath ? 'source rail + measured width' : 'catalogue fallback pending source rail',
        renderer3D: `${front.localHorizontalPath ? 'source face material' : 'fallback face material'}; ${measurements.mouldingWidth?.inches ? 'measured width' : 'estimated width'}; ${assets.profile?.localPath ? 'profile reference available' : 'profile reference pending'}`,
        sourceIssue: front.localHorizontalPath ? '' : (record.frameBuilderAssetError || assets.error || ''),
    };
}).sort((a, b) => a.catalogueName.localeCompare(b.catalogueName));

const columns = Object.keys(rows[0] || {});
const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = `\uFEFF${columns.join(',')}\n${rows.map(row => columns.map(column => csvCell(row[column])).join(',')).join('\n')}\n`;
const summary = {
    generatedAt: new Date().toISOString(),
    totalStyles: rows.length,
    frontRailsReady: rows.filter(row => row.frontRailStatus === 'ready').length,
    profileReferencesReady: rows.filter(row => row.profileStatus === 'ready').length,
    completePhysicalMeasurements: rows.filter(row => row.mouldingWidthIn !== '' && row.rabbetDepthIn !== '').length,
    pendingFrontRails: rows.filter(row => row.frontRailStatus !== 'ready').length,
    rows,
};
await writeFile(resolve(outputDir, 'frame-render-supply-inventory.csv'), csv);
await writeFile(resolve(outputDir, 'frame-render-supply-inventory.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({
    totalStyles: summary.totalStyles,
    frontRailsReady: summary.frontRailsReady,
    profileReferencesReady: summary.profileReferencesReady,
    completePhysicalMeasurements: summary.completePhysicalMeasurements,
    pendingFrontRails: summary.pendingFrontRails,
}, null, 2));
