import { nextTask } from './async';
import { safeFileName, uniqueName } from './files';

export interface ZipEntry {
  name: string;
  data: Blob;
}

/**
 * Builds a ZIP in the browser with fflate's streaming writer, one entry at a time (so only one file is read into
 * memory besides the growing archive). Images and PDFs are already compressed, so entries are stored by default.
 * Entry names are made safe and unique.
 */
export async function zipEntries(entries: readonly ZipEntry[], options: { deflate?: boolean } = {}): Promise<Blob> {
  const { Zip, ZipPassThrough, ZipDeflate } = await import('fflate');
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let failure: Error | null = null;
  const zip = new Zip((error, chunk) => {
    if (error) failure = error;
    else chunks.push(chunk as Uint8Array<ArrayBuffer>);
  });
  const used = new Set<string>();
  for (const entry of entries) {
    const name = uniqueName(safeFileName(entry.name, 'file'), used);
    const file = options.deflate ? new ZipDeflate(name, { level: 6 }) : new ZipPassThrough(name);
    zip.add(file);
    file.push(new Uint8Array(await entry.data.arrayBuffer()), true);
    if (failure) throw failure;
    await nextTask();
  }
  zip.end();
  if (failure) throw failure;
  return new Blob(chunks, { type: 'application/zip' });
}

/** Saves a Blob with the browser's download behaviour. Call from a click handler. */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15_000);
}
