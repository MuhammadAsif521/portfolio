import type { Routes } from '@angular/router';
import { toolEnabled } from '../../tool-enabled.guard';

/** Lazy routes of the converters tools, spread into TOOLS_ROUTES. One entry per tool, each guarded by toolEnabled(slug). */
export const CONVERTERS_ROUTES: Routes = [
  {
    path: 'json-to-csv',
    canMatch: [toolEnabled('json-to-csv')],
    loadComponent: () => import('./json-to-csv/json-to-csv').then((m) => m.JsonToCsvTool),
  },
  {
    path: 'csv-to-json',
    canMatch: [toolEnabled('csv-to-json')],
    loadComponent: () => import('./csv-to-json/csv-to-json').then((m) => m.CsvToJsonTool),
  },
  {
    path: 'json-to-yaml',
    canMatch: [toolEnabled('json-to-yaml')],
    loadComponent: () => import('./json-to-yaml/json-to-yaml').then((m) => m.JsonToYamlTool),
  },
  {
    path: 'yaml-to-json',
    canMatch: [toolEnabled('yaml-to-json')],
    loadComponent: () => import('./yaml-to-json/yaml-to-json').then((m) => m.YamlToJsonTool),
  },
  {
    path: 'xml-to-json',
    canMatch: [toolEnabled('xml-to-json')],
    loadComponent: () => import('./xml-to-json/xml-to-json').then((m) => m.XmlToJsonTool),
  },
  {
    path: 'json-to-xml',
    canMatch: [toolEnabled('json-to-xml')],
    loadComponent: () => import('./json-to-xml/json-to-xml').then((m) => m.JsonToXmlTool),
  },
  {
    path: 'markdown-to-html',
    canMatch: [toolEnabled('markdown-to-html')],
    loadComponent: () => import('./markdown-to-html/markdown-to-html').then((m) => m.MarkdownToHtmlTool),
  },
  {
    path: 'excel-to-json',
    canMatch: [toolEnabled('excel-to-json')],
    loadComponent: () => import('./excel-to-json/excel-to-json').then((m) => m.ExcelToJsonTool),
  },
];
