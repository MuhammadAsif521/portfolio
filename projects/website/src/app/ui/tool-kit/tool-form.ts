import { type Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { FormControl } from '@angular/forms';
import { AnalyticsService } from '@shared/services/analytics.service';

/**
 * The tools keep their state in signals while the shared form components want a FormControl:
 * this reads a control as a signal (call in an injection context), so `control.setValue()` and typing
 * both flow into the tool's computed results.
 */
export function controlSignal<T>(control: FormControl<T>): Signal<T> {
  return toSignal(control.valueChanges, { initialValue: control.value as T });
}

/** Returns a function that fires the "tool_used" analytics event once per page view (call in an injection context). */
export function toolUsage(tool: string): () => void {
  const analytics = inject(AnalyticsService);
  let used = false;
  return () => {
    if (used) return;
    used = true;
    analytics.track('tool_used', { tool });
  };
}

/** Returns a function that fires the "result_copied" analytics event (call in an injection context). */
export function toolCopied(tool: string, extra: Record<string, string> = {}): () => void {
  const analytics = inject(AnalyticsService);
  return () => analytics.track('result_copied', { tool, ...extra });
}
