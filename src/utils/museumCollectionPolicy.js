/**
 * Museum collection policy for framed artwork.
 * Unrestricted access: allows all collection pieces with valid images.
 */
export function isFramableMuseumArtwork(sourceId, record) {
    if (!record) return false;
    return Boolean(record.image || record.fullRes);
}
