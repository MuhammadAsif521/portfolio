import type { gsap as Gsap } from 'gsap';

/*
 * GSAP is only ever loaded in the browser, lazily, and never for visitors who ask for reduced motion
 * (brief, Part 8). Components call `withMotion()` from afterNextRender().
 */

let loader: Promise<typeof Gsap> | null = null;

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Runs `animate` with GSAP unless the visitor prefers reduced motion (then content simply stays put). */
export async function withMotion(animate: (gsap: typeof Gsap) => void): Promise<void> {
  if (prefersReducedMotion()) return;
  loader ??= import('gsap').then((module) => module.gsap);
  animate(await loader);
}
