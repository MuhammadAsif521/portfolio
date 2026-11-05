import { type Signal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { FormControl } from '@angular/forms';
import { debounce, timer } from 'rxjs';
import { debounceFor } from './text-utils';

/**
 * A control's value as a signal that settles after the user stops typing: no delay for short text, up to a
 * few hundred ms for a multi-megabyte paste. Call in an injection context.
 */
export function debouncedControlSignal(control: FormControl<string>): Signal<string> {
  const out = signal(control.value);
  control.valueChanges
    .pipe(
      debounce((v) => timer(debounceFor(v.length))),
      takeUntilDestroyed(),
    )
    .subscribe((v) => out.set(v));
  return out.asReadonly();
}

/** Reads a picked text file (as UTF-8) with a size limit; resolves with the text or a plain-language error. */
export async function readTextFile(file: File, maxMb: number): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (file.size > maxMb * 1024 * 1024) return { ok: false, error: `That file is larger than ${maxMb} MB. Paste the part you need instead.` };
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // A NUL byte almost never appears in text; it means a binary file (image, PDF, archive).
    if (bytes.subarray(0, 4096).includes(0) && !(bytes[0] === 0xff && bytes[1] === 0xfe) && !(bytes[0] === 0xfe && bytes[1] === 0xff)) {
      return { ok: false, error: 'This looks like a binary file, not text. Choose a .txt, .md or .csv file.' };
    }
    let encoding = 'utf-8';
    if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
    const text = new TextDecoder(encoding).decode(buffer);
    return { ok: true, text };
  } catch {
    return { ok: false, error: 'That file could not be read as text.' };
  }
}

/** Saves text as a UTF-8 file through a temporary link. Browser only: call from a click handler. */
export function downloadTextFile(name: string, text: string, type = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
