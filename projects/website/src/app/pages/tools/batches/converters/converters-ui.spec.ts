import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { describe, expect, it } from 'vitest';
import { provideWebsiteIcons } from '../../../../core/icons';
import { siteFeature } from '../../../../core/store/site.feature';
import { CONVERTER_TOOLS } from '@shared/tools/batches/converters.tools';
import { CsvToJsonTool } from './csv-to-json/csv-to-json';
import { ExcelToJsonTool } from './excel-to-json/excel-to-json';
import { CONVERTERS_ICONS } from './icons';
import { JsonToCsvTool } from './json-to-csv/json-to-csv';
import { JsonToXmlTool } from './json-to-xml/json-to-xml';
import { JsonToYamlTool } from './json-to-yaml/json-to-yaml';
import { MarkdownToHtmlTool } from './markdown-to-html/markdown-to-html';
import { CONVERTERS_PRESENTATION } from './presentation';
import { CONVERTERS_ROUTES } from './routes';
import { XmlToJsonTool } from './xml-to-json/xml-to-json';
import { YamlToJsonTool } from './yaml-to-json/yaml-to-json';

const TOOLS: [string, Type<unknown>][] = [
  ['json-to-csv', JsonToCsvTool],
  ['csv-to-json', CsvToJsonTool],
  ['json-to-yaml', JsonToYamlTool],
  ['yaml-to-json', YamlToJsonTool],
  ['xml-to-json', XmlToJsonTool],
  ['json-to-xml', JsonToXmlTool],
  ['markdown-to-html', MarkdownToHtmlTool],
  ['excel-to-json', ExcelToJsonTool],
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

describe('converters batch', () => {
  it('has a manifest entry, route, presentation and a component for every tool', () => {
    const slugs = TOOLS.map(([slug]) => slug).sort();
    expect(CONVERTER_TOOLS.map((t) => t.slug).sort()).toEqual(slugs);
    expect(CONVERTERS_ROUTES.map((r) => r.path).sort()).toEqual(slugs);
    expect(Object.keys(CONVERTERS_PRESENTATION).sort()).toEqual(slugs);
    for (const t of CONVERTER_TOOLS) expect(t.category).toBe('converters');
  });

  it('only uses icons it registers, or ones the site already has', () => {
    const known = new Set(Object.keys(CONVERTERS_ICONS).map((k) => k.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()));
    for (const icon of ['braces', 'file-code']) known.add(icon);
    for (const [slug, p] of Object.entries(CONVERTERS_PRESENTATION)) expect(known.has(p.icon), `${slug}: ${p.icon}`).toBe(true);
  });

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
      expect(
        control.closest(
          '[class*="fc-"], app-custom-file-input, [class*="app-custom"], app-custom-reactive-checkbox, app-custom-reactive-radio, app-custom-reactive-toggle-button, app-custom-reactive-textfield, app-custom-reactive-textarea, app-custom-reactive-dropdown',
        ),
      ).not.toBeNull();
    }
  });

  it('converts live: typing JSON into JSON to CSV shows CSV', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideWebsiteIcons(), provideMockStore({ selectors: [{ selector: siteFeature.selectDisabledTools, value: [] }] })],
    });
    const fixture = TestBed.createComponent(JsonToCsvTool);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const area = el.querySelector('textarea') as HTMLTextAreaElement;
    area.value = '[{"a":1,"b":"x"}]';
    area.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 500));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('.out__code')?.textContent).toContain('a,b\n1,x');
  });
});
