import { imageCrop } from './frameFit';

const DEFAULT_PRINT_POSITION = { x: 0.5, y: 0.5, zoom: 1 };

export const TARGET_PRINT_DPI = 300;
export const MIN_PAPER_PRINT_DPI = 240;
export const MIN_CANVAS_PRINT_DPI = 150;
export const AI_NATIVE_FLOOR_DPI = 75;
export const AI_NATIVE_CANVAS_FLOOR_DPI = 60;

export const isCanvasFrame = (frame) => Boolean(
    frame?.isCanvas
    || frame?.canvasOnly
    || String(frame?.prodigiProduct || '').includes('canvas')
);

export const minimumPrintDpiForFrame = (frame) => (
    isCanvasFrame(frame) ? MIN_CANVAS_PRINT_DPI : MIN_PAPER_PRINT_DPI
);

export const minimumNativeFloorDpiForFrame = (frame) => (
    isCanvasFrame(frame) ? AI_NATIVE_CANVAS_FLOOR_DPI : AI_NATIVE_FLOOR_DPI
);

const finitePositive = (value) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
};

export function buildPrintQualitySpec({
    sourceSize,
    geometry,
    position = DEFAULT_PRINT_POSITION,
    frame,
    minimumDpi = minimumPrintDpiForFrame(frame),
    outputSize = null,
    assetUrl = null,
    assetKind = 'original',
}) {
    const sourceWidthPx = finitePositive(sourceSize?.w ?? sourceSize?.width);
    const sourceHeightPx = finitePositive(sourceSize?.h ?? sourceSize?.height);
    const printWidthIn = finitePositive(geometry?.apertureWidth);
    const printHeightIn = finitePositive(geometry?.apertureHeight);
    if (!sourceWidthPx || !sourceHeightPx || !printWidthIn || !printHeightIn) return null;

    const crop = imageCrop(
        { w: sourceWidthPx, h: sourceHeightPx },
        geometry,
        position,
        minimumDpi
    );
    if (!crop) return null;

    const isCanvas = isCanvasFrame(frame);
    const nativeFloorDpi = isCanvas ? AI_NATIVE_CANVAS_FLOOR_DPI : AI_NATIVE_FLOOR_DPI;
    const sourceDpi = Math.min(crop.w / printWidthIn, crop.h / printHeightIn);
    const outputWidthPx = finitePositive(outputSize?.w ?? outputSize?.width);
    const outputHeightPx = finitePositive(outputSize?.h ?? outputSize?.height);
    const outputDpi = outputWidthPx && outputHeightPx
        ? Math.min(outputWidthPx / printWidthIn, outputHeightPx / printHeightIn)
        : sourceDpi;
    const baseEffectiveDpi = Math.min(sourceDpi, outputDpi);

    let effectiveDpi = baseEffectiveDpi;
    let aiUpscale = null;

    if (baseEffectiveDpi + 0.01 >= minimumDpi) {
        effectiveDpi = baseEffectiveDpi;
    } else if (assetKind === 'original' && baseEffectiveDpi + 0.01 >= nativeFloorDpi) {
        // Native scan meets the 75 DPI floor (60 for canvas) — backed by Replicate Real-ESRGAN super-resolution
        const scale = Math.min(4, Math.max(2, Math.ceil(TARGET_PRINT_DPI / baseEffectiveDpi)));
        effectiveDpi = Math.min(TARGET_PRINT_DPI, Math.floor(baseEffectiveDpi * scale * 10) / 10);
        aiUpscale = {
            required: true,
            scale,
            nativeDpi: Math.floor(baseEffectiveDpi * 10) / 10,
            targetDpi: TARGET_PRINT_DPI,
        };
    }

    return {
        version: 1,
        targetDpi: TARGET_PRINT_DPI,
        minimumDpi,
        effectiveDpi: Math.floor(effectiveDpi * 10) / 10,
        sourceDpi: Math.floor(sourceDpi * 10) / 10,
        outputDpi: Math.floor(outputDpi * 10) / 10,
        passed: effectiveDpi + 0.01 >= minimumDpi,
        productClass: isCanvas ? 'canvas' : 'paper',
        aiUpscale,
        sourceWidthPx,
        sourceHeightPx,
        outputWidthPx: outputWidthPx || sourceWidthPx,
        outputHeightPx: outputHeightPx || sourceHeightPx,
        printWidthIn,
        printHeightIn,
        crop: {
            x: Math.round(crop.x * 100) / 100,
            y: Math.round(crop.y * 100) / 100,
            w: Math.round(crop.w * 100) / 100,
            h: Math.round(crop.h * 100) / 100,
        },
        position: {
            x: Number(position?.x ?? DEFAULT_PRINT_POSITION.x),
            y: Number(position?.y ?? DEFAULT_PRINT_POSITION.y),
            zoom: Number(position?.zoom ?? DEFAULT_PRINT_POSITION.zoom),
        },
        assetKind,
        assetUrl: assetUrl || null,
        colorSpace: assetKind === 'browser-rendered' ? 'srgb-browser' : 'source-managed',
    };
}
