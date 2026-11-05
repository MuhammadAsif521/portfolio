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
  sortKeysDeep,
  stringifyJson,
  stripBom,
} from '../shared/convert-common';

/*
 * YAML → JSON with js-yaml, in SAFE mode only. js-yaml 5 has no unsafe loader: its schemas contain only plain
 * data tags, so tags such as !!js/function or !!python/object are rejected with a clear error instead of being
 * run. On top of that this file caps alias expansion (a YAML "billion laughs" file is tiny but expands to
 * gigabytes when written as JSON) and refuses circular aliases.
 */

export interface YamlToJsonOptions {
  indent: IndentChoice;
  sortKeys: boolean;
  /** Expand `<<: *base` merge keys. */
  mergeKeys: boolean;
  /** Accept anchors and aliases (&a / *a). Off rejects them, for untrusted files. */
  allowAliases: boolean;
  /** YAML 1.1 rules: yes/no/on/off booleans, 0777 octal, timestamps, !!set and !!binary. */
  yaml11: boolean;
  /** What a file with several --- documents becomes. */
  documents: 'array' | 'first';
}

export const DEFAULT_YAML_TO_JSON: YamlToJsonOptions = {
  indent: '2',
  sortKeys: false,
  mergeKeys: true,
  allowAliases: true,
  yaml11: false,
  documents: 'array',
};

const MAX_ALIASES = 10_000;

class ExpansionError extends Error {
  constructor(readonly kind: 'size' | 'cycle') {
    super(kind);
  }
}

interface Walk {
  memo: Map<object, { out: unknown; size: number }>;
  stack: Set<object>;
  nonFinite: number;
  cap: number;
  converted: Set<string>;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * Copies the loaded value into plain JSON data (dates, sets and binary become text/arrays, .inf and .nan become
 * null) while measuring how big it is once every alias is expanded. Shared nodes are measured once.
 */
function normalizeYamlValue(value: unknown, walk: Walk): { out: unknown; size: number } {
  if (value === null || value === undefined) return { out: null, size: 1 };
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return { out: value, size: 1 };
    walk.nonFinite++;
    return { out: null, size: 1 };
  }
  if (typeof value !== 'object') return { out: value, size: 1 };
  const known = walk.memo.get(value);
  if (known) return known;
  if (walk.stack.has(value)) throw new ExpansionError('cycle');
  walk.stack.add(value);
  let out: unknown;
  let size = 1;
  const child = (v: unknown) => {
    const c = normalizeYamlValue(v, walk);
    size = Math.min(walk.cap + 1, size + c.size);
    if (size > walk.cap) throw new ExpansionError('size');
    return c.out;
  };
  if (value instanceof Date) {
    out = Number.isNaN(value.getTime()) ? null : value.toISOString();
    walk.converted.add('timestamps');
  } else if (value instanceof Uint8Array) {
    out = toBase64(value);
    walk.converted.add('binary values');
  } else if (value instanceof Set) {
    out = [...value].map(child);
    walk.converted.add('sets');
  } else if (value instanceof Map) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of value) defineOwn(obj, String(k), child(v));
    out = obj;
  } else if (Array.isArray(value)) {
    out = value.map(child);
  } else {
    const obj: Record<string, unknown> = {};
    for (const key of Object.keys(value)) defineOwn(obj, key, child((value as Record<string, unknown>)[key]));
    out = obj;
  }
  walk.stack.delete(value);
  const entry = { out, size };
  walk.memo.set(value, entry);
  return entry;
}

export async function convertYamlToJson(raw: string, options: YamlToJsonOptions): Promise<ConvertResult> {
  const text = stripBom(raw);
  if (!text.trim()) return fail('There is nothing to convert yet.');
  try {
    const yaml = await import('js-yaml');
    // Integers beyond 2^53 become bigint so no digit is lost; JSON output prints them as exact numbers.
    const exactInt = yaml.defineScalarTag(yaml.intCoreTag.tagName, {
      ...yaml.intCoreTag,
      resolve: (source, isExplicit, tagName) => {
        const value = yaml.intCoreTag.resolve(source, isExplicit, tagName);
        if (typeof value === 'number' && !Number.isSafeInteger(value)) {
          const digits = source.replace(/^\+/, '');
          try {
            return BigInt(digits);
          } catch {
            return value;
          }
        }
        return value;
      },
    });
    const base = options.yaml11 ? yaml.YAML11_SCHEMA : yaml.CORE_SCHEMA.withTags(exactInt);
    const schema = options.mergeKeys && !options.yaml11 ? base.withTags(yaml.mergeTag) : base;

    let documents: unknown[];
    try {
      documents = yaml.loadAll(text, { schema, maxAliases: options.allowAliases ? MAX_ALIASES : 0 });
    } catch (error) {
      if (error instanceof yaml.YAMLException) {
        const mark = error.mark;
        const at = mark ? { line: mark.line + 1, column: mark.column + 1 } : null;
        const aliasOff = !options.allowAliases && /maxAliases/.test(error.reason);
        const message = aliasOff
          ? 'This YAML uses anchors or aliases (&name / *name), which are switched off. Turn on "Allow anchors and aliases" to expand them.'
          : error.reason;
        return failAt(`Invalid YAML: ${message}`, text, at);
      }
      throw error;
    }

    // "---" at the very end leaves one empty document that is not data.
    if (documents.length > 1 && documents[documents.length - 1] === null && /(?:^|\n)(?:---|\.\.\.)\s*$/.test(text)) documents.pop();
    if (documents.length === 0 || (documents.length === 1 && documents[0] === null && !/\bnull\b|~/.test(text))) {
      return fail('This YAML has no data: it only contains comments or empty documents.');
    }
    const warnings: string[] = [];
    let selected: unknown = documents.length === 1 ? documents[0] : documents;
    if (documents.length > 1 && options.documents === 'first') {
      selected = documents[0];
      warnings.push(`The file has ${documents.length} documents; only the first one was converted.`);
    }

    const walk: Walk = { memo: new Map(), stack: new Set(), nonFinite: 0, cap: 1_000_000 + 20 * text.length, converted: new Set() };
    let data: unknown;
    try {
      data = normalizeYamlValue(selected, walk).out;
    } catch (error) {
      if (error instanceof ExpansionError) {
        return fail(
          error.kind === 'cycle'
            ? 'An alias points back at the node that contains it, which makes the data circular. JSON cannot represent that.'
            : 'The anchors and aliases in this YAML expand to a huge amount of data (a "billion laughs" pattern). It was not converted. Turn off "Allow anchors and aliases" if you do not need them.',
        );
      }
      throw error;
    }
    if (walk.nonFinite) warnings.push(`${plural(walk.nonFinite, 'value')} (.inf, -.inf or .nan) have no JSON form and became null.`);
    if (walk.converted.size) warnings.push(`YAML ${[...walk.converted].join(', ')} were converted to JSON-friendly values (ISO text, base64 text or arrays).`);
    if (options.sortKeys) data = sortKeysDeep(data);

    const output = stringifyJson(data, jsonIndent(options.indent));
    const meta = [plural(documents.length, 'document'), `${byteLength(output).toLocaleString('en-US')} bytes`];
    return { ok: true, output, meta, warnings };
  } catch (error) {
    return failFromException(error, 'yaml-to-json');
  }
}
