import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = process.argv[2] || path.join(process.env.TEMP || process.env.TMPDIR || '.', 'frameworthy-prodigi-pricing');
const updatedAt = '2026-10-04';

const parseCsv = (text) => {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (quoted) {
            if (character === '"' && text[index + 1] === '"') {
                cell += '"';
                index += 1;
            } else if (character === '"') {
                quoted = false;
            } else {
                cell += character;
            }
        } else if (character === '"') {
            quoted = true;
        } else if (character === ',') {
            row.push(cell);
            cell = '';
        } else if (character === '\n') {
            row.push(cell.replace(/\r$/, ''));
            rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += character;
        }
    }
    if (cell || row.length) {
        row.push(cell.replace(/\r$/, ''));
        rows.push(row);
    }
    return rows;
};

const parseMoney = (value) => {
    const amount = Number(String(value || '').trim());
    return Number.isFinite(amount) ? amount : null;
};

const productFamily = (sku, frame) => {
    if (sku.startsWith('GLOBAL-BOXM-MOTH-')) return 'box-mounted-motheye';
    if (sku.startsWith('GLOBAL-BOX-MOTH-')) return 'box-motheye';
    if (sku.startsWith('GLOBAL-BOXM-')) return 'box-mounted';
    if (sku.startsWith('GLOBAL-BOX-')) return 'box';
    if (sku.startsWith('GLOBAL-FRA-SLIMCAN-')) return 'canvas-classic';
    if (sku.startsWith('ECO-FRA-CAN-')) return 'canvas-eco';
    if (sku.startsWith('GLOBAL-FRA-CAN-')) return 'canvas-float';
    if (sku.startsWith('GLOBAL-CAN-') && /^38mm\b/i.test(frame || '')) return 'stretched-canvas';
    return null;
};

const toMarket = (row, index) => ({
    productPrice: parseMoney(row[index['Product price']]),
    productCurrency: row[index['Product currency']]?.trim() || 'GBP',
    shippingPrice: parseMoney(row[index['Shipping price']]),
    additionalItemShipping: parseMoney(row[index['Plus one shipping price']]),
    shippingCurrency: row[index['Shipping currency']]?.trim() || 'GBP',
    shippingMethod: row[index['Shipping method']]?.trim() || 'Standard',
    deliveryDays: {
        min: parseMoney(row[index['Minimum shipping (days)']]),
        max: parseMoney(row[index['Maximum shipping (days)']]),
    },
    tracked: /tracked/i.test(row[index['Tracked shipping']] || ''),
    fulfilmentCountry: row[index['Source country']]?.trim() || '',
});

const datasets = [
    ['framed-prints-gb.csv', 'GB'],
    ['framed-prints-je.csv', 'JE'],
    ['framed-canvas-gb.csv', 'GB'],
    ['framed-canvas-je.csv', 'JE'],
    ['stretched-canvas-gb.csv', 'GB'],
    ['stretched-canvas-je.csv', 'JE'],
];
const productsByKey = new Map();

for (const [file, market] of datasets) {
    const csv = parseCsv(await readFile(path.join(sourceDir, file), 'utf8'));
    const [header, ...rows] = csv;
    const index = Object.fromEntries(header.map((name, position) => [name, position]));
    for (const row of rows) {
        if (row[index['Destination country']] !== market || row[index['Shipping method']] !== 'Standard') continue;
        const sku = row[index.SKU];
        const family = productFamily(sku, row[index.Frame]);
        if (!family) continue;

        const options = {
            color: row[index.Color]?.trim() || '',
            glaze: row[index.Glaze]?.trim() || '',
            mount: row[index.Mount]?.trim() || '',
            mountColor: row[index['Mount color']]?.trim() || '',
            paper: row[index['Paper type']]?.trim() || '',
            substrateWeight: row[index['Substrate weight']]?.trim() || '',
            wrap: row[index.Wrap]?.trim() || '',
        };
        const optionKey = Object.values(options).join('|');
        const key = `${sku}::${optionKey}`;
        const description = row[index['Product description']]?.trim() || '';
        const product = productsByKey.get(key) || {
            id: key,
            sku,
            family,
            name: row[index['Product type']]?.trim() || 'Prodigi framed artwork',
            description,
            sizeInches: row[index['Size (inches)']]?.trim() || description.match(/\b\d+(?:\.\d+)?x\d+(?:\.\d+)?\s*(?:inches|\")/i)?.[0] || '',
            sizeCm: row[index['Size (cm)']]?.trim() || description.match(/\b\d+(?:\.\d+)?x\d+(?:\.\d+)?\s*cm/i)?.[0] || '',
            frame: row[index.Frame]?.trim() || '',
            style: row[index.Style]?.trim() || '',
            options,
            markets: {},
        };

        const marketPrice = toMarket(row, index);
        const existing = product.markets[market];
        // There may be multiple fulfilment origins in a sheet. Prefer the
        // GB origin for these two UK-island markets; otherwise keep the
        // lowest standard-delivery landed cost as the conservative fallback.
        const preferredOrigin = marketPrice.fulfilmentCountry === 'GB';
        const existingPreferred = existing?.fulfilmentCountry === 'GB';
        const newLanded = (marketPrice.productPrice || 0) + (marketPrice.shippingPrice || 0);
        const oldLanded = (existing?.productPrice || 0) + (existing?.shippingPrice || 0);
        if (!existing || (preferredOrigin && !existingPreferred) || (preferredOrigin === existingPreferred && newLanded < oldLanded)) {
            product.markets[market] = marketPrice;
        }
        productsByKey.set(key, product);
    }
}

const products = [...productsByKey.values()].sort((left, right) =>
    left.family.localeCompare(right.family)
    || left.sizeInches.localeCompare(right.sizeInches, undefined, { numeric: true })
    || left.sku.localeCompare(right.sku)
    || left.options.color.localeCompare(right.options.color)
    || left.options.wrap.localeCompare(right.options.wrap));

if (!products.length) throw new Error(`No Prodigi products parsed from ${sourceDir}`);

const output = {
    source: {
        provider: 'Prodigi',
        updatedAt,
        currency: 'GBP',
        standardShippingOnly: true,
        notes: 'Supplier price-sheet snapshot for catalogue prototyping. Confirm a live quote before accepting payment or placing an order.',
        urls: {
            framedPrintsGB: 'https://prodigipricingpublic.blob.core.windows.net/public/live/prodigi-wall-art-framed-prints-gb.csv',
            framedPrintsJE: 'https://prodigipricingpublic.blob.core.windows.net/public/live/prodigi-wall-art-framed-prints-je.csv',
            framedCanvasGB: 'https://prodigipricingpublic.blob.core.windows.net/public/live/prodigi-wall-art-framed-canvas-gb.csv',
            framedCanvasJE: 'https://prodigipricingpublic.blob.core.windows.net/public/live/prodigi-wall-art-framed-canvas-je.csv',
            stretchedCanvasGB: 'https://prodigipricingpublic.blob.core.windows.net/public/live/prodigi-wall-art-stretched-canvas-gb.csv',
            stretchedCanvasJE: 'https://prodigipricingpublic.blob.core.windows.net/public/live/prodigi-wall-art-stretched-canvas-je.csv',
        },
    },
    products,
};
const outputPath = path.join(root, 'src', 'data', 'prodigiCatalog.json');
// This catalogue is route-lazy-loaded in the browser. Keep its transfer and
// parse cost low; the upstream CSVs are retained outside the application.
await writeFile(outputPath, `${JSON.stringify(output)}\n`);
console.log(`Wrote ${products.length} Prodigi catalogue variants to ${path.relative(root, outputPath)}`);
