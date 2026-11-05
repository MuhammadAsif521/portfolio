import type { Routes } from '@angular/router';
import { toolEnabled } from '../../tool-enabled.guard';

/** Lazy routes of the text tools, spread into TOOLS_ROUTES. One entry per tool, each guarded by toolEnabled(slug). */
export const TEXT_ROUTES: Routes = [
  {
    path: 'word-counter',
    canMatch: [toolEnabled('word-counter')],
    loadComponent: () => import('./word-counter/word-counter').then((m) => m.WordCounterTool),
  },
  {
    path: 'case-converter',
    canMatch: [toolEnabled('case-converter')],
    loadComponent: () => import('./case-converter/case-converter').then((m) => m.CaseConverterTool),
  },
  {
    path: 'text-diff-checker',
    canMatch: [toolEnabled('text-diff-checker')],
    loadComponent: () => import('./text-diff-checker/text-diff-checker').then((m) => m.TextDiffCheckerTool),
  },
  {
    path: 'lorem-ipsum-generator',
    canMatch: [toolEnabled('lorem-ipsum-generator')],
    loadComponent: () => import('./lorem-ipsum-generator/lorem-ipsum-generator').then((m) => m.LoremIpsumGeneratorTool),
  },
  {
    path: 'slug-generator',
    canMatch: [toolEnabled('slug-generator')],
    loadComponent: () => import('./slug-generator/slug-generator').then((m) => m.SlugGeneratorTool),
  },
  {
    path: 'text-cleaner',
    canMatch: [toolEnabled('text-cleaner')],
    loadComponent: () => import('./text-cleaner/text-cleaner').then((m) => m.TextCleanerTool),
  },
];
