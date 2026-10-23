const logger = require('firebase-functions/logger');

/**
 * Upscales a public image URL using Replicate's nightmareai/real-esrgan model.
 * @param {string} imageUrl - Publicly accessible HTTPS URL of the image to upscale.
 * @param {number} [scale=4] - Scale factor (clamped between 2 and 4).
 * @param {string} token - Replicate API token.
 * @returns {Promise<string>} - The direct CDN URL of the upscaled image.
 */
async function upscaleWithReplicate(imageUrl, scale = 4, token) {
    if (!token) {
        throw new Error('REPLICATE_API_TOKEN is not configured for AI super-resolution');
    }
    const targetScale = Math.min(4, Math.max(2, Math.round(scale)));

    logger.info('Starting Replicate Real-ESRGAN super-resolution', { imageUrl, scale: targetScale });

    const response = await fetch('https://api.replicate.com/v1/models/nightmareai/real-esrgan/predictions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'wait=60',
        },
        body: JSON.stringify({
            input: {
                image: imageUrl,
                scale: targetScale,
                face_enhance: false, // Essential for fine art: preserve original painterly brushwork
            },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Replicate API call failed (${response.status}): ${errorText}`);
    }

    let prediction = await response.json();

    if (prediction.status === 'succeeded' && prediction.output) {
        const outputUrl = typeof prediction.output === 'string' ? prediction.output : prediction.output[0];
        logger.info('Replicate upscale completed immediately', { outputUrl });
        return outputUrl;
    }

    // If still in progress, poll the status URL
    const pollUrl = prediction.urls?.get;
    if (!pollUrl) {
        throw new Error(`Replicate prediction did not return a polling URL (status: ${prediction.status})`);
    }

    const maxWaitMs = 120000; // 2 minutes
    const startTime = Date.now();

    while (prediction.status === 'starting' || prediction.status === 'processing') {
        if (Date.now() - startTime > maxWaitMs) {
            throw new Error('Replicate upscale timed out after 120 seconds');
        }
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const pollRes = await fetch(pollUrl, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!pollRes.ok) {
            throw new Error(`Replicate poll failed (${pollRes.status})`);
        }
        prediction = await pollRes.json();
    }

    if (prediction.status === 'succeeded' && prediction.output) {
        const outputUrl = typeof prediction.output === 'string' ? prediction.output : prediction.output[0];
        logger.info('Replicate upscale polling completed', { outputUrl });
        return outputUrl;
    }

    throw new Error(`Replicate upscale finished with status: ${prediction.status} (${prediction.error || 'unknown error'})`);
}

module.exports = {
    upscaleWithReplicate,
};
