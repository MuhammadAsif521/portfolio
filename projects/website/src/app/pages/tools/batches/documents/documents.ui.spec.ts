import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { describe, expect, it } from 'vitest';
import { provideWebsiteIcons } from '../../../../core/icons';
import { siteFeature } from '../../../../core/store/site.feature';
import { toolBySlug } from '@shared/tools/tools.manifest';
import { DOCUMENTS_PRESENTATION } from './presentation';
import { DOCUMENTS_ROUTES } from './routes';
import { CsvViewerTool } from './csv-viewer/csv-viewer';
import { DocxViewerTool } from './docx-viewer/docx-viewer';
import { MarkdownViewerTool } from './markdown-viewer/markdown-viewer';
import { PdfViewerTool } from './pdf-viewer/pdf-viewer';
import { PptxViewerTool } from './pptx-viewer/pptx-viewer';
import { XlsxViewerTool } from './xlsx-viewer/xlsx-viewer';

const TOOLS: [string, Type<unknown>][] = [
  ['docx-viewer', DocxViewerTool],
  ['pdf-viewer', PdfViewerTool],
  ['xlsx-viewer', XlsxViewerTool],
  ['csv-viewer', CsvViewerTool],
  ['pptx-viewer', PptxViewerTool],
  ['markdown-viewer', MarkdownViewerTool],
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

describe('documents tools', () => {
  it.each(TOOLS)('%s renders its frame, with labelled controls and unique ids', async (_slug, component) => {
    const el = await render(component);
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('.tool__work')).not.toBeNull();

    const ids = Array.from(el.querySelectorAll('[id]')).map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const label of Array.from(el.querySelectorAll('label[for]'))) {
      expect(el.querySelector(`[id="${label.getAttribute('for')}"]`), `label for ${label.getAttribute('for')}`).not.toBeNull();
    }
    // Native inputs only live inside the shared form components.
    for (const control of Array.from(el.querySelectorAll('input, select, textarea'))) {
      expect(
        control.closest(
          '[class*="fc-"], app-custom-file-input, app-custom-reactive-checkbox, app-custom-reactive-radio, app-custom-reactive-toggle-button, app-custom-reactive-textfield, app-custom-reactive-textarea, app-custom-reactive-dropdown',
        ),
      ).not.toBeNull();
    }
  });

  it('the markdown tool fills its preview from the bundled sample', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideWebsiteIcons(), provideMockStore({ selectors: [{ selector: siteFeature.selectDisabledTools, value: [] }] })],
    });
    const fixture = TestBed.createComponent(MarkdownViewerTool);
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 600));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.doc-prose h1')?.textContent).toBe('Release notes');
    expect(el.querySelector('.doc-prose script')).toBeNull();
  });

  it('every tool has a manifest entry, a card presentation and a guarded route', () => {
    const paths = new Map(DOCUMENTS_ROUTES.map((r) => [r.path, r]));
    for (const [slug] of TOOLS) {
      expect(toolBySlug(slug), slug).toBeTruthy();
      expect(DOCUMENTS_PRESENTATION[slug]?.tagline.length, slug).toBeGreaterThan(10);
      expect(DOCUMENTS_PRESENTATION[slug]?.tagline.length, slug).toBeLessThanOrEqual(60);
      expect(paths.get(slug)?.canMatch?.length, slug).toBe(1);
    }
  });
});
