import {
  type ConvertResult,
  type IndentChoice,
  byteLength,
  fail,
  failFromException,
  parseJson,
  plural,
} from '../shared/convert-common';

/*
 * JSON → XML with fast-xml-parser's builder. The builder writes the text; this file decides the element tree:
 * which keys are attributes, what an array means, and how a JSON key that is not a legal XML name gets a legal
 * one (every rename is reported, never silent). Text is escaped by the builder (& < > " ').
 */

export interface JsonToXmlOptions {
  /** Root element name. Empty: a single top-level key is the root, otherwise "root". */
  rootName: string;
  /** Keys starting with this are attributes (@id becomes id="..."). Empty turns attributes off. */
  attributePrefix: string;
  /** The key that holds an element's own text when it also has attributes or children. */
  textNodeName: string;
  /** Element name for items of an array that has no key (a top-level array, an array inside an array). */
  itemName: string;
  indent: IndentChoice;
  declaration: boolean;
  emptyElements: 'selfclose' | 'pair';
  nullAs: 'empty' | 'omit';
}

export const DEFAULT_JSON_TO_XML: JsonToXmlOptions = {
  rootName: '',
  attributePrefix: '@',
  textNodeName: '#text',
  itemName: 'item',
  indent: '2',
  declaration: true,
  emptyElements: 'selfclose',
  nullAs: 'empty',
};

const NAME_START = /[\p{L}_]/u;
const NAME_CHAR = /[\p{L}\p{N}_.\-]/u;
const MAX_LISTED = 4;
const RESERVED = new Set(['__proto__']);
// Characters XML 1.0 cannot carry at all (most control characters, lone surrogates, U+FFFE, U+FFFF).
// eslint-disable-next-line no-control-regex
const ILLEGAL_TEXT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** A legal XML name for any text: bad characters become _, a bad first character gets a _ in front. */
export function sanitizeXmlName(name: string): string {
  if (RESERVED.has(name)) return '_proto_';
  let out = '';
  for (const ch of name) out += NAME_CHAR.test(ch) ? ch : '_';
  if (!out) return '_';
  if (!NAME_START.test(out[0])) out = '_' + out;
  return out;
}

interface Ctx {
  options: JsonToXmlOptions;
  renames: Map<string, string>;
  droppedChars: number;
  nulls: number;
}

function name(raw: string, ctx: Ctx): string {
  const clean = sanitizeXmlName(raw);
  if (clean !== raw && !ctx.renames.has(raw)) ctx.renames.set(raw, clean);
  return clean;
}

function textOf(value: unknown, ctx: Ctx): string {
  const text = typeof value === 'string' ? value : typeof value === 'bigint' ? value.toString() : String(value);
  const cleaned = text.replace(ILLEGAL_TEXT, () => (ctx.droppedChars++, ''));
  return cleaned;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** One JSON value as the builder's input (an element's content). */
function node(value: unknown, ctx: Ctx, depth: number): unknown {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return { [name(ctx.options.itemName, ctx)]: value.map((v) => item(v, ctx, depth + 1)) };
  if (isObject(value)) return objectNode(value, ctx, depth);
  return textOf(value, ctx);
}

/** An array item: nulls stay as empty elements so positions are kept. */
function item(value: unknown, ctx: Ctx, depth: number): unknown {
  if (value === null || value === undefined) {
    ctx.nulls++;
    return '';
  }
  return node(value, ctx, depth);
}

function objectNode(source: Record<string, unknown>, ctx: Ctx, depth: number): Record<string, unknown> {
  const { attributePrefix, textNodeName } = ctx.options;
  const out: Record<string, unknown> = {};
  const usedAttrs = new Set<string>();
  const usedTags = new Set<string>();
  const unique = (candidate: string, taken: Set<string>) => {
    let result = candidate;
    for (let n = 2; taken.has(result); n++) result = `${candidate}_${n}`;
    taken.add(result);
    return result;
  };
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (attributePrefix && key.startsWith(attributePrefix) && key.length > attributePrefix.length && (value === null || typeof value !== 'object')) {
      const attr = unique(name(key.slice(attributePrefix.length), ctx), usedAttrs);
      const text = value === null || value === undefined ? '' : textOf(value, ctx);
      out[`@${attr}`] = text;
      continue;
    }
    if (key === textNodeName) {
      out['#text'] = value === null || value === undefined ? '' : textOf(isObject(value) || Array.isArray(value) ? JSON.stringify(value) : value, ctx);
      continue;
    }
    if (value === null || value === undefined) {
      ctx.nulls++;
      if (ctx.options.nullAs === 'omit') continue;
    }
    const tag = unique(name(key, ctx), usedTags);
    if (Array.isArray(value)) out[tag] = value.map((v) => item(v, ctx, depth + 1));
    else out[tag] = node(value, ctx, depth + 1);
  }
  return out;
}

type BuilderCtor = new (options: Record<string, unknown>) => { build: (value: unknown) => string };

export async function convertJsonToXml(text: string, options: JsonToXmlOptions): Promise<ConvertResult> {
  try {
    const parsed = parseJson(text);
    if (!parsed.ok) return parsed;
    if (options.rootName.trim() && sanitizeXmlName(options.rootName.trim()) !== options.rootName.trim()) {
      return fail(`"${options.rootName.trim()}" is not a valid XML element name. Names start with a letter or _ and contain letters, digits, - . and _ only.`);
    }
    const ctx: Ctx = { options, renames: new Map(), droppedChars: 0, nulls: 0 };
    let value = parsed.value;
    let rootName = options.rootName.trim();
    if (!rootName && isObject(value) && Object.keys(value).length === 1) {
      const only = Object.keys(value)[0];
      if (!(options.attributePrefix && only.startsWith(options.attributePrefix)) && only !== options.textNodeName) {
        rootName = name(only, ctx);
        value = (value as Record<string, unknown>)[only];
      }
    }
    if (!rootName) rootName = 'root';
    const tree = { [rootName]: Array.isArray(value) ? { [name(options.itemName, ctx)]: value.map((v) => item(v, ctx, 1)) } : node(value, ctx, 1) };

    const fxp = (await import('fast-xml-parser')) as unknown as { XMLBuilder: BuilderCtor };
    const pretty = options.indent !== 'minify';
    const builder = new fxp.XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@',
      textNodeName: '#text',
      format: pretty,
      indentBy: options.indent === 'tab' ? '\t' : ' '.repeat(Number(options.indent) || 2),
      suppressEmptyNode: options.emptyElements === 'selfclose',
      suppressBooleanAttributes: false,
      processEntities: true,
      maxNestedTags: 1000,
    });
    let body = builder.build(tree).replace(/\n+$/, '');
    // Line breaks and tabs inside attribute values must be written as character references to survive parsing.
    body = body.replace(/="([^"]*)"/g, (_m, v: string) => `="${v.replace(/\r/g, '&#13;').replace(/\n/g, '&#10;').replace(/\t/g, '&#9;')}"`);
    const output = (options.declaration ? `<?xml version="1.0" encoding="UTF-8"?>${pretty ? '\n' : ''}` : '') + body + (pretty ? '\n' : '');

    const warnings = [...parsed.warnings];
    if (ctx.renames.size) {
      const list = [...ctx.renames].slice(0, MAX_LISTED).map(([from, to]) => `"${from}" to ${to}`).join(', ');
      warnings.push(`${plural(ctx.renames.size, 'name')} were not valid XML names and were renamed (${list}${ctx.renames.size > MAX_LISTED ? ', ...' : ''}).`);
    }
    if (ctx.droppedChars) warnings.push(`${plural(ctx.droppedChars, 'character')} that XML 1.0 cannot contain (control characters, broken emoji halves) were removed from the text.`);
    if (ctx.nulls) warnings.push(`${plural(ctx.nulls, 'null value')} ${options.nullAs === 'omit' ? 'in objects were left out (null items in arrays stay as empty elements)' : 'became empty elements'}. XML has no null.`);
    if (parsed.bigInts) warnings.push(`${plural(parsed.bigInts, 'integer')} beyond 2^53 kept exact as digits.`);

    const meta = [`root <${rootName}>`, `${output.split('\n').length.toLocaleString('en-US')} lines`, `${byteLength(output).toLocaleString('en-US')} bytes`];
    return { ok: true, output, meta, warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/nested tags/i.test(message)) return fail('The JSON is nested too deeply to write as XML.');
    return failFromException(error, 'json-to-xml');
  }
}
