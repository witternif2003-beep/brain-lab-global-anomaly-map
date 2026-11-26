/** `?e2e=1`: stop per-frame animation loops so MapLibre can reach 'idle' (render tests on a CPU-only browser). */
export function staticRender(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('e2e') === '1';
}
