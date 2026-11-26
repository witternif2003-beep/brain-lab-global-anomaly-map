/** deck.gl draws SimpleMeshLayer yaw 180° off under its GlobeView (visgl/deck.gl#7362), which MapLibreOverlay uses on a globe map up to zoom 12. */
export const GA_DECK_GLOBE_MAX_ZOOM = 12;
export const deckGlobeActive = (projection: string | undefined, zoom: number): boolean => projection === 'globe' && zoom <= GA_DECK_GLOBE_MAX_ZOOM;
/** Mesh yaw (degrees counter-clockwise from east, +x forward) that points the nose along a compass track. */
export const meshYaw = (track: number | undefined, globe: boolean): number => (track === undefined ? 0 : (globe ? 270 : 90) - track);
