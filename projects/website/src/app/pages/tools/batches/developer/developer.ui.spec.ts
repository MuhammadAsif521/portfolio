import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { TOOLS } from '@shared/tools/tools.manifest';
import { describe, expect, it } from 'vitest';
import { provideWebsiteIcons } from '../../../../core/icons';
import { siteFeature } from '../../../../core/store/site.feature';
import { toolPresentation } from '../../tool-meta';
import { ColorConverterTool } from './color-converter/color-converter';
import { HashGeneratorTool } from './hash-generator/hash-generator';
import { JsonViewerTool } from './json-viewer/json-viewer';
import { MetaTagGeneratorTool } from './meta-tag-generator/meta-tag-generator';
import { PasswordGeneratorTool } from './password-generator/password-generator';
import { QrCodeGeneratorTool } from './qr-code-generator/qr-code-generator';
import { RobotsTxtGeneratorTool } from './robots-txt-generator/robots-txt-generator';
import { DEVELOPER_ROUTES } from './routes';
import { SqlFormatterTool } from './sql-formatter/sql-formatter';
import { UrlEncoderDecoderTool } from './url-encoder-decoder/url-encoder-decoder';

const TOOLS_UNDER_TEST: [string, Type<unknown>][] = [
  ['hash-generator', HashGeneratorTool],
  ['password-generator', PasswordGeneratorTool],
  ['qr-code-generator', QrCodeGeneratorTool],
  ['url-encoder-decoder', UrlEncoderDecoderTool],
  ['sql-formatter', SqlFormatterTool],
  ['color-converter', ColorConverterTool],
  ['json-viewer', JsonViewerTool],
  ['meta-tag-generator', MetaTagGeneratorTool],
  ['robots-txt-generator', RobotsTxtGeneratorTool],
];

async function render(component: Type<unknown>) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideWebsiteIcons(),
      provideMockStore({ selectors: [{ selector: siteFeature.selectDisabledTools, value: [] }] }),
    ],
  });
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('developer tools', () => {
  it.each(TOOLS_UNDER_TEST)('%s renders its frame, with labelled controls and unique ids', async (_slug, component) => {
    const el = await render(component);
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('.tool__work')).not.toBeNull();

    const ids = Array.from(el.querySelectorAll('[id]')).map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const label of Array.from(el.querySelectorAll('label[for]'))) {
      expect(el.querySelector(`[id="${label.getAttribute('for')}"]`), `label for ${label.getAttribute('for')}`).not.toBeNull();
    }
    for (const control of Array.from(el.querySelectorAll('input, select, textarea'))) {
      expect(
        control.closest(
          '[class*="fc-"], app-custom-file-input, app-custom-reactive-checkbox, app-custom-reactive-radio, app-custom-reactive-toggle-button, app-custom-reactive-textfield, app-custom-reactive-textarea, app-custom-reactive-dropdown, app-custom-reactive-colorfield',
        ),
      ).not.toBeNull();
    }
  });

  it('every tool has a manifest entry, a route, an icon and a tagline', () => {
    const routes = DEVELOPER_ROUTES.map((r) => r.path);
    for (const [slug] of TOOLS_UNDER_TEST) {
      expect(TOOLS.some((t) => t.slug === slug), `${slug} in manifest`).toBe(true);
      expect(routes, slug).toContain(slug);
      const look = toolPresentation(slug);
      expect(look.icon.length, slug).toBeGreaterThan(1);
      expect(look.tagline.length, slug).toBeGreaterThan(10);
      expect(look.tagline.length, slug).toBeLessThanOrEqual(60);
    }
  });
});
