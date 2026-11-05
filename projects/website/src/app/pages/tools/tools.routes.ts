import { Routes } from '@angular/router';
import { CONVERTERS_ROUTES } from './batches/converters/routes';
import { DEVELOPER_ROUTES } from './batches/developer/routes';
import { DOCUMENTS_ROUTES } from './batches/documents/routes';
import { IMAGES_PDF_ROUTES } from './batches/images-pdf/routes';
import { TEXT_ROUTES } from './batches/text/routes';
import { toolEnabled } from './tool-enabled.guard';

/**
 * /tools and one lazy route per tool. Add a tool: manifest entry (shared lib), component, line here, then
 * `npm run sync:tools`. Each tool route is guarded by toolEnabled(): switched off in cusadmin → 404.
 */
export const TOOLS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./tools-hub/tools-hub').then((m) => m.ToolsHubPage),
  },
  {
    path: 'objectid-to-date',
    canMatch: [toolEnabled('objectid-to-date')],
    loadComponent: () => import('./objectid-to-date/objectid-to-date').then((m) => m.ObjectIdToDateTool),
  },
  {
    path: 'jwt-decoder',
    canMatch: [toolEnabled('jwt-decoder')],
    loadComponent: () => import('./jwt-decoder/jwt-decoder').then((m) => m.JwtDecoderTool),
  },
  {
    path: 'json-to-typescript',
    canMatch: [toolEnabled('json-to-typescript')],
    loadComponent: () => import('./json-to-typescript/json-to-typescript').then((m) => m.JsonToTypescriptTool),
  },
  {
    path: 'json-to-mongoose-schema',
    canMatch: [toolEnabled('json-to-mongoose-schema')],
    loadComponent: () =>
      import('./json-to-mongoose-schema/json-to-mongoose-schema').then((m) => m.JsonToMongooseSchemaTool),
  },
  {
    path: 'cron-expression-explainer',
    canMatch: [toolEnabled('cron-expression-explainer')],
    loadComponent: () =>
      import('./cron-expression-explainer/cron-expression-explainer').then((m) => m.CronExpressionExplainerTool),
  },
  {
    path: 'http-status-codes',
    canMatch: [toolEnabled('http-status-codes')],
    loadComponent: () => import('./http-status-codes/http-status-codes').then((m) => m.HttpStatusCodesTool),
  },
  {
    path: 'http-status-codes/:code',
    canMatch: [toolEnabled('http-status-codes')],
    loadComponent: () => import('./http-status-detail/http-status-detail').then((m) => m.HttpStatusDetailPage),
  },
  {
    path: 'video-to-audio',
    canMatch: [toolEnabled('video-to-audio')],
    loadComponent: () => import('./video-to-audio/video-to-audio').then((m) => m.VideoToAudioTool),
  },
  {
    path: 'regex-tester',
    canMatch: [toolEnabled('regex-tester')],
    loadComponent: () => import('./regex-tester/regex-tester').then((m) => m.RegexTesterTool),
  },
  {
    path: 'epoch-converter',
    canMatch: [toolEnabled('epoch-converter')],
    loadComponent: () => import('./epoch-converter/epoch-converter').then((m) => m.EpochConverterTool),
  },
  {
    path: 'base64-encoder',
    canMatch: [toolEnabled('base64-encoder')],
    loadComponent: () => import('./base64-encoder/base64-encoder').then((m) => m.Base64EncoderTool),
  },
  {
    path: 'uuid-generator',
    canMatch: [toolEnabled('uuid-generator')],
    loadComponent: () => import('./uuid-generator/uuid-generator').then((m) => m.UuidGeneratorTool),
  },
  {
    path: 'json-formatter',
    canMatch: [toolEnabled('json-formatter')],
    loadComponent: () => import('./json-formatter/json-formatter').then((m) => m.JsonFormatterTool),
  },
  // One routes file per tool batch (each entry guarded by toolEnabled).
  ...DOCUMENTS_ROUTES,
  ...CONVERTERS_ROUTES,
  ...IMAGES_PDF_ROUTES,
  ...TEXT_ROUTES,
  ...DEVELOPER_ROUTES,
  // Unknown or switched-off /tools/* slugs fall through to the app's ** route (real 404, noindex).
];
