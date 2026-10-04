#!/usr/bin/env node
/**
 * Strips build-time-only artwork out of dist/ before it is deployed.
 *
 * public/ doubles as the supplier working set: alongside each frame's one
 * web-ready preview sit its raw supplier shots, the profile-reference plates
 * the render profiles were derived from, and per-frame details.json. Nine
 * scripts under scripts/ read those straight out of public/frames, so they
 * have to stay on disk — but Vite copies all of public/ into dist/, so they
 * were also being deployed. That is ~238 MB of frame sources plus ~87 MB of
 * oversized Met originals shipped on every release and served to nobody.
 *
 * Rather than freeze a manifest (which would rot as the catalogue changes),
 * this re-derives what the app actually references on every build, so adding
 * or removing a frame needs no change here.
 *
 * Run with --dry-run to preview.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const SRC = 'src';
const DRY = process.argv.includes('--dry-run');

// Catalogues of every supplier asset ever downloaded. Nothing in the app
// imports them (they feed scripts/ only), so letting them vote on what is
// "referenced" would mark the entire supplier archive as live.
const BUILD_TIME_ONLY = new Set([
  'frameworthy-frame-details.json',
  'frameCatalogue.json',
  'constants_new.jsx',
]);

const TEXT_EXT = new Set(['.js', '.jsx', '.json', '.html', '.css']);
// matchBasename: frames assemble paths at runtime ("/frames/${frame.filename}"),
// so a bare filename has to count as a reference there. It must NOT apply to
// met_local_exceptions, whose filenames embed the artwork title — those titles
// appear in metLocal.js as data, which would mark every one of them "used".
const PRUNABLE = [
  { dir: 'frames', matchBasename: true },
  { dir: 'met_local_exceptions', matchBasename: false },
];

function collectText(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!full.includes('node_modules')) collectText(full, out);
    } else if (TEXT_EXT.has(path.extname(entry.name).toLowerCase())
               && !BUILD_TIME_ONLY.has(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

const sources = collectText(SRC);
if (fs.existsSync('index.html')) sources.push('index.html');
let haystack = '';
for (const file of sources) {
  try { haystack += fs.readFileSync(file, 'utf8') + '\n'; } catch { /* unreadable: skip */ }
}

let removedBytes = 0;
let removedCount = 0;
let keptBytes = 0;

for (const { dir: root, matchBasename } of PRUNABLE) {
  for (const file of walkFiles(path.join(DIST, root))) {
    const webPath = '/' + path.relative(DIST, file).split(path.sep).join('/');
    const base = path.basename(file);
    const size = fs.statSync(file).size;
    if (haystack.includes(webPath) || (matchBasename && haystack.includes(base))) {
      keptBytes += size;
      continue;
    }
    removedBytes += size;
    removedCount += 1;
    if (!DRY) fs.rmSync(file);
  }
}

// Tidy up directories the prune emptied.
if (!DRY) {
  for (const { dir: root } of PRUNABLE) {
    const base = path.join(DIST, root);
    const prune = (dir) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) prune(path.join(dir, entry.name));
      }
      if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
    };
    prune(base);
  }
}

const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
console.log(
  `[prune-deploy-assets]${DRY ? ' (dry run)' : ''} removed ${removedCount} build-only files, `
  + `${mb(removedBytes)}; kept ${mb(keptBytes)} of referenced artwork.`
);
