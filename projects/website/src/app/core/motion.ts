import type { DestroyRef } from '@angular/core';
import type { gsap as Gsap } from 'gsap';
import type { ScrollTrigger as ScrollTriggerType } from 'gsap/ScrollTrigger';

/*
 * GSAP is only ever loaded in the browser, lazily, and never for visitors who ask for reduced motion
 * (brief, Part 8). Components call these from afterNextRender().
 */

interface ScrollKit {
  gsap: typeof Gsap;
  ScrollTrigger: typeof ScrollTriggerType;
}

let loader: Promise<typeof Gsap> | null = null;
let scrollTriggerLoader: Promise<ScrollKit> | null = null;

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const loadGsap = () => (loader ??= import('gsap').then((module) => module.gsap));

/** Runs `animate` with GSAP unless the visitor prefers reduced motion (then content simply stays put). */
export async function withMotion(animate: (gsap: typeof Gsap) => void): Promise<void> {
  if (prefersReducedMotion()) return;
  animate(await loadGsap());
}

/** GSAP with the ScrollTrigger plugin registered (loaded once, on first use). */
async function loadScrollTrigger(): Promise<ScrollKit> {
  scrollTriggerLoader ??= Promise.all([loadGsap(), import('gsap/ScrollTrigger')]).then(([gsap, module]) => {
    const ScrollTrigger = module.ScrollTrigger as typeof ScrollTriggerType;
    gsap.registerPlugin(ScrollTrigger);
    return { gsap, ScrollTrigger };
  });
  return scrollTriggerLoader;
}

/**
 * Section reveal (brief: "fade + slide-up, staggered"): each element fades up once as its section
 * scrolls into view. Returns a cleanup function for DestroyRef.
 */
export async function revealOnScroll(trigger: Element, targets: Element[] | NodeListOf<Element>): Promise<() => void> {
  if (prefersReducedMotion() || !targets.length) return () => undefined;
  const { gsap } = await loadScrollTrigger();
  const tween = gsap.from(targets, {
    y: 32,
    opacity: 0,
    duration: 0.8,
    ease: 'power3.out',
    stagger: 0.1,
    scrollTrigger: { trigger, start: 'top 80%', once: true },
  });
  return () => {
    tween.scrollTrigger?.kill();
    tween.kill();
  };
}

/**
 * Timeline (brief: "connecting line draws in on scroll; node pulse on active"). The line grows with the
 * scroll position, and each item gets `.is-active` while it sits in the middle of the viewport.
 * With reduced motion nothing runs: the line stays fully drawn and no item pulses.
 */
export async function drawTimeline(trigger: Element, line: Element, items: Element[]): Promise<() => void> {
  if (prefersReducedMotion()) return () => undefined;
  const { gsap, ScrollTrigger } = await loadScrollTrigger();
  const tween = gsap.fromTo(
    line,
    { scaleY: 0 },
    {
      scaleY: 1,
      ease: 'none',
      transformOrigin: 'top center',
      scrollTrigger: { trigger, start: 'top 70%', end: 'bottom 60%', scrub: 0.4 },
    },
  );
  const markers = items.map((item) =>
    ScrollTrigger.create({ trigger: item, start: 'top 60%', end: 'bottom 60%', toggleClass: 'is-active' }),
  );
  return () => {
    markers.forEach((marker) => marker.kill());
    tween.scrollTrigger?.kill();
    tween.kill();
  };
}

/**
 * Ties an animation's async cleanup to a component's lifetime. The hook is registered immediately, so a
 * component destroyed before GSAP finishes loading still gets its animation killed (and never throws).
 */
export function disposeWith(destroyRef: DestroyRef, pending: Promise<() => void>): void {
  let destroyed = false;
  let cleanup: (() => void) | undefined;
  destroyRef.onDestroy(() => {
    destroyed = true;
    cleanup?.();
  });
  void pending.then((fn) => {
    if (destroyed) fn();
    else cleanup = fn;
  });
}
