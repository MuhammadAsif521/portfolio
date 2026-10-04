import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import { MARQUEE_CONTENT } from '../../content/testimonials.content';

/** Shortest loop (s), so a narrow phone strip never races past. */
const MIN_DURATION = 8;

/**
 * Seconds for one loop (half the track: two of the four lists) at `speed` px/s, or null when the
 * width can't be measured yet (0, NaN, before layout); the CSS fallback duration then stays in place.
 */
export function marqueeDuration(trackWidth: number, speed: number = MARQUEE_CONTENT.speed): number | null {
  const distance = trackWidth / 2;
  if (!Number.isFinite(distance) || distance <= 0 || !(speed > 0)) return null;
  return Math.max(distance / speed, MIN_DURATION);
}

/**
 * Skills strip (brief, Parts 6/8; Figma): a white strip tilted across an orange band, scrolling right to
 * left. Pure CSS animation (the list is rendered four times and the track moves by -50%), so it runs from
 * first paint with no JS or hydration needed, and pauses on mouse hover (not on touch: a tap would leave
 * :hover stuck and freeze it). The browser only fine-tunes the duration so the speed is
 * MARQUEE_CONTENT.speed px/s at any width, re-measuring once web fonts load and on resize.
 * With the OS "reduce motion" setting (iOS: Reduce Motion; Android: Remove animations, which some
 * battery savers switch on; Windows: Animation effects off) it deliberately stays still.
 */
@Component({
  selector: 'app-marquee',
  templateUrl: './marquee.html',
  styleUrl: './marquee.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Marquee {
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private readonly destroyRef = inject(DestroyRef);

  protected readonly content = MARQUEE_CONTENT;
  /** Hidden copies after the real list (4 lists in all; the track loops by half its width). */
  protected readonly copies = [1, 2, 3];

  constructor() {
    afterNextRender(() => {
      const track = this.track().nativeElement;
      const tune = () => {
        const seconds = marqueeDuration(track.scrollWidth);
        if (seconds !== null) track.style.setProperty('--marquee-duration', `${seconds.toFixed(2)}s`);
      };
      tune();
      // Web fonts change the text width; re-tune once they're in.
      document.fonts?.ready.then(tune).catch(() => undefined);
      // Item sizes follow the viewport (clamp); only react to width changes of the strip.
      const band = track.parentElement;
      if (band && typeof ResizeObserver === 'function') {
        let width = band.clientWidth;
        const resize = new ResizeObserver(() => {
          if (band.clientWidth === width) return;
          width = band.clientWidth;
          tune();
        });
        resize.observe(band);
        this.destroyRef.onDestroy(() => resize.disconnect());
      }
    });
  }
}
