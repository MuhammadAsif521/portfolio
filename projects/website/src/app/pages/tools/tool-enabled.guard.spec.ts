import { TestBed } from '@angular/core/testing';
import type { Route, UrlSegment } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { describe, expect, it } from 'vitest';
import { siteFeature } from '../../core/store/site.feature';
import { toolEnabled } from './tool-enabled.guard';
import { injectLiveTools } from './live-tools';

function setup(disabled: string[]) {
  TestBed.configureTestingModule({
    providers: [provideMockStore({ selectors: [{ selector: siteFeature.selectDisabledTools, value: disabled }] })],
  });
}

const run = (slug: string) =>
  TestBed.runInInjectionContext(() => toolEnabled(slug)({} as Route, [] as UrlSegment[], {} as never));

describe('toolEnabled / injectLiveTools', () => {
  it('matches enabled tools and rejects switched-off ones (router then falls through to the 404 route)', () => {
    setup(['jwt-decoder']);
    expect(run('jwt-decoder')).toBe(false);
    expect(run('objectid-to-date')).toBe(true);
  });

  it('drops switched-off tools from every list', () => {
    setup(['jwt-decoder', 'http-status-codes']);
    const live = TestBed.runInInjectionContext(() => injectLiveTools());
    const slugs = live().map((t) => t.slug);
    expect(slugs).not.toContain('jwt-decoder');
    expect(slugs).not.toContain('http-status-codes');
    expect(slugs).toContain('objectid-to-date');
  });
});
