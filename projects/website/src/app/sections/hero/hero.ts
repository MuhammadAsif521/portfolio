import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { IconComponent } from '@shared/components/icon-component/icon-component';
import { HERO_CONTENT } from '../../content/hero.content';
import { withMotion } from '../../core/motion';
import { ScrollSpyDirective } from '../../core/scroll-spy.directive';
import { siteFeature } from '../../core/store/site.feature';

const TYPE_MS = 70;
const ERASE_MS = 35;
const HOLD_MS = 2200;

@Component({
  selector: 'app-hero',
  imports: [RouterLink, IconComponent, ScrollSpyDirective],
  templateUrl: './hero.html',
  styleUrl: './hero.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Hero {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly store = inject(Store);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly content = HERO_CONTENT;
  protected readonly stars = Array.from({ length: HERO_CONTENT.stat.rating });

  private readonly description = this.store.selectSignal(siteFeature.selectDescription);
  protected readonly resumeUrl = this.store.selectSignal(siteFeature.selectResumeUrl);
  protected readonly tagline = computed(() => this.description() || HERO_CONTENT.tagline);

  /** Typewriter state. SSR renders the first role, fully typed; the browser then types/erases the roles. */
  protected readonly role = signal<string>(HERO_CONTENT.roles[0]);
  protected readonly typing = signal(false);
  protected readonly portraitVisible = signal(true);

  constructor() {
    afterNextRender(() => {
      void withMotion((gsap) => {
        const items = this.host.nativeElement.querySelectorAll('[data-hero-anim]');
        gsap.from(items, { y: 28, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.09 });
        gsap.from(this.host.nativeElement.querySelector('.hero__arc'), {
          scale: 0.85,
          opacity: 0,
          duration: 1,
          ease: 'power3.out',
          delay: 0.15,
        });
      });
      // Typewriter everywhere (also with reduce motion: it is small text, no movement or parallax).
      this.startTypewriter();
    });
  }

  protected onPortraitError(): void {
    this.portraitVisible.set(false);
  }

  private startTypewriter(): void {
    if (!this.isBrowser || HERO_CONTENT.roles.length < 2) return;
    let roleIndex = 0;
    let chars: number = HERO_CONTENT.roles[0].length;
    let erasing = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      const target = HERO_CONTENT.roles[roleIndex] ?? '';
      if (erasing) {
        chars--;
        if (chars <= 0) {
          erasing = false;
          roleIndex = (roleIndex + 1) % HERO_CONTENT.roles.length;
        }
      } else {
        chars++;
      }
      const current = HERO_CONTENT.roles[roleIndex] ?? '';
      this.role.set((erasing ? target : current).slice(0, Math.max(chars, 0)));
      this.typing.set(true);

      if (!erasing && chars >= current.length) {
        erasing = true;
        this.typing.set(false);
        timer = setTimeout(tick, HOLD_MS);
      } else {
        timer = setTimeout(tick, erasing ? ERASE_MS : TYPE_MS);
      }
    };

    timer = setTimeout(tick, HOLD_MS);
    this.destroyRef.onDestroy(() => clearTimeout(timer));
  }
}
