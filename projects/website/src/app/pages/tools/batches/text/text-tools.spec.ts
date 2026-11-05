import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { TOOLS } from '@shared/tools/tools.manifest';
import { TEXT_TOOLS } from '@shared/tools/batches/text.tools';
import { describe, expect, it } from 'vitest';
import { provideWebsiteIcons } from '../../../../core/icons';
import { siteFeature } from '../../../../core/store/site.feature';
import { TOOL_PRESENTATION } from '../../tool-meta';
import { CaseConverterTool } from './case-converter/case-converter';
import { LoremIpsumGeneratorTool } from './lorem-ipsum-generator/lorem-ipsum-generator';
import { TEXT_ICONS } from './icons';
import { TEXT_PRESENTATION } from './presentation';
import { TEXT_ROUTES } from './routes';
import { SlugGeneratorTool } from './slug-generator/slug-generator';
import { TextCleanerTool } from './text-cleaner/text-cleaner';
import { TextDiffCheckerTool } from './text-diff-checker/text-diff-checker';
import { WordCounterTool } from './word-counter/word-counter';

const COMPONENTS: [string, Type<unknown>][] = [
  ['word-counter', WordCounterTool],
  ['case-converter', CaseConverterTool],
  ['text-diff-checker', TextDiffCheckerTool],
  ['lorem-ipsum-generator', LoremIpsumGeneratorTool],
  ['slug-generator', SlugGeneratorTool],
  ['text-cleaner', TextCleanerTool],
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
  return fixture;
}

describe('text tools: rendering', () => {
  it.each(COMPONENTS)('%s renders its frame with labelled controls and unique ids', async (_slug, component) => {
    const el = (await render(component)).nativeElement as HTMLElement;
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('.tool__work')).not.toBeNull();
    const ids = Array.from(el.querySelectorAll('[id]')).map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const label of Array.from(el.querySelectorAll('label[for]'))) {
      expect(el.querySelector(`[id="${label.getAttribute('for')}"]`), `label for ${label.getAttribute('for')}`).not.toBeNull();
    }
    for (const control of Array.from(el.querySelectorAll('input, select, textarea'))) {
      expect(control.closest('[class*="fc-"], app-custom-file-input, [class*="app-custom"]')).not.toBeNull();
    }
  });

  it('every tool has a route, a presentation entry and registered icons', () => {
    const paths = TEXT_ROUTES.map((r) => r.path);
    expect(paths).toEqual(COMPONENTS.map(([slug]) => slug));
    for (const [slug] of COMPONENTS) {
      expect(TEXT_PRESENTATION[slug], slug).toBeDefined();
      expect(TOOL_PRESENTATION[slug].tagline.length, slug).toBeLessThanOrEqual(60);
      const icon = TEXT_PRESENTATION[slug].icon.replace(/(^|-)(\w)/g, (_m, _d, c: string) => c.toUpperCase());
      expect(TEXT_ICONS[icon], `${slug} icon ${icon}`).toBeTruthy();
    }
  });
});

describe('text tools: live behaviour', () => {
  const type = async (fixture: Awaited<ReturnType<typeof render>>, id: string, value: string) => {
    const el = fixture.nativeElement as HTMLElement;
    const area = el.querySelector(`#${id}`) as HTMLTextAreaElement;
    area.value = value;
    area.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 30));
    await fixture.whenStable();
    fixture.detectChanges();
    return el;
  };

  it('word counter shows counts for typed text', async () => {
    const f = await render(WordCounterTool);
    const el = await type(f, 'wc-text', 'one two three. four five.');
    expect(el.textContent).toContain('Words');
    expect(el.textContent).toContain('5 words');
  });

  it('case converter shows the variants', async () => {
    const f = await render(CaseConverterTool);
    const el = await type(f, 'cc-text', 'hello world');
    expect(el.textContent).toContain('Hello World');
    expect(el.textContent).toContain('hello_world');
    expect(el.textContent).toContain('helloWorld');
  });

  it('slug generator shows the slug', async () => {
    const f = await render(SlugGeneratorTool);
    const el = await type(f, 'slug-text', 'Crème Brûlée & Co');
    expect(el.textContent).toContain('creme-brulee-and-co');
  });

  it('text cleaner runs its default pipeline', async () => {
    const f = await render(TextCleanerTool);
    const el = await type(f, 'tc-text', 'b\n a \n\nB\na');
    expect(el.textContent).toContain('3 lines from 5'.replace('3', '2'));
  });

  it('text diff checker marks changes', async () => {
    const f = await render(TextDiffCheckerTool);
    await type(f, 'diff-a', 'one\ntwo');
    const el = await type(f, 'diff-b', 'one\nthree');
    await new Promise((r) => setTimeout(r, 50));
    f.detectChanges();
    expect(el.textContent).toContain('1 added');
  });

  it('lorem generator renders text on first paint', async () => {
    const el = (await render(LoremIpsumGeneratorTool)).nativeElement as HTMLElement;
    expect(el.textContent).toContain('Lorem ipsum dolor sit amet');
  });
});

describe('text tools: manifest copy', () => {
  it('has six entries of the text category with full copy', () => {
    const all = new Set(TOOLS.map((t) => t.slug));
    expect(TEXT_TOOLS.map((t) => t.slug)).toEqual(COMPONENTS.map(([s]) => s));
    for (const t of TEXT_TOOLS) {
      const words = t.sections.flatMap((s) => s.paragraphs).join(' ').split(/\s+/).length;
      expect(words, t.slug).toBeGreaterThanOrEqual(350);
      expect(t.sections.length, t.slug).toBeGreaterThanOrEqual(3);
      expect(t.sections.length, t.slug).toBeLessThanOrEqual(4);
      expect(t.faq.length, t.slug).toBeGreaterThanOrEqual(4);
      expect(t.title.length, t.slug).toBeLessThanOrEqual(60);
      expect(t.description.length, t.slug).toBeLessThanOrEqual(155);
      expect(t.category).toBe('text');
      expect(t.updatedAt).toBe('2026-11-05');
      expect(t.keyword).toBeTruthy();
      expect(t.example.input && t.example.output).toBeTruthy();
      for (const r of t.related) expect(all.has(r), `${t.slug} -> ${r}`).toBe(true);
    }
  });
});
