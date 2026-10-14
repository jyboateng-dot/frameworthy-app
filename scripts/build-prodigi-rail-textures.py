#!/usr/bin/env python3
"""Rectify reviewed upper chevron faces into reusable, opaque rail pairs.

Alpha locates the material even on white frames. Only the straight upper
arm is sampled, away from the mitre and sawn end. Face fractions deliberately
exclude photographed side walls; floaters use just their narrow front rim.
The mirror extension has matching endpoints, so repetition has no hard seam.
These are photo-derived references, not measured albedo or PBR scans.
"""
from pathlib import Path
import hashlib
import json
import math
import numpy as np
from PIL import Image, ImageOps, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'public/prodigi/rails'
FAMILIES = {
    'classic': ['black', 'white', 'natural', 'antique-silver', 'brown', 'antique-gold', 'dark-grey', 'light-grey'],
    'box': ['black', 'white', 'natural'],
    'aluminium': ['black', 'silver', 'gold'],
    'canvas-float': ['black', 'white', 'antique-gold', 'antique-silver', 'natural', 'brown'],
}

def extract(source, family):
    image = Image.open(source).convert('RGBA')
    pixels = np.asarray(image)
    # Shared composition of the official 300x500 chevrons. Stay far enough
    # right that upper and lower legs are separated by transparent pixels.
    columns = range(165, 235)
    spans = []
    for x in columns:
        ys = np.where(pixels[:300, x, 3] > 245)[0]
        if not len(ys):
            raise ValueError(f'No opaque rail at {source}:{x}')
        top = int(ys[0])
        bottom = top
        while bottom + 1 < 300 and pixels[bottom + 1, x, 3] > 245:
            bottom += 1
        spans.append((top, bottom))
    slope = float(np.polyfit(list(columns), [s[0] for s in spans], 1)[0])
    # Narrow outer rim is the float frame FACE; the much wider region below
    # it is its recessed inner wall, which must not stretch over a 12mm face.
    lo, hi = (0.035, 0.19) if family == 'canvas-float' else (0.04, 0.81)
    thickness = float(np.median([(b - t) * (hi - lo) for t, b in spans])) / math.sqrt(1 + slope * slope)
    length = len(spans) * math.sqrt(1 + slope * slope)
    height = 64
    width = max(64, round(length / thickness * height))
    strip = Image.new('RGB', (width, height))
    for x in range(width):
        column = min(len(spans) - 1, round(x / max(1, width - 1) * (len(spans) - 1)))
        top, bottom = spans[column]
        sx = 165 + column
        for y in range(height):
            sy = round(top + (bottom - top) * (lo + (hi - lo) * y / (height - 1)))
            if pixels[sy, sx, 3] < 245:
                raise ValueError(f'Background entered face crop: {source}')
            strip.putpixel((x, y), tuple(pixels[sy, sx, :3]))
    # Resampling corrects the diagonal boundaries, but studio lighting can
    # still vary slowly along the arm. Flatten that trend conservatively.
    data = np.asarray(strip).astype(float)
    means = data.mean(axis=(0, 2))
    window = max(3, width // 8)
    trend = np.array([means[max(0, x-window):min(width, x+window+1)].mean() for x in range(width)])
    scale = np.clip(trend.mean() / np.maximum(trend, 8), .8, 1.2)
    strip = Image.fromarray(np.clip(data * scale[None, :, None], 0, 255).astype('uint8'))
    seamless = Image.new('RGB', (width * 2, height))
    seamless.paste(strip, (0, 0))
    seamless.paste(ImageOps.mirror(strip), (width, 0))
    return seamless, {'columns': [165, 234], 'faceFractions': [lo, hi], 'aspect': width * 2 / height}

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    materials, rails, review = {}, {}, []
    for family, colours in FAMILIES.items():
        for colour in colours:
            key = f'{family}-{colour}'
            source = ROOT / f'public/prodigi/finishes/{key}.png'
            strip, extraction = extract(source, family)
            strip.save(DEST / f'{key}-h.webp', quality=94)
            strip.transpose(Image.Transpose.ROTATE_270).save(DEST / f'{key}-v.webp', quality=94)
            record = {
                'h': f'/prodigi/rails/{key}-h.webp', 'v': f'/prodigi/rails/{key}-v.webp',
                'quality': 'derived-from-chevron', 'sourceRole': 'rectified-face',
                'source': str(source.relative_to(ROOT)),
                'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                'width': strip.width, 'thickness': strip.height, **extraction,
            }
            materials[key] = record
            ids = {'classic': ['classic', 'classic-canvas'], 'box': ['box'],
                   'aluminium': ['aluminium'], 'canvas-float': ['float-canvas', 'eco-canvas']}[family]
            for prefix in ids:
                rails[f'prodigi-{prefix}-{colour}'] = record
            tile = Image.new('RGB', (720, 100), 'white')
            ImageDraw.Draw(tile).text((5, 4), key, fill='black')
            resized = strip.resize((min(700, strip.width), 64))
            for x in range(0, 720, resized.width): tile.paste(resized, (x, 28))
            review.append(tile)
    manifest = {'version': 'prodigi-rails-v1', 'materials': materials, 'rails': rails}
    (ROOT / 'src/data/prodigiRenderAssets.json').write_text(json.dumps(manifest, indent=2) + '\n')
    sheet = Image.new('RGB', (1440, math.ceil(len(review)/2)*100), 'white')
    for i, tile in enumerate(review): sheet.paste(tile, ((i%2)*720, (i//2)*100))
    sheet.save(ROOT / 'resources/prodigi/rail-review.jpg', quality=95)
    print(f'Built {len(materials)} material pairs covering {len(rails)} frame finishes.')

if __name__ == '__main__': main()
