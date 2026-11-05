import { TestBed } from '@angular/core/testing';
import { Type } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { describe, expect, it } from 'vitest';
import { TOOLS as MANIFEST_TOOLS } from '@shared/tools/tools.manifest';
import { provideWebsiteIcons } from '../../core/icons';
import { siteFeature } from '../../core/store/site.feature';
import { Base64EncoderTool } from './base64-encoder/base64-encoder';
import { CronExpressionExplainerTool } from './cron-expression-explainer/cron-expression-explainer';
import { EpochConverterTool } from './epoch-converter/epoch-converter';
import { HttpStatusCodesTool } from './http-status-codes/http-status-codes';
import { JsonFormatterTool } from './json-formatter/json-formatter';
import { JsonToMongooseSchemaTool } from './json-to-mongoose-schema/json-to-mongoose-schema';
import { JsonToTypescriptTool } from './json-to-typescript/json-to-typescript';
import { JwtDecoderTool } from './jwt-decoder/jwt-decoder';
import { ObjectIdToDateTool } from './objectid-to-date/objectid-to-date';
import { RegexTesterTool } from './regex-tester/regex-tester';
import { ToolsHubPage } from './tools-hub/tools-hub';
import { UuidGeneratorTool } from './uuid-generator/uuid-generator';
import { VideoToAudioTool } from './video-to-audio/video-to-audio';

const TOOLS: [string, Type<unknown>][] = [
  ['base64-encoder', Base64EncoderTool],
  ['cron-expression-explainer', CronExpressionExplainerTool],
  ['epoch-converter', EpochConverterTool],
  ['http-status-codes', HttpStatusCodesTool],
  ['json-formatter', JsonFormatterTool],
  ['json-to-mongoose-schema', JsonToMongooseSchemaTool],
  ['json-to-typescript', JsonToTypescriptTool],
  ['jwt-decoder', JwtDecoderTool],
  ['objectid-to-date', ObjectIdToDateTool],
  ['regex-tester', RegexTesterTool],
  ['uuid-generator', UuidGeneratorTool],
  ['video-to-audio', VideoToAudioTool],
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

describe('tool pages', () => {
  it.each(TOOLS)('%s renders its frame, with labelled controls and unique ids', async (_slug, component) => {
    const el = await render(component);
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('.tool__work')).not.toBeNull();

    // Every label points at a real control, and no id is used twice.
    const ids = Array.from(el.querySelectorAll('[id]')).map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const label of Array.from(el.querySelectorAll('label[for]'))) {
      expect(el.querySelector(`[id="${label.getAttribute('for')}"]`), `label for ${label.getAttribute('for')}`).not.toBeNull();
    }

    // Every native control is inside a shared form component (none written directly in a tool template).
    for (const control of Array.from(el.querySelectorAll('input, select, textarea'))) {
      expect(control.closest('[class*="fc-"], app-custom-file-input, [class*="app-custom"], app-custom-reactive-checkbox, app-custom-reactive-radio, app-custom-reactive-toggle-button, app-custom-reactive-textfield, app-custom-reactive-textarea, app-custom-reactive-dropdown')).not.toBeNull();
    }
  });

  it('the hub lists every tool with an icon and a one-line summary', async () => {
    const el = await render(ToolsHubPage);
    expect(el.querySelectorAll('.hub__card').length).toBe(MANIFEST_TOOLS.length);
    for (const card of Array.from(el.querySelectorAll('.hub__card'))) {
      expect(card.querySelector('i-lucide')).not.toBeNull();
      expect(card.querySelector('.hub__text')?.textContent?.trim().length).toBeGreaterThan(10);
    }
  });
});
