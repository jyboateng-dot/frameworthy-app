"""Refresh paginated NGA Open Access metadata. No image files are downloaded.

Run: python scripts/import-nga.py
Source: https://github.com/NationalGalleryOfArt/opendata
Only primary images explicitly marked openaccess=1 are included.
"""
import csv
import io
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = 'https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data/'
DEST = Path(__file__).resolve().parents[1] / 'public' / 'museum-data' / 'nga'


def rows(name):
    with urllib.request.urlopen(BASE + name + '.csv', timeout=180) as response:
        yield from csv.DictReader(io.TextIOWrapper(response, encoding='utf-8-sig', newline=''))


def main():
    images = {}
    for row in rows('published_images'):
        if row['openaccess'] == '1' and row['viewtype'] == 'primary' and row['iiifurl']:
            images.setdefault(row['depictstmsobjectid'], row)
    print(f'{len(images)} open primary images', flush=True)
    artworks = []
    for row in rows('objects'):
        image = images.get(row['objectid'])
        if not image or row['classification'].lower() not in ('painting', 'drawing', 'print', 'photograph'):
            continue
        artworks.append(dict(
            id=row['objectid'], title=row['title'], artist=row['attribution'],
            image=image['iiifurl'] + '/full/!843,843/0/default.jpg',
            fullRes=image['iiifurl'] + '/full/max/0/default.jpg',
            imageWidth=int(image['width']), imageHeight=int(image['height']),
            rights='CC0', sourceUrl='https://www.nga.gov/artworks/' + row['objectid'],
            date=row['displaydate'], medium=row['medium'], dimensions=row['dimensions'],
            creditLine=row['creditline'], classification=row['classification'],
            accessionNumber=row['accessionnum'], description=image['assistivetext'],
        ))
    artworks.sort(key=lambda art: (art['classification'] != 'Painting', int(art['id'])))
    if not artworks:
        raise RuntimeError('No eligible artworks; refusing to replace catalogue')
    DEST.mkdir(parents=True, exist_ok=True)
    for offset in range(0, len(artworks), 24):
        (DEST / f'{offset // 24 + 1}.json').write_text(json.dumps({
            'artworks': artworks[offset:offset + 24], 'total': len(artworks)
        }, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    (DEST / 'manifest.json').write_text(json.dumps({
        'source': BASE, 'updatedAt': datetime.now(timezone.utc).isoformat(),
        'total': len(artworks), 'pageSize': 24,
    }, indent=2), encoding='utf-8')
    print(f'Wrote {len(artworks)} artworks to {DEST}', flush=True)


if __name__ == '__main__':
    main()
