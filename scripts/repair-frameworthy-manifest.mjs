#!/usr/bin/env node
// Recovers complete records from an interrupted generated-manifest write.
// It scans JSON string-aware braces and discards only the final partial
// record, leaving all earlier source data untouched.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const path = resolve(import.meta.dirname, '..', 'src/data/frameworthy-frame-details.json');
const source = await readFile(path, 'utf8');
const start = source.indexOf('"records": [');
if (start < 0) throw new Error('No records array found.');

let inString = false;
let escaped = false;
let depth = 1; // root object is already open before `records`.
let lastCompleteRecord = -1;
for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
    }
    if (char === '"') { inString = true; continue; }
    if (char === '{') depth += 1;
    if (char === '}') {
        depth -= 1;
        if (depth === 1) lastCompleteRecord = index;
    }
}
if (lastCompleteRecord < 0) throw new Error('No complete record found.');

const repaired = `${source.slice(0, lastCompleteRecord + 1)}\n  ],\n  "unresolved": []\n}\n`;
const parsed = JSON.parse(repaired);
await writeFile(path, repaired);
console.log(`Recovered ${parsed.records.length} complete records.`);
