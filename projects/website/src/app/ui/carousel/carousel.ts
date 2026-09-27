import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  TemplateRef,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';

export interface CarouselSlideContext<T> {
  $implicit: T;
  index: number;
}

/**
 * Accessible, swipeable carousel (brief, Part 8: swipe/drag-enabled, synced dot pagination).
 *
 * - Touch swipe and trackpads use native scroll-snap; mouse users can drag.
 * - Dots follow the scroll position and are hidden when every slide already fits.
 * - Screen readers get a labelled carousel region with "slide n of m" groups; dots are real buttons.
 *
 *   <app-carousel [items]="items" label="Services" [slide]="card" />
 *   <ng-template #card let-item let-i="index">…</ng-template>
 */
@Component({
  selector: 'app-carousel',
  imports: [NgTemplateOutlet, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './carousel.html',
  styleUrl: './carousel.scss',
})
export class Carousel<T> {
  readonly items = input.required<readonly T[]>();
  readonly slide = input.required<TemplateRef<CarouselSlideContext<T>>>();
  /** Accessible name of the carousel, e.g. "Services". */
  readonly label = input.required<string>();
  /** Dot colours for dark bands (the default suits light backgrounds). */
  readonly onDark = input(false);
  /** Centre the slide in view (partial neighbours on both sides, Figma testimonials). */
  readonly centered = input(false);

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Index of the slide in view; two-way bindable (`[(active)]`) so a parent can show its details. */
  readonly active = model(0);
  /** false until measured in the browser, so SSR and wide screens don't show pointless dots. */
  protected readonly overflowing = signal(false);
  protected readonly dragging = signal(false);
  /** Scroll position at either end (prev/next buttons disable there). */
  protected readonly atStart = signal(true);
  protected readonly atEnd = signal(false);
  protected readonly count = computed(() => this.items().length);

  constructor() {
    afterNextRender(() => this.attach());
  }

  /** Scrolls a slide into view (dots; also usable by a parent via a template ref). */
  goTo(index: number): void {
    const track = this.track().nativeElement;
    const slide = track.children.item(index) as HTMLElement | null;
    if (!slide) return;
    const reduce = matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({ left: this.slideLeft(track, slide), behavior: reduce ? 'auto' : 'smooth' });
    this.active.set(index);
  }

  /** Previous / next slide (the arrow buttons on large screens). */
  step(delta: number): void {
    this.goTo(Math.min(Math.max(this.active() + delta, 0), this.count() - 1));
  }

  private updateEnds(track: HTMLElement): void {
    this.atStart.set(track.scrollLeft <= 2);
    this.atEnd.set(track.scrollLeft + track.clientWidth >= track.scrollWidth - 2);
  }

  private attach(): void {
    if (!this.isBrowser) return;
    const track = this.track().nativeElement;

    const measure = () => {
      this.overflowing.set(track.scrollWidth - track.clientWidth > 2);
      this.updateEnds(track);
      this.active.set(this.nearestIndex(track));
    };

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        this.active.set(this.nearestIndex(track));
        this.updateEnds(track);
      });
    };
    track.addEventListener('scroll', onScroll, { passive: true });

    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    resize?.observe(track);
    measure();
    // Centred carousels open on the second slide so there is a neighbour on each side.
    if (this.centered() && this.count() > 2) {
      const second = track.children.item(1) as HTMLElement | null;
      if (second) track.scrollLeft = this.slideLeft(track, second);
      this.active.set(1);
    }

    // Mouse drag (touch and pens already scroll natively).
    let startX = 0;
    let startScroll = 0;
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || !this.overflowing()) return;
      startX = event.clientX;
      startScroll = track.scrollLeft;
      this.dragging.set(true);
      track.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!this.dragging()) return;
      track.scrollLeft = startScroll - (event.clientX - startX);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!this.dragging()) return;
      this.dragging.set(false);
      if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
      this.goTo(this.nearestIndex(track)); // settle on a slide, as the snap would
    };
    // A drag shouldn't also count as a click on a card link.
    const onClickCapture = (event: MouseEvent) => {
      if (Math.abs(track.scrollLeft - startScroll) > 6 && startScroll !== -1) {
        event.preventDefault();
        event.stopPropagation();
      }
      startScroll = -1;
    };
    track.addEventListener('pointerdown', onPointerDown);
    track.addEventListener('pointermove', onPointerMove);
    track.addEventListener('pointerup', onPointerUp);
    track.addEventListener('pointercancel', onPointerUp);
    track.addEventListener('click', onClickCapture, true);

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      track.removeEventListener('scroll', onScroll);
      track.removeEventListener('pointerdown', onPointerDown);
      track.removeEventListener('pointermove', onPointerMove);
      track.removeEventListener('pointerup', onPointerUp);
      track.removeEventListener('pointercancel', onPointerUp);
      track.removeEventListener('click', onClickCapture, true);
    });
  }

  private nearestIndex(track: HTMLElement): number {
    const slides = Array.from(track.children) as HTMLElement[];
    if (!slides.length) return 0;
    const scrollable = track.scrollWidth - track.clientWidth > 2;
    if (!scrollable) return 0; // everything fits: the first slide is the one "in view"
    // At the far right edge the last slide is the active one even if it isn't at the start.
    if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 2) return slides.length - 1;
    let best = 0;
    slides.forEach((slide, index) => {
      const distance = Math.abs(this.slideLeft(track, slide) - track.scrollLeft);
      const bestDistance = Math.abs(this.slideLeft(track, slides[best] as HTMLElement) - track.scrollLeft);
      if (distance < bestDistance) best = index;
    });
    return best;
  }

  /** scrollLeft that brings `slide` into its snap position (start, or centre when `centered`). */
  private slideLeft(track: HTMLElement, slide: HTMLElement): number {
    // From rects (not offsetLeft, which depends on the offset parent), in the track's scroll coordinates.
    const start = track.scrollLeft + slide.getBoundingClientRect().left - track.getBoundingClientRect().left;
    return this.centered() ? start - (track.clientWidth - slide.offsetWidth) / 2 : start;
  }
}
