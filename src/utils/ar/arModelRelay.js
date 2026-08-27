const RELAY_BASE = '/api/ar-relay';

/**
 * Gives the native app's AR viewer a real HTTPS URL to fetch, for the one
 * case that actually needs one — see functions/index.js's arRelay for why
 * a blob: URL isn't enough inside Capacitor's WKWebView / for Android's
 * Scene Viewer to read.
 *
 * `blobUrl` is re-fetched (not passed as bytes directly) so callers can
 * hand over whatever buildArModel already produced without holding a
 * second copy of the bytes around just for this — fetching a blob: URL
 * from the page that created it is just a memory read, not a network hop.
 */
export async function relayArModel(blobUrl, kind) {
    const bytes = await fetch(blobUrl).then((r) => r.arrayBuffer());
    const response = await fetch(RELAY_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', 'X-Relay-Kind': kind },
        body: bytes,
    });
    if (!response.ok) {
        throw new Error(`AR model relay failed (${response.status})`);
    }
    const { url } = await response.json();

    // Re-anchored to whichever host actually served this page. The function
    // can only name one canonical origin, but the app is reachable on more
    // than one (the custom domain and the web.app default), and the relay
    // path is rewritten identically on both. Keeping the model same-origin
    // is what lets ar-launch.html refuse every URL except our own without
    // also refusing the real one.
    return new URL(new URL(url, window.location.origin).pathname, window.location.origin).toString();
}
