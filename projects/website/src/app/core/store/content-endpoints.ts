/** Public endpoints whose data lives in the NgRx content cache (and travels as NgRx state, not HTTP cache). */
const CONTENT_ENDPOINT = /\/public\/(projects|blog|testimonials|experience)(\/|\?|$)/;

export function isContentRequest(url: string): boolean {
  return CONTENT_ENDPOINT.test(url);
}
