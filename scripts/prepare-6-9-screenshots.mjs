import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const sourceDirectory = 'C:\\Users\\HP ELITEBOOK\\Pictures\\Saved Pictures';
const outputDirectory = path.resolve('artifacts/app-store/iphone-6.9-selected');
const target = { width: 1320, height: 2868 };

const screenshots = [
  ['curate-your-hallways.jpg', 'IMG_0555.PNG'],
  ['frame-your-favorite-album-covers.jpg', 'IMG_0556.PNG'],
  ['original-paintings.jpg', 'IMG_0565.PNG'],
  ['artists-and-masterpieces.jpg', 'IMG_0566.PNG'],
  ['album-artwork.jpg', 'IMG_0567.PNG'],
];

await fs.mkdir(outputDirectory, { recursive: true });

const manifest = [];
for (const [outputName, inputName] of screenshots) {
  const input = path.join(sourceDirectory, inputName);
  const output = path.join(outputDirectory, outputName);
  const inputMetadata = await sharp(input).metadata();
  const resizedHeight = Math.round(inputMetadata.height * (target.width / inputMetadata.width));

  if (resizedHeight > target.height) {
    throw new Error(`${inputName} exceeds the 6.9-inch target height after proportionate resizing.`);
  }

  await sharp(input)
    .flatten({ background: '#fbfaf8' })
    .resize({ width: target.width, height: resizedHeight, fit: 'fill' })
    .extend({ top: 0, bottom: target.height - resizedHeight, left: 0, right: 0, background: '#fbfaf8' })
    .jpeg({ quality: 94, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toFile(output);

  const outputMetadata = await sharp(output).metadata();
  if (outputMetadata.width !== target.width || outputMetadata.height !== target.height || outputMetadata.format !== 'jpeg' || outputMetadata.hasAlpha) {
    throw new Error(`${outputName} did not meet the opaque ${target.width}x${target.height} JPEG requirement.`);
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

await fs.writeFile(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify({ target, screenshots: manifest }, null, 2)}\n`);
console.table(manifest);
