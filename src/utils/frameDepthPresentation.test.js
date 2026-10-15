import { describe, expect, it } from 'vitest';
import { FRAME_STYLES } from '../data/constants';
import {
    getFrameCanvasShadow,
    getFrameDepthPresentation,
    getFrameWallShadow,
} from './frameDepthPresentation';

const frame = id => FRAME_STYLES.find(item => item.id === id);

describe('frame depth presentation', () => {
    it('uses the measured wall depth for every flat render cue', () => {
        expect(getFrameDepthPresentation(frame('prodigi-aluminium-black')).label).toBe('19 mm depth');
        expect(getFrameDepthPresentation(frame('prodigi-classic-black')).label).toBe('22 mm depth');
        expect(getFrameDepthPresentation(frame('prodigi-box-black')).label).toBe('33 mm depth');
        expect(getFrameDepthPresentation(frame('prodigi-float-canvas-black')).label).toBe('53 mm depth');
    });

    it('gives a deeper frame a stronger wall and order-preview shadow', () => {
        const classic = frame('prodigi-classic-black');
        const box = frame('prodigi-box-black');
        const classicCanvasShadow = getFrameCanvasShadow(classic, 50);
        const boxCanvasShadow = getFrameCanvasShadow(box, 50);

        expect(getFrameDepthPresentation(box).depthRatio).toBeGreaterThan(getFrameDepthPresentation(classic).depthRatio);
        expect(boxCanvasShadow.offsetY).toBeGreaterThan(classicCanvasShadow.offsetY);
        expect(boxCanvasShadow.blur).toBeGreaterThan(classicCanvasShadow.blur);
        expect(getFrameWallShadow(box)).not.toBe(getFrameWallShadow(classic));
    });
});
