/** Saves text as a file from the browser (no network). Adds a UTF-8 byte order mark when asked (Excel needs it). */
export function downloadText(name: string, text: string, mime: string, bom = false): void {
  const blob = new Blob([bom ? '﻿' : '', text], { type: `${mime};charset=utf-8` });
  downloadBlob(name, blob);
}

export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "orders.final.csv" and "json" give "orders.final.json"; no source name gives the fallback. */
export function renameFile(source: string, extension: string, fallback = 'converted'): string {
  const base = source.replace(/\.[^./\\]+$/, '').replace(/[\\/:*?"<>|]+/g, '_').trim();
  return `${base || fallback}.${extension}`;
}
