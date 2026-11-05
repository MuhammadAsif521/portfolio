import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { IMAGE_PDF_TOOLS } from '@shared/tools/batches/images-pdf.tools';
import { describe, expect, it } from 'vitest';
import { provideWebsiteIcons } from '../../../../core/icons';
import { siteFeature } from '../../../../core/store/site.feature';
import { toolPresentation } from '../../tool-meta';
import { ImageCompressorTool } from './image-compressor/image-compressor';
import { ImageConverterTool } from './image-converter/image-converter';
import { ImageResizerTool } from './image-resizer/image-resizer';
import { ImagesToPdfTool } from './images-to-pdf/images-to-pdf';
import { IMAGES_PDF_ICONS } from './icons';
import { IMAGES_PDF_PRESENTATION } from './presentation';
import { MergePdfTool } from './merge-pdf/merge-pdf';
import { PdfToImagesTool } from './pdf-to-images/pdf-to-images';
import { IMAGES_PDF_ROUTES } from './routes';
import { SplitPdfTool } from './split-pdf/split-pdf';
import { SvgToPngTool } from './svg-to-png/svg-to-png';

const TOOLS: [string, Type<unknown>][] = [
  ['image-converter', ImageConverterTool],
  ['image-compressor', ImageCompressorTool],
  ['image-resizer', ImageResizerTool],
  ['svg-to-png', SvgToPngTool],
  ['images-to-pdf', ImagesToPdfTool],
  ['pdf-to-images', PdfToImagesTool],
  ['merge-pdf', MergePdfTool],
  ['split-pdf', SplitPdfTool],
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

describe('images-pdf batch wiring', () => {
  it('has a manifest entry, a guarded route, a card and a registered icon for every tool', () => {
    expect(IMAGE_PDF_TOOLS.map((t) => t.slug).sort()).toEqual(TOOLS.map(([slug]) => slug).sort());
    for (const [slug] of TOOLS) {
      const route = IMAGES_PDF_ROUTES.find((r) => r.path === slug);
      expect(route?.canMatch?.length, `${slug} route`).toBe(1);
      const card = IMAGES_PDF_PRESENTATION[slug];
      expect(card.tagline.length, `${slug} tagline`).toBeLessThanOrEqual(60);
      expect(card.tagline.length).toBeGreaterThan(10);
      const iconKey = card.icon.replace(/(^|-)(\w)/g, (_m, _d, c: string) => c.toUpperCase());
      expect(Object.keys(IMAGES_PDF_ICONS), `${slug} icon ${card.icon}`).toContain(iconKey);
      expect(toolPresentation(slug).icon).toBe(card.icon);
    }
  });

  it('only links to the 12 original tools, the PDF viewer and its own batch', () => {
    const original = ['objectid-to-date', 'jwt-decoder', 'json-to-typescript', 'json-to-mongoose-schema', 'cron-expression-explainer', 'http-status-codes', 'video-to-audio', 'regex-tester', 'epoch-converter', 'base64-encoder', 'uuid-generator', 'json-formatter'];
    // pdf-viewer (documents batch) is a deliberate cross-link from the PDF tools.
    const allowed = new Set([...original, 'pdf-viewer', ...IMAGE_PDF_TOOLS.map((t) => t.slug)]);
    for (const tool of IMAGE_PDF_TOOLS) for (const r of tool.related) expect(allowed.has(r), `${tool.slug} -> ${r}`).toBe(true);
  });

  it('gives every tool unique, specific copy', () => {
    expect(new Set(IMAGE_PDF_TOOLS.map((t) => t.keyword)).size).toBe(IMAGE_PDF_TOOLS.length);
    expect(new Set(IMAGE_PDF_TOOLS.map((t) => t.title)).size).toBe(IMAGE_PDF_TOOLS.length);
    for (const tool of IMAGE_PDF_TOOLS) {
      expect(tool.category).toBe('images');
      expect(tool.faq.length).toBeGreaterThanOrEqual(4);
      expect(tool.updatedAt).toBe('2026-11-05');
      const words = tool.sections.flatMap((s) => s.paragraphs).join(' ').split(/\s+/).length;
      expect(words, tool.slug).toBeGreaterThanOrEqual(350);
    }
  });
});

describe('images-pdf tool pages', () => {
  it.each(TOOLS)('%s renders its frame, with labelled controls and unique ids', async (_slug, component) => {
    const el = await render(component);
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('.tool__work')).not.toBeNull();

    const ids = Array.from(el.querySelectorAll('[id]')).map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const label of Array.from(el.querySelectorAll('label[for]'))) {
      expect(el.querySelector(`[id="${label.getAttribute('for')}"]`), `label for ${label.getAttribute('for')}`).not.toBeNull();
    }
    for (const control of Array.from(el.querySelectorAll('input, select, textarea'))) {
      expect(control.closest('[class*="fc-"], app-custom-file-input, [class*="app-custom"]')).not.toBeNull();
    }
    // The empty state tells the visitor what to do first.
    expect(el.querySelector('app-tool-empty, app-custom-file-input')).not.toBeNull();
  });
});
