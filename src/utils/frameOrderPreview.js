import { getFrameRail } from './frameRail';
import { getFrameRenderProfile } from './frameRenderProfile';

const load = src => new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
});

/** The order image uses the same measured border and local rails as the
 * customizer. widthIn/heightIn are supplier sight sizes, including a mount. */
export async function renderFrameOrderPreview({ frame, image, widthIn, heightIn, matReveal, matColorHex, glassType = 'standard' }) {
    const profile = getFrameRenderProfile(frame);
    const rail = getFrameRail(frame);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#faf9f7';
    ctx.fillRect(0, 0, 1200, 1200);
    const width = widthIn + 2 * (profile.mouldingWidthIn + profile.openingGapIn);
    const height = heightIn + 2 * (profile.mouldingWidthIn + profile.openingGapIn);
    const scale = 1056 / Math.max(width, height);
    const w = width * scale, h = height * scale;
    const x = (1200 - w) / 2, y = (1200 - h) / 2;
    const border = profile.mouldingWidthIn * scale;
    const gap = profile.openingGapIn * scale;
    const canvasProduct = frame.isCanvas || frame.canvasOnly;
    const mat = canvasProduct ? { topIn: 0, sideIn: 0, bottomIn: 0 } : matReveal;
    ctx.fillStyle = gap > 0 ? '#24211e' : matColorHex || '#fff';
    ctx.fillRect(x + border, y + border, w - border * 2, h - border * 2);
    const left = x + border + gap + (mat?.sideIn || 0) * scale;
    const top = y + border + gap + (mat?.topIn || 0) * scale;
    const aw = Math.max(1, w - 2 * (border + gap + (mat?.sideIn || 0) * scale));
    const ah = Math.max(1, h - 2 * (border + gap) - ((mat?.topIn || 0) + (mat?.bottomIn || 0)) * scale);
    const cover = Math.max(aw / image.naturalWidth, ah / image.naturalHeight);
    ctx.save(); ctx.beginPath(); ctx.rect(left, top, aw, ah); ctx.clip();
    ctx.drawImage(image, left + (aw - image.naturalWidth * cover) / 2,
        top + (ah - image.naturalHeight * cover) / 2, image.naturalWidth * cover, image.naturalHeight * cover);
    ctx.restore();
    if (!canvasProduct && glassType !== 'non-glare') {
        const glazeX = x + border + gap;
        const glazeY = y + border + gap;
        const glazeW = w - 2 * (border + gap);
        const glazeH = h - 2 * (border + gap);
        const reflection = ctx.createLinearGradient(glazeX, glazeY, glazeX + glazeW, glazeY + glazeH);
        const peak = glassType === 'float-glass' ? 0.18 : 0.08;
        reflection.addColorStop(0, 'rgba(255,255,255,0)');
        reflection.addColorStop(0.46, 'rgba(255,255,255,0)');
        reflection.addColorStop(0.58, `rgba(255,255,255,${peak})`);
        reflection.addColorStop(0.72, 'rgba(255,255,255,0)');
        ctx.fillStyle = reflection;
        ctx.fillRect(glazeX, glazeY, glazeW, glazeH);
    }
    if (border > 0) {
        const [horizontal, vertical] = rail
            ? await Promise.all([load(rail.h), load(rail.v)])
            : [null, null];
        const sides = [
            ['top', [[x,y],[x+w,y],[x+w-border,y+border],[x+border,y+border]]],
            ['bottom', [[x,y+h],[x+w,y+h],[x+w-border,y+h-border],[x+border,y+h-border]]],
            ['left', [[x,y],[x+border,y+border],[x+border,y+h-border],[x,y+h]]],
            ['right', [[x+w,y],[x+w-border,y+border],[x+w-border,y+h-border],[x+w,y+h]]],
        ];
        for (const [side, points] of sides) {
            ctx.save(); ctx.beginPath();
            points.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
            ctx.closePath(); ctx.clip();
            ctx.fillStyle = frame.baseColor; ctx.fillRect(x,y,w,h);
            if (horizontal && vertical) {
                const long = border * horizontal.naturalWidth / horizontal.naturalHeight;
                if (side === 'top' || side === 'bottom') {
                    ctx.translate(x, side === 'top' ? y : y+h);
                    if (side === 'bottom') ctx.scale(1,-1);
                    for (let i=0; i<w; i+=long) ctx.drawImage(horizontal,i,0,long,border);
                } else {
                    ctx.translate(side === 'left' ? x+border : x+w-border,y);
                    if (side === 'left') ctx.scale(-1,1);
                    for (let i=0; i<h; i+=long) ctx.drawImage(vertical,0,i,border,long);
                }
            }
            ctx.restore();
        }
    }
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}
