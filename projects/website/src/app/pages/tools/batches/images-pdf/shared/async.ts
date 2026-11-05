/** Small async helpers shared by the image and PDF tools. */

export const nextTask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Returns a function to call inside a long loop: it gives the browser a turn (so the page stays responsive and
 * the progress UI repaints) when more than `ms` milliseconds passed since the last turn.
 */
export function createYielder(ms = 30): () => Promise<void> {
  let last = Date.now();
  return async () => {
    if (Date.now() - last < ms) return;
    await nextTask();
    last = Date.now();
  };
}

export class AbortedError extends Error {
  constructor() {
    super('Cancelled.');
    this.name = 'AbortedError';
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new AbortedError();
}
