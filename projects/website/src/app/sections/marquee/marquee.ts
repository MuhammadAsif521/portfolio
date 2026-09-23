import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { MARQUEE_CONTENT } from '../../content/testimonials.content';
import { marqueeLoop, prefersReducedMotion, type LoopControls } from '../../core/motion';

/**
 * Skills strip (brief, Parts 6/8): a tilted orange band scrolling continuously. Pauses on hover and
 * keyboard focus, and has a pause button (WCAG 2.2.2: moving content must be stoppable). With reduced
 * motion it is a still, wrapped list and the button is not shown.
 */
@Component({
  selector: 'app-marquee',
  imports: [IconComponent],
  templateUrl: './marquee.html',
  styleUrl: './marquee.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Marquee {
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  protected readonly content = MARQUEE_CONTENT;
  /** true once the loop runs in the browser (never during SSR or with reduced motion). */
  protected readonly animated = signal(false);
  /** Reduced motion: switch to the wrapped, still layout (SSR renders the strip layout). */
  protected readonly still = signal(false);
  /** The visitor's choice from the pause button; hover/focus pauses are temporary on top of it. */
  protected readonly playing = signal(true);

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
        this.animated.set(loop !== null);
      });
    });
  }

  protected toggle(): void {
    this.playing.update((playing) => !playing);
    if (this.playing()) this.loop?.play();
    else this.loop?.pause();
  }

  protected holdPause(): void {
    this.loop?.pause();
  }

  protected releasePause(): void {
    if (this.playing()) this.loop?.play();
  }
}
