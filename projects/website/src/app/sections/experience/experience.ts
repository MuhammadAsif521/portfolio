import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { Experience as ExperienceDoc } from '@shared/interfaces/public-api.interface';
import { PublicApiService } from '@shared/services/public-api.service';
import { catchError, of } from 'rxjs';
import { EXPERIENCE_CONTENT, type TimelineEntry } from '../../content/experience.content';
import { disposeWith, drawTimeline, revealOnScroll } from '../../core/motion';
import { ScrollSpyDirective } from '../../core/scroll-spy.directive';

// UTC so SSR and the browser print the same month whatever their time zones.
const MONTH_YEAR = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "2025-10-01" → { label: "Oct 2025", iso: "2025-10" }; null for missing or unparseable dates. */
export function monthYear(value: string | undefined): { label: string; iso: string } | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return { label: MONTH_YEAR.format(date), iso: date.toISOString().slice(0, 7) };
}

/** "Experience" (brief, Part 6/8): newest-first timeline whose line draws in on scroll. */
@Component({
  selector: 'app-experience',
  imports: [ScrollSpyDirective],
  templateUrl: './experience.html',
  styleUrl: './experience.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Experience {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly content = EXPERIENCE_CONTENT;
  protected readonly monthYear = monthYear;

  /** null until the API answers; [] when it fails (the fallback then stays). Resolved during SSR. */
  private readonly live = toSignal(
    inject(PublicApiService)
      .getExperience()
      .pipe(catchError(() => of([] as ExperienceDoc[]))),
    { initialValue: null },
  );

  protected readonly entries = computed<readonly TimelineEntry[]>(() => {
    const live = this.live();
    return live?.length ? live : EXPERIENCE_CONTENT.fallback;
  });

  constructor() {
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const section = root.querySelector('section');
      if (!section) return;
      disposeWith(this.destroyRef, revealOnScroll(section, root.querySelectorAll('[data-reveal]')));
    });

    // Re-bound whenever the rendered entries change (e.g. live data replacing the fallback).
    afterRenderEffect((onCleanup) => {
      this.entries();
      const root = this.host.nativeElement;
      const list = root.querySelector('.timeline');
      const line = root.querySelector('.timeline__line');
      if (!list || !line) return;

      let dispose: () => void = () => undefined;
      let alive = true;
      void drawTimeline(list, line, Array.from(root.querySelectorAll('.timeline__item'))).then((cleanup) => {
        if (alive) dispose = cleanup;
        else cleanup();
      });
      onCleanup(() => {
        alive = false;
        dispose();
      });
    });
  }
}
