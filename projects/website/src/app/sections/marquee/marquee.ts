import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, viewChild } from '@angular/core';
import { MARQUEE_CONTENT } from '../../content/testimonials.content';

/**
 * Skills strip (brief, Parts 6/8; Figma): a white strip tilted across an orange band, scrolling right to
 * left. Pure CSS animation, so it runs from first paint (no JS or hydration needed) and pauses on hover.
 * The browser only fine-tunes the duration so the speed is MARQUEE_CONTENT.speed px/s at any width.
 * With the OS "reduce motion" setting (Windows: Settings → Accessibility → Visual effects → Animation
 * effects off) it deliberately stays still.
 */
@Component({
  selector: 'app-marquee',
  templateUrl: './marquee.html',
  styleUrl: './marquee.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Marquee {
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  protected readonly content = MARQUEE_CONTENT;

  constructor() {
    afterNextRender(() => {
      const track = this.track().nativeElement;
      const distance = track.scrollWidth / 2; // the list is rendered twice
      if (distance > 0) {
        track.style.setProperty('--marquee-duration', `${Math.max(distance / MARQUEE_CONTENT.speed, 8)}s`);
      }
    });
  }
}
