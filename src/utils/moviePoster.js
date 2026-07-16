// moviePoster.js
// Fetches metadata for a movie and renders a canvas-based "info poster",
// mirroring albumPoster.js's layout convention:
//   - a plain SQUARE crop of the poster art at top (same treatment as the
//     album cover — no cropping to an arbitrary rectangle, no text over the
//     artwork itself)
//   - a right-aligned metadata band below it: title, director, top cast, then
//     a genre/runtime/rating footer line — a stylized credits-block look,
//     akin to a real one-sheet's bottom credit crawl, rather than a tracklist
//   - a small color-palette swatch row extracted from the poster art itself,
//     for visual consistency with the album poster's palette treatment
//
// Layout is band-based, same principle as albumPoster.js: the metadata band
// is a fixed percentage of canvas height, and the square poster art — capped
// by both remaining width and remaining height, so it's always square and
// never crowds out what's below it — gets whatever's left.

export async function fetchMoviePosterData(movie) {
    const details = await fetchMovieDetails(movie.id);
    const posterImage = await loadImage(movie.image);
    const palette = extractPalette(posterImage, 5);

    return { movie, details, palette };
}

export async function renderMoviePoster(posterData, sizeDims, dpi = 100) {
    const { movie, details, palette } = posterData;

    await document.fonts.ready;

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

    const posterImage = await loadImage(movie.image);

    // Plain white page background, matching albumPoster.js.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Font scale: same sub-linear (^0.6) growth-with-size curve as albumPoster.js,
    // so smaller prints stay legible without needing per-size special-casing.
    const sizeRatio = physicalWidth / 24;
    const fontScale = Math.pow(Math.max(sizeRatio, 0.3), 0.6);
    const pt = (basePx) => {
        const basePt = (basePx / 100) * 72;
        const targetPt = basePt * fontScale;
        return Math.max(6, (targetPt / 72) * dpi);
    };

    const outerMargin = width * 0.05;
    const contentWidth = width - outerMargin * 2;
    const posterX = outerMargin;
    const gap = height * 0.022;

    // ── The metadata band is a fixed percentage of canvas height — NOT a sum
    //    of individual text-line pixel offsets. The square poster then gets
    //    whatever height remains, same reserve-first-then-image-gets-the-rest
    //    principle as albumPoster.js. ──
    const reservedBelowZoneHeight = height * 0.3;

    // Standard poster-print convention (mirrors the album cover treatment):
    // a plain SQUARE crop of the poster art, capped by both the available
    // width and the available height, so it can never grow large enough to
    // crowd out the metadata block below it.
    const posterY = outerMargin;
    const maxPosterHeight = height - outerMargin * 2 - gap - reservedBelowZoneHeight;
    const posterSize = Math.max(1, Math.min(contentWidth, maxPosterHeight));
    const posterDrawX = posterX + (contentWidth - posterSize) / 2;

    drawCoverFit(ctx, posterImage, posterDrawX, posterY, posterSize, posterSize);

    const belowY = posterY + posterSize + gap;
    const belowZoneHeight = height - belowY - outerMargin;

    layoutMovieMetaBlock(ctx, pt, outerMargin, belowY, contentWidth, belowZoneHeight, { palette, movie, details });

    // PNG (lossless) — matches albumPoster.js's choice for crisp text edges.
    return canvas.toDataURL('image/png');
}

// Draws the metadata block (palette swatches, title, director, cast, and a
// genre/runtime/rating footer line) RIGHT-aligned to the content's right
// edge — same alignment convention as albumPoster.js's metadata column —
// against the plain white page background.
//
// Font sizes are driven primarily by `zoneHeight` — the actual reserved
// space below the square poster crop — rather than a fixed print-point
// ceiling, so type genuinely scales to fill the room available instead of
// capping out early and leaving the zone mostly blank. zoneHeight itself
// scales with the physical frame size (see renderMoviePoster), so this
// still gives larger prints proportionally larger type — pt()/colWidth are
// kept only as sane upper bounds for extreme cases (very wide colWidth with
// a short zoneHeight), not as the everyday binding constraint.
//
// Same grouped-spacing rhythm as albumPoster.js: tight gaps within a logical
// group (title sits close under the swatches; director/cast sit close under
// the title), bigger gaps between distinct groups.
function layoutMovieMetaBlock(ctx, pt, x, y, colWidth, zoneHeight, { palette, movie, details }) {
    const rightX = x + colWidth;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    let cursorY = y;

    // Palette swatches
    const swatchSize = Math.min(colWidth / 5, zoneHeight * 0.14, pt(160));
    const swatchGap = swatchSize * 0.2;
    const swatchesTotalWidth = swatchSize * palette.length + swatchGap * (palette.length - 1);
    const swatchX = rightX - swatchesTotalWidth;
    palette.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(swatchX + i * (swatchSize + swatchGap), cursorY, swatchSize, swatchSize);
    });
    cursorY += swatchSize;

    // ── Title ──
    cursorY += zoneHeight * 0.11;
    const titleText = movie.title.toUpperCase();
    const titleMaxPx = Math.min(zoneHeight * 0.24, colWidth * 0.24, pt(220));
    const titleMinPx = pt(50);
    const titleFont = px => `800 ${px}px "Inter", sans-serif`;

    let titleFontPx = fitFontSize(ctx, titleText, colWidth, titleMaxPx, titleMinPx, titleFont);
    ctx.font = titleFont(titleFontPx);
    let titleLines = [titleText];

    // A title that still doesn't fit on one line even at the minimum size
    // would otherwise keep running past the content width toward the frame
    // — wrap it across as many lines as it takes instead, re-fitting the
    // font against the wider effective budget multiple lines gives so it
    // isn't needlessly small. wrapLines only ever puts as much text on a
    // line as fits `colWidth` at the current font, so every resulting line
    // is guaranteed to fit — no line cap needed, long titles just get more
    // lines rather than shrinking indefinitely or crowding the frame.
    if (ctx.measureText(titleText).width > colWidth) {
        titleFontPx = fitFontSize(ctx, titleText, colWidth * 1.8, titleMaxPx, titleMinPx, titleFont);
        ctx.font = titleFont(titleFontPx);
        titleLines = wrapLines(ctx, titleText, colWidth);
    }

    ctx.fillStyle = '#0c0c0c';
    titleLines.forEach((line, i) => {
        cursorY += i === 0 ? titleFontPx * 0.85 : titleFontPx * 1.15;
        ctx.fillText(line, rightX, cursorY);
    });

    // ── Director ──
    if (details.director) {
        cursorY += zoneHeight * 0.075;
        const directorFontPx = Math.min(zoneHeight * 0.09, colWidth * 0.095, pt(72));
        ctx.font = `700 ${directorFontPx}px "Inter", sans-serif`;
        ctx.fillStyle = '#333333';
        cursorY += directorFontPx * 0.8;
        ctx.fillText(`DIRECTED BY ${details.director.toUpperCase()}`, rightX, cursorY);
    }

    // ── Cast ──
    if (details.actors) {
        cursorY += zoneHeight * 0.05;
        const castFontPx = Math.min(zoneHeight * 0.075, colWidth * 0.08, pt(58));
        ctx.font = `${castFontPx}px "Inter", sans-serif`;
        ctx.fillStyle = '#555555';
        const castLines = wrapLines(ctx, `STARRING ${details.actors.toUpperCase()}`, colWidth);
        castLines.slice(0, 2).forEach((line, i) => {
            cursorY += i === 0 ? castFontPx * 0.8 : castFontPx * 1.3;
            ctx.fillText(line, rightX, cursorY);
        });
    }

    // ── Genre / runtime / rating footer line ──
    const footerParts = [];
    if (details.genre) footerParts.push(details.genre.toUpperCase());
    if (details.runtime) footerParts.push(details.runtime.toUpperCase());
    if (details.rating) footerParts.push(`★ ${details.rating}/10`);
    if (footerParts.length > 0) {
        cursorY += zoneHeight * 0.09;
        const footerFontPx = Math.min(zoneHeight * 0.08, colWidth * 0.085, pt(64));
        ctx.font = `700 ${footerFontPx}px "Inter", sans-serif`;
        ctx.fillStyle = '#111111';
        cursorY += footerFontPx * 0.8;
        ctx.fillText(footerParts.join('   ·   '), rightX, cursorY);
    }
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

async function fetchMovieDetails(imdbId) {
    try {
        const res = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=trilogy`);
        const data = await res.json();
        const clean = (v) => (v && v !== 'N/A' ? v : '');
        return {
            director: clean(data.Director),
            // Trim to the first 3 credited actors — a real poster's credits
            // block doesn't list the full cast, just the leads.
            actors: clean(data.Actors) ? data.Actors.split(',').slice(0, 3).map(s => s.trim()).join(', ') : '',
            genre: clean(data.Genre) ? data.Genre.split(',')[0].trim() : '',
            runtime: clean(data.Runtime),
            rating: clean(data.imdbRating)
        };
    } catch (e) {
        console.error('Failed to fetch movie details:', e);
        return { director: '', actors: '', genre: '', runtime: '', rating: '' };
    }
}

// Module-level cache, keyed by source URL, so switching frame sizes doesn't
// re-fetch the same poster art over the network on every single change —
// renderMoviePoster calls loadImage() fresh on every size change (the canvas
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

// Extracts a `count`-color palette from the poster, ordered light-to-dark —
// identical algorithm to albumPoster.js's extractPalette (samples every pixel
// of a downscaled copy, sorts by perceptual lightness, picks evenly-spaced
// percentiles inset from the extremes to avoid outlier-pixel skew).
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
        const lightness = 0.299 * r + 0.587 * g + 0.114 * b;
        samples.push({ r, g, b, lightness });
    }
    samples.sort((a, b) => a.lightness - b.lightness);

    const insetLow = 0.06, insetHigh = 0.94;
    const palette = [];
    for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0.5 : i / (count - 1);
        const percentile = insetHigh - t * (insetHigh - insetLow);
        const idx = Math.min(samples.length - 1, Math.max(0, Math.round(percentile * (samples.length - 1))));
        const s = samples[idx];
        palette.push(`rgb(${s.r}, ${s.g}, ${s.b})`);
    }
    return palette;
}
