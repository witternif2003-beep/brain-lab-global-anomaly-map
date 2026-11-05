import type { IControl } from 'maplibre-gl';

/** Collapsed ⓘ control holding only the licence-required credits; it starts closed. */
export class CreditsControl implements IControl {
  private container: HTMLElement | null = null;

  constructor(private readonly html: string) {}

  onAdd(): HTMLElement {
    const el = document.createElement('details');
    el.className = 'maplibregl-ctrl maplibregl-ctrl-attrib maplibregl-compact';
    const summary = document.createElement('summary');
    summary.className = 'maplibregl-ctrl-attrib-button';
    summary.title = 'Credits';
    summary.setAttribute('aria-label', 'Credits');
    const inner = document.createElement('div');
    inner.className = 'maplibregl-ctrl-attrib-inner';
    inner.innerHTML = this.html;
    el.append(summary, inner);
    el.addEventListener('toggle', () => el.classList.toggle('maplibregl-compact-show', (el as HTMLDetailsElement).open));
    this.container = el;
    return el;
  }

  onRemove(): void {
    this.container?.remove();
    this.container = null;
  }
}
