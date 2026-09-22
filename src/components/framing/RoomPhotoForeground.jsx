import React, { useId } from 'react';
import { ROOM_PHOTO_MASKS, ROOM_MASK_EDGE_INSET } from '../../data/roomPhotoMasks';

/** Preserve original furniture pixels, with the wall mask as the sole boundary. */
export default function RoomPhotoForeground({ room }) {
    const id = useId().replace(/:/g, '');
    const maskId = `room-objects-${id}`;
    const invertId = `room-invert-${id}`;
    const edgeId = `room-edge-${id}`;
    const baseId = `room-base-${id}`;
    const geometryId = `room-geometry-${id}`;
    const foliageId = `room-foliage-${id}`;
    const foliageClipId = `room-foliage-clip-${id}`;
    const definition = ROOM_PHOTO_MASKS[room.id];
    return (
        <svg className="block h-full w-full" viewBox="0 0 1536 1024" preserveAspectRatio="none" aria-hidden="true">
            <defs>
                <filter id={invertId} colorInterpolationFilters="sRGB">
                    <feComponentTransfer>
                        <feFuncR type="linear" slope="-1" intercept="1" />
                        <feFuncG type="linear" slope="-1" intercept="1" />
                        <feFuncB type="linear" slope="-1" intercept="1" />
                    </feComponentTransfer>
                </filter>
                <filter id={edgeId} x="0" y="0" width="1536" height="1024" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feMorphology operator="erode" radius={ROOM_MASK_EDGE_INSET} />
                </filter>
                {/* In foliage only, neutral beige pixels are wall showing through
                    leaves. Key the ORIGINAL photo, never the user's paint colour.
                    Furniture, ceramics, upholstery and flooring are excluded. */}
                <filter id={foliageId} colorInterpolationFilters="sRGB">
                    <feColorMatrix in="SourceGraphic" result="chroma" type="matrix" values="8.64 0 -12 0 1.2  8.64 0 -12 0 1.2  8.64 0 -12 0 1.2  0 0 0 0 1" />
                    {/* Dark, low-saturation leaves and fine twigs are objects,
                        even when their hue resembles the neutral wall. */}
                    <feColorMatrix in="SourceGraphic" result="darkDetails" type="matrix" values="-12 0 0 0 7.2  -12 0 0 0 7.2  -12 0 0 0 7.2  0 0 0 0 1" />
                    <feBlend in="chroma" in2="darkDetails" mode="lighten" />
                </filter>
                <clipPath id={foliageClipId}>
                    {definition?.foliage?.map(rect => <rect key={`${rect.x}-${rect.y}`} {...rect} />)}
                </clipPath>
                <g id={geometryId}>
                    <image href={room.wallMaskImage} width="1536" height="1024" preserveAspectRatio="none" filter={`url(#${invertId})`} />
                    {definition?.corrections.map(({ d, fill }) => (
                        <path key={d} d={d} fill={fill} />
                    ))}
                </g>
                <mask id={baseId} maskUnits="userSpaceOnUse" x="0" y="0" width="1536" height="1024" style={{ maskType: 'luminance' }}>
                    <use href={`#${geometryId}`} />
                </mask>
                <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1536" height="1024" style={{ maskType: 'luminance' }}>
                    <g filter={`url(#${edgeId})`}>
                        <use href={`#${geometryId}`} />
                    </g>
                    {/* Do not erode foliage: a one-pixel stem must survive at
                        small/mobile sizes just as it does in the source. */}
                    {definition?.foliage?.length > 0 && <g clipPath={`url(#${foliageClipId})`}>
                        <rect width="1536" height="1024" fill="black" />
                        <image href={room.image} width="1536" height="1024" preserveAspectRatio="none" filter={`url(#${foliageId})`} mask={`url(#${baseId})`} />
                    </g>}
                </mask>
            </defs>
            <image href={room.image} width="1536" height="1024" preserveAspectRatio="none" mask={`url(#${maskId})`} />
        </svg>
    );
}
