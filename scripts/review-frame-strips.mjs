#!/usr/bin/env node
/**
 * Builds a contact sheet for reviewing the output of
 * generate-frame-strips.mjs.
 *
 * WHY REVIEW IS MANDATORY HERE
 *
 * The generator's own success count is not a quality signal. Its failures
 * are silent and produce plausible-looking images: a crop that runs through
 * the mitre emits a chevron (the moulding's profile lines meet in a V at the
 * strip's centre) rather than a straight run, and a crop that straddles the
 * face's perspective taper emits a wedge of studio background at one end.
 * Both tile into something obviously wrong on a frame, but neither is
 * distinguishable from a good strip by any automated measure tried:
 *
 *   - Cross-section consistency (how well each column matches the strip's
 *     mean vertical profile) INVERTS: the known-bad 8837_a.jpg scores 0.643
 *     against known-good 10715_b.jpg at 0.610, because it measures how plain
 *     the moulding is, not whether the crop is straight.
 *   - Edge-alignment confidence separates the first samples tried but does
 *     not hold up: 10794_b.jpg scores 1.437 and is a chevron.
 *
 * So this renders every strip the way it will actually be used — tiled
 * along a run — next to the photo it came from, ordered best-guess first.
 * Wrong ones are immediately obvious to a person even though no metric
 * catches them. Reject list goes in the manifest; nothing ships unreviewed.
 *
 * Usage: node scripts/review-frame-strips.mjs   -> public/frames/strips/review.html
 */
import { readFile, writeFile } from 'node:fs/promises';

const MANIFEST_PATH = 'src/data/frameStrips.json';
const OUT = 'public/frames/strips/review.html';

const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
const rows = Object.entries(manifest)
    .map(([file, s]) => ({ file, ...s }))
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

const cards = rows.map((r, i) => `
  <figure class="card" id="c${i}">
    <div class="meta">
      <span class="idx">${i + 1}</span>
      <code>${r.file}</code>
      <span class="conf">conf ${r.confidence ?? '—'}</span>
      <span class="dim">${r.tileLength}&times;${r.thickness}</span>
    </div>
    <div class="pair">
      <img class="src" src="../${r.file}" loading="lazy" alt="">
      <div class="tiled" style="background-image:url('${r.h}');background-size:auto 100%;"></div>
    </div>
  </figure>`).join('');

const html = `<!doctype html>
<meta charset="utf-8">
<title>Frame strip review (${rows.length})</title>
<style>
  body{font:13px/1.4 system-ui,sans-serif;margin:0;padding:24px;background:#faf9f8;color:#1c1917}
  h1{font-size:18px;margin:0 0 4px}
  p.lead{color:#57534e;margin:0 0 20px;max-width:70ch}
  .card{margin:0 0 18px;background:#fff;border:1px solid #e7e5e4;border-radius:10px;overflow:hidden}
  .meta{display:flex;gap:12px;align-items:center;padding:8px 12px;border-bottom:1px solid #f5f5f4;background:#fafaf9}
  .idx{font-weight:700;color:#a8a29e;min-width:34px}
  code{font-size:12px}
  .conf,.dim{margin-left:auto;color:#78716c;font-variant-numeric:tabular-nums}
  .dim{margin-left:0}
  .pair{display:grid;grid-template-columns:150px 1fr;gap:14px;padding:12px;align-items:center}
  .src{width:150px;height:150px;object-fit:contain;background:#fff;border:1px solid #f5f5f4;border-radius:6px}
  /* Tiled exactly as a frame side would use it: repeated along its length at
     its natural thickness, so a chevron or a background wedge shows up as a
     repeating artefact rather than hiding in a single crop. */
  .tiled{height:120px;border-radius:6px;background-repeat:repeat-x;border:1px solid #f5f5f4}
</style>
<h1>Frame strip review &mdash; ${rows.length} converted</h1>
<p class="lead">Each strip is shown tiled the way a frame side will use it, beside its source photo.
Reject anything showing a <strong>chevron</strong> (profile lines meeting in a V &mdash; the crop ran through the
mitre) or a <strong>pale wedge</strong> (studio background pulled in at the tapered end). Ordered by
edge-alignment confidence, best first &mdash; note this is ordering only, not a quality guarantee.</p>
${cards}
`;

await writeFile(OUT, html);
console.log(`review sheet: ${OUT}  (${rows.length} strips)`);
