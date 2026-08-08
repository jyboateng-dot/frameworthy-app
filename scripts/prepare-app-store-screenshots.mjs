import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const sourceDirectory = 'C:\\Users\\HP ELITEBOOK\\Pictures\\Saved Pictures';
const outputDirectory = path.resolve('artifacts/app-store/iphone-6.5');
const target = { width: 1284, height: 2778 };

// One App Store localization accepts a maximum of ten screenshots. This order
// leads with the product promise, then shows the framing workflow and discovery.
// Album artwork is intentionally excluded until its promotional usage rights are confirmed.
const screenshots = [
  ['01-welcome-to-frameworthy.jpg', 'IMG_0553.PNG'],
  ['02-upload-your-art.jpg', 'IMG_0554.PNG'],
  ['03-curate-your-hallways.jpg', 'IMG_0555.PNG'],
  ['04-browse-frame-styles.jpg', 'IMG_0552.PNG'],
  ['05-customize-your-frame.jpg', 'IMG_0563.PNG'],
  ['06-refine-every-detail.jpg', 'IMG_0564.PNG'],
  ['07-discover-curated-art.jpg', 'IMG_0557.PNG'],
  ['08-explore-museum-masterpieces.jpg', 'IMG_0558.PNG'],
  ['09-create-your-gallery.jpg', 'IMG_0560.PNG'],
  ['10-showcase-the-best.jpg', 'IMG_0561.PNG'],
];

await fs.mkdir(outputDirectory, { recursive: true });

const manifest = [];
for (const [outputName, inputName] of screenshots) {
  const input = path.join(sourceDirectory, inputName);
  const output = path.join(outputDirectory, outputName);
  const metadata = await sharp(input).metadata();

  const resizedHeight = Math.round(metadata.height * (target.width / metadata.width));
  if (resizedHeight > target.height) {
    throw new Error(`${inputName} exceeds the target height after proportionate resizing; review its crop before preparing it.`);
  }

  // Resume safely after an interrupted export without recompressing files that
  // have already passed the exact target check.
  let existingMetadata;
  try {
    existingMetadata = await sharp(output).metadata();
  } catch {
    existingMetadata = undefined;
  }
  if (
    existingMetadata?.width === target.width
    && existingMetadata.height === target.height
    && existingMetadata.format === 'jpeg'
    && !existingMetadata.hasAlpha
  ) {
    manifest.push({
      file: outputName,
      source: inputName,
      dimensions: `${existingMetadata.width}x${existingMetadata.height}`,
      format: existingMetadata.format,
      alpha: false,
      paddedBottomPixels: target.height - resizedHeight,
    });
    continue;
  }

  // Preserve the supplied capture proportionately. The source captures use
  // FrameWorthy's off-white canvas, so only the remaining lower viewport area
  // is added as an opaque continuation rather than cropping the live interface.
  await sharp(input)
    .flatten({ background: '#fbfaf8' })
    .resize({ width: target.width, height: resizedHeight, fit: 'fill' })
    .extend({ top: 0, bottom: target.height - resizedHeight, left: 0, right: 0, background: '#fbfaf8' })
    .jpeg({ quality: 94, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toFile(output);

  const outputMetadata = await sharp(output).metadata();
  if (outputMetadata.width !== target.width || outputMetadata.height !== target.height || outputMetadata.hasAlpha) {
    throw new Error(`${outputName} did not meet the required opaque ${target.width}x${target.height} output.`);
  }

  manifest.push({
    file: outputName,
    source: inputName,
    dimensions: `${outputMetadata.width}x${outputMetadata.height}`,
    format: outputMetadata.format,
    alpha: Boolean(outputMetadata.hasAlpha),
    paddedBottomPixels: target.height - resizedHeight,
  });
}

await fs.writeFile(
  path.join(outputDirectory, 'manifest.json'),
  `${JSON.stringify({ target, screenshots: manifest }, null, 2)}\n`,
);

console.log(`Prepared ${manifest.length} opaque JPEG screenshots in ${outputDirectory}`);
console.table(manifest);
