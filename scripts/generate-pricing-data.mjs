// Generates functions/pricing-data.json from the client-side pricing source
// of truth (src/data/constants.jsx, src/data/promoCodes.js).
//
// The payment-verification Cloud Function must recompute an order's price
// independently rather than trusting the totalPrice the client wrote into
// the order document. It can't import from src/ (separate npm package, and
// constants.jsx contains JSX), so the price-bearing fields are extracted
// here into a plain JSON table the function can read.
//
// Run after ANY price change:  npm run generate:pricing
import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = resolve(root, 'functions/pricing-data.json');
const tmpFile = resolve(root, 'node_modules/.cache/fw-pricing-bundle.mjs');

mkdirSync(dirname(tmpFile), { recursive: true });

// Bundle the two data modules to plain JS so Node can import them (strips
// JSX, resolves the relative import between them).
await build({
    entryPoints: [resolve(root, 'src/data/pricingSource.js')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    loader: { '.jsx': 'jsx' },
    outfile: tmpFile,
    logLevel: 'error',
});

const { FRAME_SIZES, FRAME_STYLES, MAT_COLORS, PROMO_CODES } = await import(pathToFileURL(tmpFile).href);

const data = {
    // Regenerate with `npm run generate:pricing` — do not hand-edit.
    generatedFrom: 'src/data/constants.jsx + src/data/promoCodes.js',
    sizePrices: Object.fromEntries(FRAME_SIZES.map(s => [s.id, s.price])),
    framePriceMods: Object.fromEntries(FRAME_STYLES.map(f => [f.id, f.priceMod ?? 1])),
    matPrices: Object.fromEntries(MAT_COLORS.map(m => [m.id, m.price])),
    promoCodes: PROMO_CODES,
};

writeFileSync(outFile, JSON.stringify(data, null, 2) + '\n');

console.log(`Wrote ${outFile}`);
console.log(`  sizes: ${Object.keys(data.sizePrices).length}`);
console.log(`  frames: ${Object.keys(data.framePriceMods).length}`);
console.log(`  mats: ${Object.keys(data.matPrices).length}`);
console.log(`  promos: ${Object.keys(data.promoCodes).length}`);
