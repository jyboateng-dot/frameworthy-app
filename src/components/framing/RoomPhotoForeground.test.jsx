// @vitest-environment node
import React from 'react';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { describe, it, expect } from 'vitest';
import RoomPhotoForeground from './RoomPhotoForeground';
import { ROOM_SCENES } from '../../data/roomScenes';

// Reviewed source-photo coordinates, deliberately including enclosed spaces
// that looked like furniture to the old automatic masks. Test rendered alpha,
// not path strings: these checks exercise the SVG filters and asset alignment.
const probes = {
    'studio-loft': {
        wall: [[700, 400], [200, 810], [1300, 860], [40, 600]],
        object: [[700, 740], [300, 820], [80, 570], [1480, 910], [100, 985]],
    },
    'dining-room': {
        wall: [[700, 400], [374, 840], [633, 835], [895, 840], [1155, 830]],
        object: [[500, 740], [490, 795], [470, 880], [70, 850], [1425, 820], [700, 950]],
    },
    bedroom: {
        wall: [[700, 400], [500, 740], [1030, 710], [398, 748], [1072, 709]],
        object: [[700, 650], [700, 830], [420, 655], [426, 720], [1104, 720], [1100, 764], [450, 757], [100, 930]],
    },
    entryway: {
        wall: [[700, 400], [700, 760], [145, 336], [1100, 700], [1250, 140], [1400, 142], [112, 624], [100, 632]],
        object: [[700, 680], [550, 750], [950, 760], [1250, 500], [1250, 152], [50, 800], [140, 400], [50, 570], [85, 590], [700, 920]],
    },
    'home-office': {
        wall: [[700, 400], [750, 810], [750, 875], [530, 830], [846, 790], [875, 830], [1062, 795]],
        object: [[750, 755], [750, 850], [750, 890], [845, 830], [965, 840], [570, 755], [750, 690], [60, 850], [700, 990]],
    },
};

describe('room foreground separation', () => {
    for (const room of ROOM_SCENES) {
        it(`${room.name}: reveals wall gaps and preserves original object pixels`, async () => {
            const source = await readFile(resolve('public', room.image.slice(1)));
            const mask = await readFile(resolve('public', room.wallMaskImage.slice(1)));
            const embeddedRoom = {
                ...room,
                // librsvg's embedded image support is PNG/JPEG; the browser
                // uses WebP directly. Decoding to PNG does not change pixels.
                image: `data:image/png;base64,${(await sharp(source).png().toBuffer()).toString('base64')}`,
                wallMaskImage: `data:image/png;base64,${mask.toString('base64')}`,
            };
            const svg = renderToStaticMarkup(<RoomPhotoForeground room={embeddedRoom} />)
                .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ')
                .replaceAll(' href=', ' xlink:href=');
            const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
            const original = await sharp(source).ensureAlpha().raw().toBuffer();
            expect(info.width).toBe(1536);
            expect(info.height).toBe(1024);
            for (const [x, y] of probes[room.id].wall) {
                const offset = (y * info.width + x) * 4;
                expect(data[offset + 3], `wall at ${x},${y}`).toBeLessThan(5);
            }
            for (const [x, y] of probes[room.id].object) {
                const offset = (y * info.width + x) * 4;
                expect(data[offset + 3], `object at ${x},${y}`).toBeGreaterThan(250);
                for (let channel = 0; channel < 3; channel++) {
                    expect(Math.abs(data[offset + channel] - original[offset + channel]), `original colour at ${x},${y}`).toBeLessThanOrEqual(2);
                }
            }
        }, 15000);
    }
});
