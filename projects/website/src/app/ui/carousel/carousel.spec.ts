import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterLink, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Carousel, DRAG_THRESHOLD } from './carousel';

@Component({
  imports: [Carousel, RouterLink],
  template: `
    <app-carousel [items]="items" [slide]="slide" label="Test" />
    <ng-template #slide let-item>
      <a class="card-link" [routerLink]="['/projects', item]">{{ item }}</a>
    </ng-template>
  `,
})
class Host {
  readonly items = ['a', 'b', 'c'];
}

type PointerKind = 'mouse' | 'touch';

/** Dispatches a pointer event (jsdom may lack PointerEvent, so fall back to a MouseEvent with the fields). */
function pointer(target: Element, type: string, clientX: number, pointerType: PointerKind = 'mouse'): void {
  const init = { bubbles: true, cancelable: true, composed: true, button: 0, clientX, pointerId: 1, pointerType };
  const Ctor = (globalThis as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? MouseEvent;
  const event = new Ctor(type, init);
  for (const key of ['pointerId', 'pointerType'] as const) {
    if ((event as unknown as Record<string, unknown>)[key] !== init[key]) {
      Object.defineProperty(event, key, { value: init[key] });
    }
  }
  target.dispatchEvent(event);
}

describe('Carousel drag vs click', () => {
  let track: HTMLElement;
  let link: HTMLAnchorElement;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    window.matchMedia = ((query: string) =>
      ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    track = el.querySelector('.carousel__track')!;
    link = el.querySelector('.card-link')!;
    // jsdom has no layout: make the track overflow (three slides, room for one) and stub scrolling.
    Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 300 });
    track.scrollTo = vi.fn() as unknown as typeof track.scrollTo;
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  }, 30_000); // the first render lazy-loads the icon set, slow on a busy machine

  /** A full press: down on the link, optional moves, up, then the click the browser fires. */
  function press(moves: number[], pointerType: PointerKind = 'mouse'): void {
    pointer(link, 'pointerdown', 200, pointerType);
    for (const x of moves) pointer(link, 'pointermove', x, pointerType);
    pointer(link, 'pointerup', moves.at(-1) ?? 200, pointerType);
    link.click();
  }

  it('renders each slide link as a real, crawlable href', () => {
    expect(link.getAttribute('href')).toBe('/projects/a');
  });

  it('lets a plain mouse click on a slide link navigate', () => {
    press([]);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(String(navigate.mock.calls[0]?.[0])).toBe('/projects/a');
  });

  it('only captures the pointer once a press becomes a drag (capture would retarget the click to the track)', () => {
    const capture = vi.fn();
    track.setPointerCapture = capture;
    press([]);
    expect(capture).not.toHaveBeenCalled();
    press([200 - DRAG_THRESHOLD - 1]);
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('treats a few pixels of hand jitter as a click, not a drag', () => {
    press([200 - (DRAG_THRESHOLD - 2)]);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('swallows the click that ends a mouse drag, then lets the next click through', () => {
    press([180, 120, 60]);
    expect(navigate).not.toHaveBeenCalled();
    expect(track.scrollTo).toHaveBeenCalled(); // settled on a slide

    press([]);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('does not swallow a keyboard activation after a drag', async () => {
    pointer(link, 'pointerdown', 200);
    pointer(link, 'pointermove', 100);
    pointer(link, 'pointerup', 100); // drag ended without a click (pointer left the link)
    await new Promise((resolve) => setTimeout(resolve));
    link.click(); // Enter on the focused link
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('never blocks a touch tap, even after the track was swiped', () => {
    track.scrollLeft = 400; // a native swipe moved the track
    track.dispatchEvent(new Event('scroll'));
    press([], 'touch');
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
