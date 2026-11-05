import {
  type ConvertResult,
  byteLength,
  createBigIntMarker,
  failFromException,
  mapBigInts,
  parseJson,
  plural,
  sortKeysDeep,
} from '../shared/convert-common';

/*
 * JSON → YAML with js-yaml's dumper. JSON.parse never produces shared object references, so "anchors off" is
 * always true here (noRefs); the options below only change how the text looks, never what it means.
 */

export type YamlQuoting = 'minimal-single' | 'minimal-double' | 'all-single' | 'all-double';

export interface JsonToYamlOptions {
  indent: 2 | 4 | 3 | 6;
  /** Fold long text at this column; -1 never folds. */
  lineWidth: number;
  quoting: YamlQuoting;
  sortKeys: boolean;
  /** A top-level array becomes one YAML document per item, separated by ---. */
  multiDocument: boolean;
  /** Write list items at the same indent as their key (the Kubernetes style) instead of nested under it. */
  flushLists: boolean;
}

export const DEFAULT_JSON_TO_YAML: JsonToYamlOptions = {
  indent: 2,
  lineWidth: 80,
  quoting: 'minimal-single',
  sortKeys: false,
  multiDocument: false,
  flushLists: false,
};

export async function convertJsonToYaml(text: string, options: JsonToYamlOptions): Promise<ConvertResult> {
  try {
    const parsed = parseJson(text);
    if (!parsed.ok) return parsed;
    const yaml = await import('js-yaml');
    const marker = createBigIntMarker();
    let value = parsed.bigInts ? mapBigInts(parsed.value, (v) => marker.mark(v)) : parsed.value;
    if (options.sortKeys) value = sortKeysDeep(value);

    const dumpOptions = {
      indent: Number(options.indent),
      lineWidth: Number(options.lineWidth),
      quoteStyle: options.quoting.endsWith('double') ? ('double' as const) : ('single' as const),
      forceQuotes: options.quoting.startsWith('all'),
      noRefs: true,
      seqNoIndent: options.flushLists,
    };
    const warnings = [...parsed.warnings];
    let output: string;
    let documents = 1;
    if (options.multiDocument && Array.isArray(value)) {
      documents = value.length;
      output = value.map((item) => yaml.dump(item, dumpOptions)).join('---\n');
      if (documents === 0) output = yaml.dump(value, dumpOptions);
    } else {
      output = yaml.dump(value, dumpOptions);
      if (options.multiDocument) warnings.push('Multiple documents need a top-level array. This JSON is not one, so it was written as a single document.');
    }
    output = marker.restore(output);
    if (parsed.bigInts) warnings.push(`${plural(parsed.bigInts, 'integer')} beyond 2^53 kept exact as plain YAML integers.`);

    const lines = output === '' ? 0 : output.replace(/\n$/, '').split('\n').length;
    const meta = [plural(lines, 'line'), `${byteLength(output).toLocaleString('en-US')} bytes`];
    if (options.multiDocument && documents > 1) meta.unshift(plural(documents, 'document'));
    return { ok: true, output, meta, warnings };
  } catch (error) {
    return failFromException(error, 'json-to-yaml');
  }
}
