import type { Routes } from '@angular/router';
import { toolEnabled } from '../../tool-enabled.guard';

/** Lazy routes of the developer tools, spread into TOOLS_ROUTES. One entry per tool, each guarded by toolEnabled(slug). */
export const DEVELOPER_ROUTES: Routes = [
  {
    path: 'hash-generator',
    canMatch: [toolEnabled('hash-generator')],
    loadComponent: () => import('./hash-generator/hash-generator').then((m) => m.HashGeneratorTool),
  },
  {
    path: 'password-generator',
    canMatch: [toolEnabled('password-generator')],
    loadComponent: () => import('./password-generator/password-generator').then((m) => m.PasswordGeneratorTool),
  },
  {
    path: 'qr-code-generator',
    canMatch: [toolEnabled('qr-code-generator')],
    loadComponent: () => import('./qr-code-generator/qr-code-generator').then((m) => m.QrCodeGeneratorTool),
  },
  {
    path: 'url-encoder-decoder',
    canMatch: [toolEnabled('url-encoder-decoder')],
    loadComponent: () => import('./url-encoder-decoder/url-encoder-decoder').then((m) => m.UrlEncoderDecoderTool),
  },
  {
    path: 'sql-formatter',
    canMatch: [toolEnabled('sql-formatter')],
    loadComponent: () => import('./sql-formatter/sql-formatter').then((m) => m.SqlFormatterTool),
  },
  {
    path: 'color-converter',
    canMatch: [toolEnabled('color-converter')],
    loadComponent: () => import('./color-converter/color-converter').then((m) => m.ColorConverterTool),
  },
  {
    path: 'json-viewer',
    canMatch: [toolEnabled('json-viewer')],
    loadComponent: () => import('./json-viewer/json-viewer').then((m) => m.JsonViewerTool),
  },
  {
    path: 'meta-tag-generator',
    canMatch: [toolEnabled('meta-tag-generator')],
    loadComponent: () => import('./meta-tag-generator/meta-tag-generator').then((m) => m.MetaTagGeneratorTool),
  },
  {
    path: 'robots-txt-generator',
    canMatch: [toolEnabled('robots-txt-generator')],
    loadComponent: () => import('./robots-txt-generator/robots-txt-generator').then((m) => m.RobotsTxtGeneratorTool),
  },
];
