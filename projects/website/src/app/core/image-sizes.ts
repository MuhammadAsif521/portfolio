/*
 * `sizes` for the responsive CDN images (srcset: -w480 / -w960 / original 1600w). Each value is the
 * image's rendered CSS width per layout, measured in a production SSR build (Playwright, DPR 1):
 *
 *   viewport                 390   768   1024  1280  ≥1366
 *   project card (carousel)  312   349   468   596   628
 *   post card (home / blog)  355   344   303   388   410 / 389
 *   blog post cover          355   714   960   1024  1024
 *   project case cover       355   714   960   1152  1152
 *
 * Slightly generous values (a few px over) are fine; under-estimating would pick a blurry candidate.
 * Keep in sync with the layouts if the carousel slide, blog grid or cover max-widths change.
 */

/** Projects carousel slide: ~82vw (one card) below 768px, two cards above, 628px at the 80rem container. */
export const PROJECT_CARD_SIZES = '(min-width: 1366px) 628px, (min-width: 768px) 47vw, 82vw';

/** Blog teaser card: one column below 768px, two to 1023px, three above, 410px at the container max. */
export const POST_CARD_SIZES = '(min-width: 1366px) 410px, (min-width: 1024px) 31vw, (min-width: 768px) 46vw, 93vw';

/** /blog/:slug cover: full content width, capped at 64rem. */
export const POST_COVER_SIZES = '(min-width: 1100px) 1024px, 94vw';

/** /projects/:slug cover: full content width, capped at --case-wide (72rem). */
export const PROJECT_COVER_SIZES = '(min-width: 1230px) 1152px, 94vw';
