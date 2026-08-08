import { describe, expect, it } from 'vitest';
import arPreview from '../arPreview.js';

const { makeGlb, makeUsdz, parsePreviewConfig } = arPreview;

describe('AR Quick Look preview generator', () => {
    it('accepts a bounded Cloudinary configuration and converts colour to USD values', () => {
        const encoded = Buffer.from(JSON.stringify({
            artworkUrl: 'https://res.cloudinary.com/frameworthy/image/upload/w_1024,f_jpg/sample.jpg',
            openingWidthM: 0.5,
            openingHeightM: 0.7,
            frameFaceM: 0.04,
            frameDepthM: 0.028,
            frameColor: '#a6824c',
            isMetallic: true,
        })).toString('base64url');
        const config = parsePreviewConfig(encoded);

        expect(config.openingWidthM).toBe(0.5);
        expect(config.frameColor).toBe('0.6510, 0.5098, 0.2980');
        expect(config.isMetallic).toBe(true);
    });

    it('writes stored ZIP entries aligned for USDZ payloads', () => {
        const archive = makeUsdz([{ name: 'frameworthy.usda', data: Buffer.from('#usda 1.0') }]);
        const filenameLength = archive.readUInt16LE(26);
        const extraLength = archive.readUInt16LE(28);
        const payloadOffset = 30 + filenameLength + extraLength;

        expect(archive.readUInt32LE(0)).toBe(0x04034b50);
        expect(payloadOffset % 64).toBe(0);
        expect(archive.includes(Buffer.from('#usda 1.0'))).toBe(true);
    });

    it('writes a standards-shaped GLB for Android Scene Viewer', () => {
        const glb = makeGlb({
            openingWidthM: 0.5,
            openingHeightM: 0.7,
            frameFaceM: 0.04,
            frameDepthM: 0.028,
            frameColor: '0.6510, 0.5098, 0.2980',
            isMetallic: false,
        }, { bytes: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), extension: 'jpg' });
        const jsonLength = glb.readUInt32LE(12);
        const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8').trim());

        expect(glb.readUInt32LE(0)).toBe(0x46546c67);
        expect(glb.readUInt32LE(4)).toBe(2);
        expect(glb.readUInt32LE(8)).toBe(glb.length);
        expect(json.asset.version).toBe('2.0');
        expect(json.nodes).toHaveLength(5);
        expect(json.images[0].mimeType).toBe('image/jpeg');
    });
});
