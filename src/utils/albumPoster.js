// albumPoster.js
// Fetches tracklist/metadata for an album and renders a canvas-based poster:
//   - a plain SQUARE cover at top (standard album-cover convention — no
//     cropping to a rectangle, no text over the artwork)
//   - a two-column tracklist below the cover (tracklists longer than a
//     handful of tracks always split into two columns, matching the
//     convention of these posters rather than only splitting when the
//     single column wouldn't fit)
//   - alongside the tracklist: a color-palette swatch row, then the big
//     bold artist/title lockup, a signature, and release metadata
//   - a small runtime/label footnote below the tracklist, left-aligned
//
// Layout is band-based and every band is capped by both width and height:
// the "below cover" zone is a fixed percentage of canvas height, and the
// cover — capped by both remaining width and remaining height, so it's
// always square and never crowds out what's below it — gets whatever's left.
// The tracklist enforces a minimum readable line height (truncates with
// "+N more" rather than shrinking to illegibility).

export async function fetchAlbumPosterData(album) {
    const tracksInfo = await fetchTracklist(album.id);
    const coverImage = await loadImage(album.image);
    const palette = extractPalette(coverImage, 5);

    return { product: album, tracksInfo, palette };
}

export async function renderAlbumPoster(posterData, sizeDims, dpi = 100) {
    const { product: album, tracksInfo, palette } = posterData;

    await document.fonts.ready;

    // Accepts the physical size directly (e.g. { width, height } from a FRAME_SIZES
    // entry) rather than parsing an id string — several size ids (e.g. 'a4', 'sm')
    // aren't in "WxH" form, so parsing would silently break for those.
    let physicalWidth = sizeDims.width;
    let physicalHeight = sizeDims.height;
    // Always portrait — if the size happens to encode a landscape pair, swap it.
    if (physicalWidth > physicalHeight) {
        [physicalWidth, physicalHeight] = [physicalHeight, physicalWidth];
    }

    const width = Math.round(physicalWidth * dpi);
    const height = Math.round(physicalHeight * dpi);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const coverImage = await loadImage(album.image);

    const pageBg = '#ffffff';
    ctx.fillStyle = pageBg;
    ctx.fillRect(0, 0, width, height);

    // Font scale: absolute print-point size grows with physical poster size
    // (standard practice — bigger posters get bigger type), but sub-linearly
    // (^0.6, not ^1) so smaller prints get relatively larger text than a
    // strict linear scale-down would give them, keeping them legible without
    // needing per-size special-casing.
    const sizeRatio = physicalWidth / 24;
    const fontScale = Math.pow(Math.max(sizeRatio, 0.3), 0.6);
    const pt = (basePx) => {
        const basePt = (basePx / 100) * 72;
        const targetPt = basePt * fontScale;
        return Math.max(6, (targetPt / 72) * dpi);
    };

    const outerMargin = width * 0.05;
    const contentWidth = width - outerMargin * 2;
    const coverX = outerMargin;
    const gap = height * 0.022;

    const colGap = contentWidth * 0.06;

    const dateStr = new Date(tracksInfo.releaseDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const releaseYear = new Date(tracksInfo.releaseDate).getFullYear();
    const label = tracksInfo.copyright ? tracksInfo.copyright.replace(/[℗©]|\(P\)|\(C\)/gi, '').replace(/\d{4}/, '').trim() : 'INDEPENDENT';
    const genreLine = tracksInfo.genre ? `A ${tracksInfo.genre.toUpperCase()} ALBUM` : 'A STUDIO ALBUM';

    // ── The "below cover" zone (tracklist + metadata column) is a fixed
    //    percentage of the canvas height — NOT a sum of individual text-line
    //    pixel offsets, which don't reliably scale into a sensible fraction
    //    of an arbitrary canvas height. The cover then gets whatever height
    //    remains, same reserve-first-then-cover-gets-the-rest principle. ──
    const reservedBelowZoneHeight = height * 0.3;

    // Standard album-cover convention: a plain SQUARE cover, no cropping to
    // an arbitrary rectangle and no text over the artwork itself. Capped by
    // both the available width and the available height (reserved above),
    // so it can never grow large enough to crowd out what's below it.
    const coverY = outerMargin;
    const maxCoverHeight = height - outerMargin * 2 - gap - reservedBelowZoneHeight;
    const coverSize = Math.max(1, Math.min(contentWidth, maxCoverHeight));
    const coverDrawX = coverX + (contentWidth - coverSize) / 2;

    drawCoverFit(ctx, coverImage, coverDrawX, coverY, coverSize, coverSize);

    // ── Below the cover: tracklist (left) + palette/title/metadata (right) ──
    const belowY = coverY + coverSize + gap;
    
    // Calculate exact remaining space down to the bottom margin
    const dynamicBelowZoneHeight = height - belowY - outerMargin;
    const tracklistZoneHeight = dynamicBelowZoneHeight;

    // Tracklist layout setup
    const MAX_PER_COLUMN = 20;
    const tracks = tracksInfo.tracks;
    const trackSubColGap = contentWidth * 0.04;

    // A sans-serif font's actual line metrics (ascent+descent) run roughly
    // 1.2-1.3x its nominal size, so the font size needs real headroom below
    // its line height or adjacent rows visually collide. 0.70 leaves ~43%
    // headroom, safe for any sans-serif at this weight.
    const FONT_LINE_RATIO = 0.70;
    // Below this, prefer reflowing (more columns, then truncation) over
    // continuing to shrink into illegibility.
    const MIN_READABLE_FONT = pt(20);
    const REF_PX = 200; // reference size for proportional width measurement

    function widestTrackWidth(start, end) {
        ctx.font = `600 ${REF_PX}px "Inter", sans-serif`;
        let max = 0;
        for (let i = start; i < end && i < tracks.length; i++) {
            const name = (tracks[i].trackName || 'Unknown Track').toUpperCase();
            max = Math.max(max, ctx.measureText(`${i + 1} ${name}`).width);
        }
        return max;
    }

    // Lay out the metadata column first, with a fixed reference width, so
    // its fonts never shrink just because the tracklist is long.
    const baseMetaColWidth = contentWidth * 0.44; // Standard 44% of content
    const metaColX = coverX + (contentWidth - baseMetaColWidth);
    const maxMetaWidth = layoutMetaColumn(ctx, pt, metaColX, belowY, baseMetaColWidth, dynamicBelowZoneHeight, {
        palette, album, dateStr, label, genreLine
    });
    const safeTracklistSpace = contentWidth - maxMetaWidth - colGap;

    // The font size that best uses the available space for a given column
    // count is whichever of "as big as the available height allows" and "as
    // big as the available width allows" is more restrictive — computed
    // together, not as two independent, sequentially-applied caps. Sizing
    // from height alone (the old approach) let a single long track title
    // force post-hoc shrinkage no matter how much vertical room was unused;
    // capping height alone let an arbitrary line-height ceiling hold text
    // down even when both dimensions had slack.
    function fitTracklist(columns, displayCount) {
        const rowsPerColumn = Math.ceil(displayCount / columns);
        const maxLineHeight = columns === 1 ? pt(120) : pt(72);
        const fontByHeight = Math.min(maxLineHeight, tracklistZoneHeight / rowsPerColumn) * FONT_LINE_RATIO;

        const col1Ref = widestTrackWidth(0, rowsPerColumn);
        const col2Ref = columns === 2 ? widestTrackWidth(rowsPerColumn, displayCount) : 0;
        const refTotalWidth = columns === 1 ? col1Ref : col1Ref + col2Ref + trackSubColGap;
        const fontByWidth = refTotalWidth > 0 ? (safeTracklistSpace / refTotalWidth) * REF_PX : Infinity;

        const fontPx = Math.min(fontByHeight, fontByWidth);
        const scale = fontPx / REF_PX;
        return { fontPx, rowsPerColumn, col1Width: col1Ref * scale, col2Width: col2Ref * scale };
    }

    // Tracklists longer than a handful of tracks always split into two
    // columns (matching the convention of these posters), same as a single
    // column falling below the readable floor does.
    let columns = tracks.length > MAX_PER_COLUMN ? 2 : 1;
    let displayCount = tracks.length;
    let fit = fitTracklist(columns, displayCount);

    if (fit.fontPx < MIN_READABLE_FONT && columns === 1) {
        columns = 2;
        fit = fitTracklist(columns, displayCount);
    }

    let truncated = false;
    if (fit.fontPx < MIN_READABLE_FONT) {
        // Even two columns can't reach a readable size at the full track
        // count — figure out how many tracks actually fit at the floor
        // font (showing the rest as "+N more") rather than continuing to
        // shrink below it.
        const lineHeightAtFloor = MIN_READABLE_FONT / FONT_LINE_RATIO;
        const maxRowsAtFloor = Math.max(1, Math.floor(tracklistZoneHeight / lineHeightAtFloor));

        // If every remaining track already fits within one column's worth
        // of rows at the floor font, a second column would sit empty and
        // just waste half the available width — collapse to one column so
        // text can use the full width instead.
        if (maxRowsAtFloor >= tracks.length) {
            columns = 1;
        }

        displayCount = Math.min(tracks.length, maxRowsAtFloor * columns);
        truncated = displayCount < tracks.length;

        // Re-fit at the (possibly reduced) column count and track count —
        // freeing up a now-unused column, or truncating away the titles
        // that were forcing the shrink, can legitimately land back above
        // the floor.
        fit = fitTracklist(columns, displayCount);
        if (fit.fontPx < MIN_READABLE_FONT) {
            // Still not enough even now — hold at the floor exactly, sized
            // to whatever width it actually needs there.
            const scale = MIN_READABLE_FONT / REF_PX;
            fit = {
                fontPx: MIN_READABLE_FONT,
                rowsPerColumn: maxRowsAtFloor,
                col1Width: widestTrackWidth(0, maxRowsAtFloor) * scale,
                col2Width: columns === 2 ? widestTrackWidth(maxRowsAtFloor, displayCount) * scale : 0,
            };
        }
    }

    const trackFontPx = fit.fontPx;
    const lineHeight = trackFontPx / FONT_LINE_RATIO;
    const rowsPerColumn = fit.rowsPerColumn;
    let maxCol1Width = fit.col1Width;
    let maxCol2Width = fit.col2Width;
    ctx.font = `600 ${trackFontPx}px "Inter", sans-serif`;

    // Helper to truncate text by pixels — the final per-line safety net for
    // any individual track title still wider than its measured column
    // (e.g. one title much longer than every other track in that column).
    function truncateToFit(text, maxWidth) {
        if (ctx.measureText(text).width <= maxWidth) return text;
        let truncated = text;
        while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
            truncated = truncated.slice(0, -1);
        }
        return truncated + '…';
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#111111';

    for (let i = 0; i < displayCount; i++) {
        const col = Math.floor(i / rowsPerColumn);
        const row = i % rowsPerColumn;
        if (col >= columns) break;
        
        // Dynamic shift: Column 2 starts exactly after Column 1's measured width
        const colStep = col === 0 ? 0 : maxCol1Width + trackSubColGap;
        const x = coverX + colStep;
        const y = belowY + row * lineHeight;

        const name = (tracks[i].trackName || 'Unknown Track').toUpperCase();
        const fullText = `${i + 1} ${name}`;
        
        const availableColWidth = col === 0 ? maxCol1Width : maxCol2Width;
        const displayText = truncateToFit(fullText, availableColWidth);
        ctx.fillText(displayText, x, y);
    }

    if (truncated) {
        const remaining = tracks.length - displayCount;
        const lastRow = rowsPerColumn - 1;
        const x = coverX + (columns === 1 ? 0 : maxCol1Width + trackSubColGap);
        const y = belowY + lastRow * lineHeight;
        ctx.font = `600 italic ${trackFontPx}px "Inter", sans-serif`;
        ctx.fillStyle = '#666666';
        ctx.fillText(`+${remaining} more`, x, y);
    }

    // Footnote removed as requested

    // PNG (lossless) instead of JPEG — JPEG's chroma/edge compression visibly softens
    // fine text strokes, which is most of what this poster is.
    return canvas.toDataURL('image/png');
}

// Draws the metadata column (palette swatches, the big bold artist/title
// lockup, a signature, and release metadata) right-aligned to `x + colWidth`.
//
// Standard poster-typography practice: tight spacing WITHIN a logical group
// (artist name sits close under the swatches; the album title sits close
// under the artist name, forming one name/title "lockup"; the release-date/
// label/genre lines sit close together as one metadata paragraph) and a
// clearly bigger gap BETWEEN distinct groups (after the title lockup, and
// again after the signature). Gaps are zoneHeight-relative (so they scale
// with the print size); font sizes are pt()-relative for the same reason.
// zoneHeight is a generous upper bound, not a budget to fill exactly — a
// compact, well-spaced block reading naturally is the goal, not stretching
// content to consume all available height.
function layoutMetaColumn(ctx, pt, x, y, colWidth, zoneHeight, { palette, album, dateStr, label, genreLine }) {
    const rightX = x + colWidth;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    let cursorY = y;
    
    let maxMetaWidth = 0;
    const drawText = (text, rx, cy) => {
        ctx.fillText(text, rx, cy);
        maxMetaWidth = Math.max(maxMetaWidth, ctx.measureText(text).width);
    };

    // Palette swatches
    const swatchSize = Math.min(colWidth / 4.3, pt(95));
    const swatchGap = swatchSize * 0.18;
    const swatchesTotalWidth = swatchSize * palette.length + swatchGap * (palette.length - 1);
    const swatchX = rightX - swatchesTotalWidth;
    maxMetaWidth = Math.max(maxMetaWidth, swatchesTotalWidth);
    
    palette.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(swatchX + i * (swatchSize + swatchGap), cursorY, swatchSize, swatchSize);
    });
    cursorY += swatchSize;

    // ── Name/title lockup ──
    cursorY += zoneHeight * 0.065;
    const artistFontPx = Math.min(pt(65), colWidth * 0.10);
    ctx.font = `800 ${artistFontPx}px "Inter", sans-serif`;
    ctx.fillStyle = '#111111';
    cursorY += artistFontPx * 0.85;
    drawText(album.artist.toUpperCase(), rightX, cursorY);

    cursorY += zoneHeight * 0.015;
    const titleText = album.title.toUpperCase();
    const titleFontPx = fitFontSize(
        ctx, titleText, colWidth,
        Math.min(pt(100), colWidth * 0.18), pt(32),
        px => `800 ${px}px "Inter", sans-serif`
    );
    ctx.font = `800 ${titleFontPx}px "Inter", sans-serif`;
    ctx.fillStyle = '#0c0c0c';
    const titleLines = wrapLines(ctx, titleText, colWidth);
    titleLines.forEach((line, i) => {
        cursorY += i === 0 ? titleFontPx * 0.85 : titleFontPx * 1.05;
        drawText(line, rightX, cursorY);
    });

    // ── Signature ──
    cursorY += zoneHeight * 0.075;
    const sigFontPx = Math.min(pt(50), colWidth * 0.09);
    ctx.font = `italic 400 ${sigFontPx}px "Brush Script MT", "Segoe Script", cursive`;
    ctx.fillStyle = '#111111';
    cursorY += sigFontPx * 0.7;
    drawText(toSignatureCase(album.artist), rightX, cursorY);

    // ── Release metadata paragraph ──
    cursorY += zoneHeight * 0.09;
    const outNowFontPx = Math.min(pt(32), colWidth * 0.055);
    ctx.font = `700 ${outNowFontPx}px "Inter", sans-serif`;
    ctx.fillStyle = '#111111';
    cursorY += outNowFontPx * 0.8;
    drawText(`OUT NOW / ${dateStr.toUpperCase()}`, rightX, cursorY);

    cursorY += zoneHeight * 0.03;
    const releasedFontPx = Math.min(pt(26), colWidth * 0.045);
    ctx.font = `${releasedFontPx}px "Inter", sans-serif`;
    ctx.fillStyle = '#444444';
    const releasedLines = wrapLines(ctx, `RELEASED BY ${label.toUpperCase()}`, colWidth);
    releasedLines.forEach((line, i) => {
        cursorY += i === 0 ? releasedFontPx * 0.8 : releasedFontPx * 1.25;
        drawText(line, rightX, cursorY);
    });

    cursorY += zoneHeight * 0.03;
    const genreFontPx = Math.min(pt(24), colWidth * 0.045);
    ctx.font = `700 ${genreFontPx}px "Inter", sans-serif`;
    ctx.fillStyle = '#111111';
    cursorY += genreFontPx * 0.8;
    drawText(genreLine, rightX, cursorY);
    
    return maxMetaWidth;
}

// Draws `img` into the target rect using object-fit:cover semantics — crops
// (never stretches) the source so it fills the target rectangle exactly.
function drawCoverFit(ctx, img, tx, ty, tw, th) {
    const targetRatio = tw / th;
    const sourceRatio = img.naturalWidth / img.naturalHeight;
    let sx, sy, sw, sh;
    if (sourceRatio > targetRatio) {
        sh = img.naturalHeight;
        sw = sh * targetRatio;
        sx = (img.naturalWidth - sw) / 2;
        sy = 0;
    } else {
        sw = img.naturalWidth;
        sh = sw / targetRatio;
        sx = 0;
        sy = (img.naturalHeight - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, tx, ty, tw, th);
}

// A stylized rendering of a name for the "signature" — title-case rather
// than the artist's stylized capitalization, closer to how a signature reads.
function toSignatureCase(name) {
    return name.replace(/\S+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

// Shrinks the font size (in 2px steps) until `text` fits within `maxWidth`.
function fitFontSize(ctx, text, maxWidth, startPx, minPx, fontTemplate) {
    let size = startPx;
    while (size > minPx) {
        ctx.font = fontTemplate(size);
        if (ctx.measureText(text).width <= maxWidth) break;
        size -= 2;
    }
    return size;
}

// Wraps `text` to fit within `maxWidth` at the current ctx.font, returning
// the resulting lines (does not draw).
function wrapLines(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = test;
        }
    }
    if (line) lines.push(line);
    return lines;
}

function formatRuntime(tracks) {
    const totalMs = tracks.reduce((sum, t) => sum + (t.trackTimeMillis || 0), 0);
    const totalSeconds = Math.round(totalMs / 1000);
    const mm = Math.floor(totalSeconds / 60);
    const ss = totalSeconds % 60;
    return `${mm}:${String(ss).padStart(2, '0')}`;
}

// The iTunes lookup endpoint occasionally fails a single request (transient
// network blip, rate limiting) — retried a couple of times before giving up,
// rather than silently rendering a poster with no tracklist and no
// indication anything went wrong. A final failure is thrown, not swallowed,
// so the caller's existing "Failed to fetch album tracklist" alert fires.
async function fetchTracklist(collectionId, attempt = 1) {
    try {
        // `country=US` is required here — without it this specific lookup+entity=song
        // combination reliably fails with a network-level "Failed to fetch" in the browser.
        const res = await fetch(`https://itunes.apple.com/lookup?id=${collectionId}&entity=song&country=US`);
        if (!res.ok) throw new Error(`iTunes lookup failed: ${res.status}`);
        const data = await res.json();
        const collection = data.results.find(r => r.wrapperType === 'collection');
        const tracks = data.results.filter(r => r.wrapperType === 'track');
        if (tracks.length === 0) throw new Error('iTunes lookup returned no tracks');
        return {
            tracks,
            releaseDate: collection?.releaseDate || new Date().toISOString(),
            copyright: collection?.copyright || '',
            genre: collection?.primaryGenreName || ''
        };
    } catch (e) {
        if (attempt < 3) {
            await new Promise(r => setTimeout(r, 400 * attempt));
            return fetchTracklist(collectionId, attempt + 1);
        }
        console.error('Failed to fetch tracklist after retries:', e);
        throw e;
    }
}

// Module-level cache, keyed by source URL, so switching frame sizes doesn't
// re-fetch the same cover art over the network on every single change —
// renderAlbumPoster calls loadImage() fresh on every size change (the canvas
// dimensions differ per size), and without this cache each of those clicks
// re-downloaded the identical image. Caching the in-flight PROMISE (not just
// the resolved image) also dedupes concurrent calls for the same src, and a
// failed load is evicted so the next attempt can legitimately retry.
const imageCache = new Map();

function loadImage(src) {
    if (imageCache.has(src)) return imageCache.get(src);

    const promise = new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => {
            imageCache.delete(src);
            reject(new Error('Failed to load image: ' + src));
        };
        try {
            const url = new URL(src, window.location.href);
            url.searchParams.set('corsbuster', Math.random().toString(36).substring(7));
            img.src = url.toString();
        } catch {
            img.src = src;
        }
    });

    imageCache.set(src, promise);
    return promise;
}

// Extracts a `count`-color palette from the cover, ordered light-to-dark
// (matching the tonal-gradient swatch row seen on real "Spotify code"-style
// album posters). Rather than sampling a handful of fixed points — which
// can easily land on near-duplicate colors (e.g. several corners hitting
// the same plain background) or land in the wrong order — this samples
// every pixel of a downscaled copy, sorts by perceptual lightness, and picks
// evenly-spaced percentiles across that sorted range (inset slightly from
// the extremes to avoid a single outlier pixel skewing an end swatch).
function extractPalette(img, count) {
    const size = 64;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = size;
    canvas.height = size;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    const samples = [];
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        // ITU-R BT.601 luma — a standard perceptual-lightness approximation.
        const lightness = 0.299 * r + 0.587 * g + 0.114 * b;
        samples.push({ r, g, b, lightness });
    }
    samples.sort((a, b) => a.lightness - b.lightness);

    const insetLow = 0.06, insetHigh = 0.94;
    const palette = [];
    for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0.5 : i / (count - 1); // 0 = lightest requested, 1 = darkest
        const percentile = insetHigh - t * (insetHigh - insetLow);
        const idx = Math.min(samples.length - 1, Math.max(0, Math.round(percentile * (samples.length - 1))));
        const s = samples[idx];
        palette.push(`rgb(${s.r}, ${s.g}, ${s.b})`);
    }
    return palette;
}
