/**
 * Phones draw markers inside MapLibre's WebGL2 context (deck.gl interleaved mode) so the page holds one fewer
 * full-screen drawing buffer and GPU context. `?deck=overlaid` keeps the separate canvas for comparison.
 */
export function useInterleavedDeck(renderer: 'webgl2' | 'webgpu', touch: boolean, search: string): boolean {
  return renderer === 'webgl2' && touch && new URLSearchParams(search).get('deck') !== 'overlaid';
}

