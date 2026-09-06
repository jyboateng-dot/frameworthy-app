import { imageCrop } from '../utils/frameFit';
import { uploadImageToCloud } from './storage';

export async function prepareFrameOutput(source, geometry, position, frameColor, matColor) {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('Could not load the original image. Please try again.'));
        image.src = source;
    });
    const crop = imageCrop({ w: image.naturalWidth, h: image.naturalHeight }, geometry, position);
    if (!crop) throw new Error('The frame opening is too small. Adjust the mat width.');
    const print = document.createElement('canvas');
    const scale = Math.min(1, 6000 / Math.max(crop.w, crop.h));
    print.width = Math.max(1, Math.round(crop.w * scale));
    print.height = Math.max(1, Math.round(crop.h * scale));
    const ctx = print.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, print.width, print.height);
    ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, print.width, print.height);
    const thumb = document.createElement('canvas');
    thumb.width = thumb.height = 1200;
    const t = thumb.getContext('2d');
    const ratio = 1056 / Math.max(geometry.outerWidth, geometry.outerHeight);
    const x = (1200 - geometry.outerWidth * ratio) / 2;
    const y = (1200 - geometry.outerHeight * ratio) / 2;
    t.fillStyle = frameColor;
    t.fillRect(x, y, geometry.outerWidth * ratio, geometry.outerHeight * ratio);
    t.fillStyle = matColor;
    t.fillRect(x + geometry.rail * ratio, y + geometry.rail * ratio, geometry.width * ratio, geometry.height * ratio);
    t.drawImage(print, x + (geometry.rail + geometry.mat) * ratio, y + (geometry.rail + geometry.mat) * ratio,
        geometry.apertureWidth * ratio, geometry.apertureHeight * ratio);
    const upload = async (canvas, name, type) => {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, type, 0.98));
        if (!blob) throw new Error('Could not prepare your frame. Please try again.');
        return uploadImageToCloud(new File([blob], name, { type }));
    };
    const productionImage = await upload(print, 'frame-print.jpg', 'image/jpeg');
    const visualizerImage = await upload(thumb, 'frame-preview.png', 'image/png');
    return { productionImage, visualizerImage, productionSpec: { version: 1, units: 'in', ...geometry,
        position, crop, sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight,
        top: geometry.mat, bottom: geometry.mat, left: geometry.mat, right: geometry.mat,
        printWidthPx: print.width, printHeightPx: print.height, printIsCropped: true } };
}
