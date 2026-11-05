/** Small browser helpers shared by the developer tools. Every function touches the DOM only when called. */

/** Gives the browser a turn to paint and handle input between chunks of work. */
export const yieldToMain = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Saves a Blob through a temporary link; the object URL is revoked right after. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  downloadBlob(filename, new Blob([text], { type: `${mime};charset=utf-8` }));
}
