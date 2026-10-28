import React from 'react';
import { ROOM_SCENES } from '../../data/roomScenes';

/**
 * Vertical thumbnail panel docked to the left of the visualizer on larger screens
 * (desktop / side-by-side mode), inspired by modern e-commerce product galleries (e.g. Dunelm).
 *
 * It allows customers to quickly switch between the primary Close-Up (plain wall) view
 * and contextual room scenes (Studio Loft, Dining Room, Bedroom, Entryway, Home Office)
 * without cluttering the visualizer canvas itself.
 */
const SCENE_OPTIONS = [
    {
        id: null,
        name: 'Close-Up',
        shortName: 'Close-Up',
        isRoom: false,
    },
    ...ROOM_SCENES.map((scene) => ({
        id: scene.id,
        name: scene.name,
        shortName: scene.name,
        isRoom: true,
        image: scene.image,
    })),
];

const RoomThumbnailRail = ({
    activeId,
    onSelect,
    wallColor,
    uploadedImage,
    selectedFrame,
    matWidth = 'none',
    matColor = null,
    outerFrameWidthCm = 4,
    outerFrameHeightCm = 3,
    className = '',
}) => {
    const frameAspectRatio = `${outerFrameWidthCm || 4} / ${outerFrameHeightCm || 3}`;
    const frameBgColor = selectedFrame?.baseColor || '#24211f';
    const matBgColor = matWidth !== 'none' ? (matColor?.hex || '#ffffff') : '#ffffff';

    return (
        <aside
            data-testid="room-thumbnail-rail"
            role="tablist"
            aria-label="Room views"
            className={`w-[88px] sm:w-[94px] shrink-0 h-full bg-[#faf9f8] border-r border-stone-200/80 flex flex-col items-center py-4 px-2 gap-3 overflow-y-auto select-none custom-scrollbar z-20 ${className}`}
        >
            {SCENE_OPTIONS.map((option) => {
                const isActive = option.id === activeId;
                const key = option.id ?? 'close-up';

                return (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-label={option.name}
                        title={option.name}
                        onClick={() => onSelect(option.id)}
                        className="group flex flex-col items-center gap-1 w-full shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 focus-visible:ring-offset-2 rounded-lg"
                    >
                        {/* Thumbnail image / card */}
                        <div
                            className={`relative w-[72px] h-[50px] rounded-lg overflow-hidden transition-all duration-200 ${
                                isActive
                                    ? 'ring-2 ring-stone-900 ring-offset-2 ring-offset-[#faf9f8] border border-stone-900 shadow-sm'
                                    : 'border border-stone-200/90 hover:border-stone-400 group-hover:shadow-sm bg-white'
                            }`}
                        >
                            {option.isRoom ? (
                                <>
                                    {/* Room scene backdrop */}
                                    <img
                                        src={option.image}
                                        alt=""
                                        aria-hidden="true"
                                        className="absolute inset-0 h-full w-full object-cover object-center"
                                        loading="lazy"
                                    />

                                    {/* Mini framed art preview on the room wall */}
                                    {uploadedImage && (
                                        <div
                                            aria-hidden="true"
                                            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-[0.5px] shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
                                            style={{
                                                left: '50%',
                                                top: '40%',
                                                width: '18%',
                                                aspectRatio: frameAspectRatio,
                                                backgroundColor: frameBgColor,
                                            }}
                                        >
                                            <div
                                                className="absolute inset-[0.5px]"
                                                style={{ backgroundColor: matBgColor }}
                                            >
                                                <div
                                                    className="absolute inset-[0.5px] bg-cover bg-center"
                                                    style={{ backgroundImage: `url(${uploadedImage})` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                /* Plain wall / close-up view */
                                <div
                                    className="relative w-full h-full flex items-center justify-center transition-colors"
                                    style={{ backgroundColor: wallColor?.hex || '#f5f5f4' }}
                                >
                                    {uploadedImage ? (
                                        <div
                                            aria-hidden="true"
                                            className="relative rounded-[0.5px] shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
                                            style={{
                                                width: '50%',
                                                aspectRatio: frameAspectRatio,
                                                backgroundColor: frameBgColor,
                                            }}
                                        >
                                            <div
                                                className="absolute inset-[1px]"
                                                style={{ backgroundColor: matBgColor }}
                                            >
                                                <div
                                                    className="absolute inset-[1.5px] bg-cover bg-center"
                                                    style={{ backgroundImage: `url(${uploadedImage})` }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        /* Clean mini frame outline if no image uploaded yet */
                                        <div
                                            aria-hidden="true"
                                            className="relative rounded-[0.5px] border border-stone-400/80 bg-white/70 shadow-[0_1px_2px_rgba(0,0,0,0.1)] flex items-center justify-center"
                                            style={{
                                                width: '46%',
                                                aspectRatio: frameAspectRatio,
                                            }}
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Caption under thumbnail */}
                        <span
                            className={`text-[10px] leading-tight text-center tracking-tight truncate w-full px-0.5 transition-colors ${
                                isActive
                                    ? 'font-semibold text-stone-900'
                                    : 'font-normal text-stone-500 group-hover:text-stone-800'
                            }`}
                        >
                            {option.shortName}
                        </span>
                    </button>
                );
            })}
        </aside>
    );
};

export default RoomThumbnailRail;
