import {
  type ConvertResult,
  type IndentChoice,
  byteLength,
  defineOwn,
  fail,
  failAt,
  failFromException,
  jsonIndent,
  plural,
  stringifyJson,
  stripBom,
} from '../shared/convert-common';

/*
 * XML → JSON with fast-xml-parser. Two safety decisions are made here, before the parser sees anything:
 *  1. The DOCTYPE (where custom and external entities are declared) is blanked out, so entity-expansion
 *     attacks (billion laughs, quadratic blow-up) and external entities cannot run. Blank lines replace it, so
 *     line numbers in errors still match the original text. The five built-in entities and numeric references
 *     (&amp; &#65;) are still decoded.
 *  2. The document is validated first, which gives exact line and column numbers for errors.
 */

export interface XmlToJsonOptions {
  /** `prefix`: @name keys next to the children. `group`: all attributes under "@attributes". `ignore`: drop them. */
  attributes: 'prefix' | 'group' | 'ignore';
  attributePrefix: string;
  textNodeName: string;
  /** `auto`: a repeated tag becomes an array, a single one an object. `always`: every child is an array. */
  arrays: 'auto' | 'always';
  /** Tag names that are always arrays, comma separated (for example "item, row"). */
  arrayNames: string;
  /** Numbers and true/false in text and attributes become JSON values. Long ids and "007" stay text. */
  inferTypes: boolean;
  cdata: 'merge' | 'separate';
  comments: boolean;
  /** Keep the order of mixed content such as <p>Hello <b>big</b> world</p> (changes the shape to arrays). */
  preserveOrder: boolean;
  removeNamespaces: boolean;
  declaration: boolean;
  emptyAsNull: boolean;
  /** Drop the outer root element and return its content. */
  unwrapRoot: boolean;
  indent: IndentChoice;
}

export const DEFAULT_XML_TO_JSON: XmlToJsonOptions = {
  attributes: 'prefix',
  attributePrefix: '@',
  textNodeName: '#text',
  arrays: 'auto',
  arrayNames: '',
  inferTypes: true,
  cdata: 'merge',
  comments: false,
  preserveOrder: false,
  removeNamespaces: false,
  declaration: false,
  emptyAsNull: false,
  unwrapRoot: false,
  indent: '2',
};

const CDATA_KEY = '#cdata';
const COMMENT_KEY = '#comment';
const GROUP_KEY = '@attributes';

const DOCTYPE = /<!DOCTYPE(?:[^[>"']|"[^"]*"|'[^']*')*(?:\[[\s\S]*?\]\s*)?>/i;

/** Blanks the DOCTYPE, keeping its line breaks. Reports what it contained. */
export function neutralizeDoctype(xml: string): { xml: string; removed: boolean; entities: number; external: boolean } {
  const match = DOCTYPE.exec(xml);
  if (!match) return { xml, removed: false, entities: 0, external: false };
  const block = match[0];
  const blank = block.replace(/[^\r\n]/g, ' ');
  return {
    xml: xml.slice(0, match.index) + blank + xml.slice(match.index + block.length),
    removed: true,
    entities: (block.match(/<!ENTITY/gi) ?? []).length,
    external: /\b(?:SYSTEM|PUBLIC)\b/i.test(block),
  };
}

/** &#65; and &#x1F600; to characters. Invalid code points are left as written. */
export function decodeCharRefs(text: string): string {
  return text.replace(/&#(?:(\d{1,7})|x([0-9a-fA-F]{1,6}));/g, (whole, dec?: string, hex?: string) => {
    const code = dec ? parseInt(dec, 10) : parseInt(hex ?? '', 16);
    const valid = code === 9 || code === 10 || code === 13 || (code >= 0x20 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) || (code >= 0x10000 && code <= 0x10ffff);
    return valid ? String.fromCodePoint(code) : whole;
  });
}

const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

export function inferXmlScalar(text: string): string | number | boolean {
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (!NUMBER.test(text)) return text;
  const digits = text.replace(/[eE].*$/, '').replace(/[-.]/g, '').replace(/^0+/, '');
  if (digits.length > 15) return text;
  const n = Number(text);
  return Number.isFinite(n) ? n : text;
}

interface FinishContext {
  options: XmlToJsonOptions;
  prefix: string;
}

function finish(value: unknown, key: string, ctx: FinishContext, inAttributes: boolean): unknown {
  if (typeof value === 'string') {
    if (key === COMMENT_KEY || key === CDATA_KEY) return value;
    const text = decodeCharRefs(value);
    const isAttribute = inAttributes || (ctx.prefix !== '' && key.startsWith(ctx.prefix));
    if (!isAttribute && text === '' && ctx.options.emptyAsNull) return null;
    return ctx.options.inferTypes ? inferXmlScalar(text) : text;
  }
  if (Array.isArray(value)) return value.map((v) => finish(v, key, ctx, inAttributes));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    const attributesHere = inAttributes || key === GROUP_KEY || key === ':@';
    for (const k of Object.keys(value)) defineOwn(out, k, finish((value as Record<string, unknown>)[k], k, ctx, attributesHere));
    return out;
  }
  return value;
}

type ParserCtor = new (options: Record<string, unknown>) => { parse: (xml: string) => unknown };
type FxpModule = { XMLParser: ParserCtor; XMLValidator: { validate: (xml: string) => true | { err: { code: string; msg: string; line: number; col?: number } } } };

export async function convertXmlToJson(raw: string, options: XmlToJsonOptions): Promise<ConvertResult> {
  const source = stripBom(raw);
  if (!source.trim()) return fail('There is nothing to convert yet.');
  if (options.attributes === 'prefix' && !options.attributePrefix) {
    return fail('Attribute prefix cannot be empty: attributes would collide with child elements. Pick a prefix such as @ or _, or choose another attribute mode.');
  }
  if (!options.textNodeName) return fail('Text node name cannot be empty. Use something like #text.');
  try {
    const warnings: string[] = [];
    const safe = neutralizeDoctype(source);
    if (safe.removed) {
      warnings.push(
        `The DOCTYPE was ignored${safe.entities ? ` (${plural(safe.entities, 'entity declaration')})` : ''}${safe.external ? ' and external references are never loaded' : ''}. ` +
          'Custom entities are not expanded, so entity-expansion attacks cannot run; references to them stay as literal text.',
      );
    }
    const xml = safe.xml;

    const fxp = (await import('fast-xml-parser')) as unknown as FxpModule;
    const valid = fxp.XMLValidator.validate(xml);
    if (valid !== true) {
      const { msg, line, col } = valid.err;
      return failAt(`Invalid XML: ${msg.replace(/\.$/, '')}`, xml, { line, column: col });
    }

    const names = new Set(options.arrayNames.split(',').map((n) => n.trim()).filter(Boolean));
    const always = options.arrays === 'always';
    const grouped = options.attributes === 'group';
    const prefix = options.attributes === 'prefix' ? options.attributePrefix : '';
    const parser = new fxp.XMLParser({
      ignoreAttributes: options.attributes === 'ignore',
      attributeNamePrefix: prefix,
      attributesGroupName: grouped ? GROUP_KEY : false,
      textNodeName: options.textNodeName,
      parseTagValue: false,
      parseAttributeValue: false,
      trimValues: true,
      removeNSPrefix: options.removeNamespaces,
      cdataPropName: options.cdata === 'separate' ? CDATA_KEY : false,
      commentPropName: options.comments ? COMMENT_KEY : false,
      preserveOrder: options.preserveOrder,
      ignoreDeclaration: !options.declaration,
      ignorePiTags: !options.declaration,
      processEntities: { enabled: true, maxEntityCount: 0, maxTotalExpansions: 1_000_000, maxExpandedLength: 50_000_000, maxEntitySize: 10_000 },
      isArray: (tag: string, path: string, _leaf: boolean, isAttribute: boolean) => !isAttribute && (names.has(tag) || (always && path.includes('.'))),
    });
    let parsed = parser.parse(xml);
    parsed = finish(parsed, '', { options, prefix }, false);

    if (options.unwrapRoot && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed).filter((k) => !k.startsWith('?'));
      if (keys.length === 1) parsed = (parsed as Record<string, unknown>)[keys[0]];
    }
    const output = stringifyJson(parsed, jsonIndent(options.indent));
    const rootName = !options.preserveOrder && parsed && typeof parsed === 'object' && !options.unwrapRoot ? Object.keys(parsed).find((k) => !k.startsWith('?')) : undefined;
    const meta = [rootName ? `root <${rootName}>` : 'XML parsed', `${byteLength(output).toLocaleString('en-US')} bytes`];
    return { ok: true, output, meta, warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/SECURITY|reserved JavaScript keyword/i.test(message)) {
      return fail('This XML uses an element or attribute named __proto__, which is refused to prevent prototype pollution. Rename it in the source.');
    }
    if (/nested tags|maxNestedTags/i.test(message)) return fail('The elements are nested more than 100 levels deep, which is refused.');
    return failFromException(error, 'xml-to-json');
  }
}
