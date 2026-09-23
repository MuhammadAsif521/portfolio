import type { gsap as Gsap } from 'gsap';
import type { ScrollTrigger as ScrollTriggerType } from 'gsap/ScrollTrigger';

/*
 * GSAP is only ever loaded in the browser, lazily, and never for visitors who ask for reduced motion
 * (brief, Part 8). Components call these from afterNextRender().
 */

let loader: Promise<typeof Gsap> | null = null;
let scrollTriggerLoader: Promise<typeof Gsap> | null = null;

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
async function loadScrollTrigger(): Promise<typeof Gsap> {
  scrollTriggerLoader ??= Promise.all([loadGsap(), import('gsap/ScrollTrigger')]).then(([gsap, module]) => {
    gsap.registerPlugin(module.ScrollTrigger as typeof ScrollTriggerType);
    return gsap;
  });
  return scrollTriggerLoader;
}

/**
 * Section reveal (brief: "fade + slide-up, staggered"): each element fades up once as its section
 * scrolls into view. Returns a cleanup function for DestroyRef.
 */
export async function revealOnScroll(trigger: Element, targets: Element[] | NodeListOf<Element>): Promise<() => void> {
  if (prefersReducedMotion() || !targets.length) return () => undefined;
  const gsap = await loadScrollTrigger();
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
