import { inject, type Signal, computed } from '@angular/core';
import { Store } from '@ngrx/store';
import { TOOLS, type ToolMeta } from '@shared/tools/tools.manifest';
import { siteFeature } from '../../core/store/site.feature';

/** Tools not switched off in cusadmin, in manifest order. Call in an injection context. */
export function injectLiveTools(): Signal<readonly ToolMeta[]> {
  const disabled = inject(Store).selectSignal(siteFeature.selectDisabledTools);
  return computed(() => {
    const off = disabled();
    return off.length ? TOOLS.filter((tool) => !off.includes(tool.slug)) : TOOLS;
  });
}
