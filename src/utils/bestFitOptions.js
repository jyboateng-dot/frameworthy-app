import { frameGeometry, imageCrop } from './frameFit';
import { maxMatWidthForSize } from './matting';

export function bestFitOptions({ sizes, natural, size, orientation, mat, rail, frame, price, matPrice }) {
    const basePrice = Math.round(size.price * (frame.priceMod || 1));
    const candidates = [];
    const seen = new Set();
    for (const candidate of sizes) {
        for (const direction of ['portrait', 'landscape']) {
            if (candidate.width === candidate.height && direction === 'landscape') continue;
            for (const border of [...new Set([mat, 'none'])]) {
                if (candidate.id === size.id && direction === orientation && border === mat) continue;
                if (border !== 'none' && Number(border) > maxMatWidthForSize(candidate.width, candidate.height, rail)) continue;
                const geometry = frameGeometry(candidate, direction, border, rail);
                const key = `${geometry.width}:${geometry.height}:${geometry.mat}`;
                if (seen.has(key)) continue;
                seen.add(key);
                const total = Math.round(candidate.price * (frame.priceMod || 1)) + price - basePrice
                    - (mat !== 'none' && border === 'none' ? matPrice : 0);
                const crop = imageCrop(natural, geometry);
                if (!crop) continue;
                const distance = Math.abs(Math.log(candidate.width * candidate.height / (size.width * size.height)));
                candidates.push({ size: candidate, orientation: direction, mat: border, geometry,
                    price: total, retained: crop.retained,
                    score: crop.retained - distance * 0.08 - (border === mat ? 0 : 0.02) });
            }
        }
    }
    return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
}
