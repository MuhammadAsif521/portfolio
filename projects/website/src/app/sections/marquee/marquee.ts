import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { MARQUEE_CONTENT } from '../../content/testimonials.content';
import { marqueeLoop, prefersReducedMotion, type LoopControls } from '../../core/motion';

/**
 * Skills strip (brief, Parts 6/8; Figma): a white strip tilted across an orange band, scrolling
 * continuously. Pauses while hovered or while something inside has keyboard focus; with reduced motion
 * it stays still.
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
  /** Reduced motion: the still, centred layout (SSR renders the strip layout). */
  protected readonly still = signal(false);

  private loop: LoopControls | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    let destroyed = false;
    destroyRef.onDestroy(() => {
      destroyed = true;
      this.loop?.kill();
    });

    afterNextRender(() => {
      if (prefersReducedMotion()) {
        this.still.set(true);
        return;
      }
      void marqueeLoop(this.track().nativeElement, MARQUEE_CONTENT.speed).then((loop) => {
        if (destroyed) return loop?.kill();
        this.loop = loop;
      });
    });
  }

  protected holdPause(): void {
    this.loop?.pause();
  }

  protected releasePause(): void {
    this.loop?.play();
  }
}
