/** Pure, browser-only logic behind the tools. No DOM, no network: easy to test and safe to run in SSR. */

// ── ObjectId ─────────────────────────────────────────────────────────────────

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export interface ObjectIdInfo {
  seconds: number;
  iso: string;
  local: string;
  /** The 5 random bytes (hex) and the 3-byte counter (hex). */
  random: string;
  counter: string;
}

export function decodeObjectId(input: string): ObjectIdInfo | null {
  const id = input.trim();
  if (!OBJECT_ID.test(id)) return null;
  const seconds = parseInt(id.slice(0, 8), 16);
  const date = new Date(seconds * 1000);
  return {
    seconds,
    iso: date.toISOString(),
    local: date.toLocaleString(),
    random: id.slice(8, 18),
    counter: id.slice(18),
  };
}

/** Lowest ObjectId for a moment (other 8 bytes zero): the boundary for `_id: { $gte: ... }` queries. */
export function objectIdFromDate(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const date = /^\d{9,13}$/.test(value) ? new Date(value.length > 10 ? Number(value) : Number(value) * 1000) : new Date(value);
  const seconds = Math.floor(date.getTime() / 1000);
  if (Number.isNaN(seconds) || seconds < 0 || seconds > 0xffffffff) return null;
  return seconds.toString(16).padStart(8, '0') + '0'.repeat(16);
}

// ── JWT ──────────────────────────────────────────────────────────────────────

export interface JwtInfo {
  header: unknown;
  payload: unknown;
  /** Claims that are Unix times, as ISO dates (exp, iat, nbf). */
  times: { claim: string; iso: string }[];
  expired: boolean | null;
}

export type JwtResult = { ok: true; value: JwtInfo } | { ok: false; error: string };

function decodeBase64Url(part: string): unknown {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function decodeJwt(input: string, now = Date.now()): JwtResult | null {
  const token = input.trim().replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, error: 'A JWT has 3 parts separated by dots (header.payload.signature).' };
  try {
    const header = decodeBase64Url(parts[0]);
    const payload = decodeBase64Url(parts[1]);
    const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const times = ['exp', 'iat', 'nbf']
      .filter((claim) => typeof record[claim] === 'number')
      .map((claim) => ({ claim, iso: new Date((record[claim] as number) * 1000).toISOString() }));
    const exp = typeof record['exp'] === 'number' ? (record['exp'] as number) * 1000 : null;
    return { ok: true, value: { header, payload, times, expired: exp === null ? null : exp < now } };
  } catch {
    return { ok: false, error: 'Could not decode this token. Check that it is a complete, unmodified JWT.' };
  }
}

// ── JSON → TypeScript ───────────────────────────────────────────────────────

/** Extra meaning of a string sample, used by the Mongoose generator (TypeScript output ignores it). */
type StringFormat = 'date' | 'objectId';

type Shape =
  | { kind: 'prim'; name: 'string' | 'number' | 'boolean' | 'null' | 'unknown'; format?: StringFormat }
  | { kind: 'obj'; props: Map<string, { shape: Shape; optional: boolean }> }
  | { kind: 'arr'; item: Shape | null }
  | { kind: 'union'; members: Shape[] };

const prim = (name: 'string' | 'number' | 'boolean' | 'null' | 'unknown'): Shape => ({ kind: 'prim', name });

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function stringFormat(value: string): StringFormat | undefined {
  if (OBJECT_ID.test(value)) return 'objectId';
  if (ISO_DATE.test(value) && !Number.isNaN(Date.parse(value))) return 'date';
  return undefined;
}

function infer(value: unknown): Shape {
  if (value === null) return prim('null');
  if (Array.isArray(value)) {
    return { kind: 'arr', item: value.length ? value.map(infer).reduce(merge) : null };
  }
  switch (typeof value) {
    case 'string': {
      const format = stringFormat(value);
      return format ? { kind: 'prim', name: 'string', format } : prim('string');
    }
    case 'number':
      return prim('number');
    case 'boolean':
      return prim('boolean');
    case 'object': {
      const props = new Map<string, { shape: Shape; optional: boolean }>();
      for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        props.set(key, { shape: infer(inner), optional: false });
      }
      return { kind: 'obj', props };
    }
    default:
      return prim('unknown');
  }
}

function sameKind(a: Shape, b: Shape): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind !== 'prim' || a.name === (b as typeof a).name;
}

function merge(a: Shape, b: Shape): Shape {
  if (a.kind === 'union' || b.kind === 'union') {
    const members = [...(a.kind === 'union' ? a.members : [a]), ...(b.kind === 'union' ? b.members : [b])];
    const merged: Shape[] = [];
    for (const member of members) {
      const at = merged.findIndex((existing) => sameKind(existing, member));
      if (at === -1) merged.push(member);
      else merged[at] = merge(merged[at], member);
    }
    return merged.length === 1 ? merged[0] : { kind: 'union', members: merged };
  }
  if (a.kind === 'obj' && b.kind === 'obj') {
    const props = new Map<string, { shape: Shape; optional: boolean }>();
    for (const key of new Set([...a.props.keys(), ...b.props.keys()])) {
      const left = a.props.get(key);
      const right = b.props.get(key);
      props.set(key, {
        shape: left && right ? merge(left.shape, right.shape) : (left ?? right)!.shape,
        optional: !left || !right || left.optional || right.optional,
      });
    }
    return { kind: 'obj', props };
  }
  if (a.kind === 'arr' && b.kind === 'arr') {
    return { kind: 'arr', item: a.item && b.item ? merge(a.item, b.item) : (a.item ?? b.item) };
  }
  if (sameKind(a, b)) {
    // Two strings keep a format only when both samples agree on it.
    if (a.kind === 'prim' && b.kind === 'prim' && a.format !== b.format) return prim(a.name);
    return a;
  }
  return { kind: 'union', members: [a, b] };
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function pascal(key: string): string {
  const name = key
    .replace(/[^A-Za-z0-9]+(.)?/g, (_match, char: string | undefined) => (char ?? '').toUpperCase())
    .replace(/^./, (char) => char.toUpperCase());
  return /^[A-Za-z_]/.test(name) ? name : `T${name}`;
}

function singular(name: string): string {
  return name.length > 3 && name.endsWith('s') && !name.endsWith('ss') ? name.slice(0, -1) : name;
}

export type TsStyle = 'interface' | 'type';

/** Returns TypeScript source, or an error message when the input is not valid JSON. */
export function jsonToTypeScript(
  source: string,
  rootName = 'Root',
  style: TsStyle = 'interface',
): { ok: true; code: string } | { ok: false; error: string } | null {
  if (!source.trim()) return null;
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    return { ok: false, error: `Invalid JSON: ${(error as Error).message}` };
  }

  const declarations: string[] = [];
  const used = new Set<string>();
  const unique = (base: string) => {
    let name = base;
    for (let n = 2; used.has(name); n++) name = `${base}${n}`;
    used.add(name);
    return name;
  };

  const render = (shape: Shape, hint: string): string => {
    switch (shape.kind) {
      case 'prim':
        return shape.name;
      case 'arr': {
        if (!shape.item) return 'unknown[]';
        const inner = render(shape.item, singular(hint));
        return shape.item.kind === 'union' ? `(${inner})[]` : `${inner}[]`;
      }
      case 'union':
        return shape.members.map((member) => render(member, hint)).join(' | ');
      case 'obj': {
        if (!shape.props.size) return 'Record<string, unknown>';
        const name = unique(pascal(hint));
        const lines = [...shape.props].map(([key, prop]) => {
          const printed = IDENTIFIER.test(key) ? key : JSON.stringify(key);
          return `  ${printed}${prop.optional ? '?' : ''}: ${render(prop.shape, key)};`;
        });
        declarations.push(
          style === 'interface'
            ? `export interface ${name} {\n${lines.join('\n')}\n}`
            : `export type ${name} = {\n${lines.join('\n')}\n};`,
        );
        return name;
      }
    }
  };

  const root = pascal(rootName.trim() || 'Root');
  const shape = infer(value);
  used.add(root);
  if (shape.kind === 'obj') {
    used.delete(root);
    render(shape, root);
  } else {
    declarations.push(`export type ${root} = ${render(shape, root)};`);
  }
  // The root object is pushed last (children render first), so show it first.
  const [rootDeclaration] = shape.kind === 'obj' ? declarations.splice(declarations.length - 1, 1) : [];
  return { ok: true, code: [rootDeclaration, ...declarations].filter(Boolean).join('\n\n') };
}

// ── JSON → Mongoose schema ───────────────────────────────────────────────────

export interface MongooseOptions {
  modelName?: string;
  required?: boolean;
  timestamps?: boolean;
}

const camel = (name: string) => {
  const p = pascal(name);
  return p.charAt(0).toLowerCase() + p.slice(1);
};

const isNull = (s: Shape) => s.kind === 'prim' && s.name === 'null';

/** Returns Mongoose schema + model source, or an error when the input is not a JSON object (or array of objects). */
export function jsonToMongoose(
  source: string,
  options: MongooseOptions = {},
): { ok: true; code: string } | { ok: false; error: string } | null {
  if (!source.trim()) return null;
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    return { ok: false, error: `Invalid JSON: ${(error as Error).message}` };
  }
  let shape = infer(value);
  if (shape.kind === 'arr' && shape.item) shape = shape.item;
  if (shape.kind !== 'obj') return { ok: false, error: 'Paste a JSON object, or an array of objects.' };

  const modelName = pascal(options.modelName?.trim() || 'Model');
  const required = options.required ?? true;
  const timestamps = options.timestamps ?? true;
  const skip = new Set(['_id', '__v', ...(timestamps ? ['createdAt', 'updatedAt'] : [])]);
  const schemaName = `${camel(modelName)}Schema`;
  const declarations: string[] = [];
  const used = new Set<string>([schemaName]);
  const unique = (base: string) => {
    let name = base;
    for (let n = 2; used.has(name); n++) name = `${base}${n}`;
    used.add(name);
    return name;
  };

  /** The `type` of a path; null-only shapes and real unions fall back to Mixed. */
  const typeOf = (s: Shape, key: string): string => {
    switch (s.kind) {
      case 'prim':
        if (s.name === 'string') {
          return s.format === 'date' ? 'Date' : s.format === 'objectId' ? 'Schema.Types.ObjectId' : 'String';
        }
        if (s.name === 'number') return 'Number';
        if (s.name === 'boolean') return 'Boolean';
        return 'Schema.Types.Mixed';
      case 'arr':
        return `[${s.item ? typeOf(s.item, singular(key)) : 'Schema.Types.Mixed'}]`;
      case 'obj':
        return subSchema(s, key);
      case 'union': {
        const real = s.members.filter((m) => !isNull(m));
        return real.length === 1 ? typeOf(real[0], key) : 'Schema.Types.Mixed';
      }
    }
  };

  const fields = (s: Extract<Shape, { kind: 'obj' }>, top: boolean): string[] =>
    [...s.props]
      .filter(([key]) => !(top && skip.has(key)))
      .map(([key, prop]) => {
        const name = IDENTIFIER.test(key) ? key : JSON.stringify(key);
        const type = typeOf(prop.shape, key);
        if (prop.shape.kind === 'arr') return `${name}: { type: ${type}, default: [] },`;
        const nullable = isNull(prop.shape) || (prop.shape.kind === 'union' && prop.shape.members.some(isNull));
        const isRequired = required && !prop.optional && !nullable && type !== 'Schema.Types.Mixed';
        return `${name}: { type: ${type}${isRequired ? ', required: true' : ''} },`;
      });

  const block = (name: string, lines: string[], opts: string) =>
    `const ${name} = new Schema(\n  {\n${lines.map((l) => `    ${l}`).join('\n')}\n  },${opts ? `\n  ${opts},` : ''}\n);`;

  function subSchema(s: Extract<Shape, { kind: 'obj' }>, key: string): string {
    const name = unique(`${camel(key)}Schema`);
    declarations.push(block(name, fields(s, false), '{ _id: false }'));
    return name;
  }

  const root = block(schemaName, fields(shape, true), timestamps ? '{ timestamps: true }' : '');
  const code = [
    "import { Schema, model } from 'mongoose';",
    ...declarations,
    root,
    `export const ${modelName} = model('${modelName}', ${schemaName});`,
  ].join('\n\n');
  return { ok: true, code };
}

// ── Cron ─────────────────────────────────────────────────────────────────────

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

interface FieldSpec {
  label: string;
  min: number;
  max: number;
  names?: string[];
  /** Number of the first name (months start at 1, weekdays at 0). */
  nameBase?: number;
}

const SPECS: FieldSpec[] = [
  { label: 'minute', min: 0, max: 59 },
  { label: 'hour', min: 0, max: 23 },
  { label: 'day of month', min: 1, max: 31 },
  { label: 'month', min: 1, max: 12, names: MONTHS, nameBase: 1 },
  { label: 'day of week', min: 0, max: 7, names: DAYS, nameBase: 0 },
];

const isWeekday = (spec: FieldSpec) => spec.label === 'day of week';

function tokenValue(token: string, spec: FieldSpec): number {
  const named = spec.names?.indexOf(token.toUpperCase()) ?? -1;
  const n = named >= 0 ? named + (spec.nameBase ?? 0) : /^\d+$/.test(token) ? Number(token) : NaN;
  if (Number.isNaN(n) || n < spec.min || n > spec.max) {
    throw new Error(`"${token}" is not a valid ${spec.label} (${spec.min}-${spec.max}).`);
  }
  return isWeekday(spec) && n === 7 ? 0 : n;
}

function parseField(raw: string, spec: FieldSpec): Set<number> {
  const values = new Set<number>();
  for (const part of raw.split(',')) {
    const [range, stepText] = part.split('/');
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step < 1) throw new Error(`"${part}" has an invalid step in the ${spec.label} field.`);
    let from: number;
    let to: number;
    if (range === '*') {
      [from, to] = [spec.min, isWeekday(spec) ? 6 : spec.max];
    } else if (range.includes('-')) {
      const [a, b] = range.split('-');
      // A weekday range may end on 7 (Sunday): keep it as 7 while expanding.
      from = tokenValue(a, spec);
      to = isWeekday(spec) && b === '7' ? 7 : tokenValue(b, spec);
      if (from > to) throw new Error(`"${range}" is a backwards range in the ${spec.label} field.`);
    } else {
      from = tokenValue(range, spec);
      to = stepText === undefined ? from : spec.max;
    }
    for (let v = from; v <= to; v += step) values.add(isWeekday(spec) && v === 7 ? 0 : v);
  }
  return values;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "1-5" → "Monday through Friday", "1,15" → "1 and 15", "*\/2" → "every 2 hours". */
function listText(raw: string, spec: FieldSpec, fmt: (n: number) => string): string {
  const parts = raw.split(',').map((part) => {
    const [range, step] = part.split('/');
    const show = (t: string) => fmt(tokenValue(t, spec));
    const span =
      range === '*' ? '' : range.includes('-') ? `${show(range.split('-')[0])} through ${show(range.split('-')[1])}` : show(range);
    const unit = { minute: 'minutes', hour: 'hours', 'day of month': 'days', month: 'months', 'day of week': 'days' }[spec.label];
    if (step) return `every ${step} ${unit}${span ? ` from ${span}` : ''}`;
    return span;
  });
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
}

function minutePhrase(raw: string): string {
  if (raw === '*') return 'Every minute';
  if (/^\*\/\d+$/.test(raw)) return `Every ${raw.slice(2)} minutes`;
  if (/^\d+$/.test(raw)) return `At minute ${raw}`;
  if (/^\d+-\d+$/.test(raw)) return `Every minute from ${raw.replace('-', ' through ')}`;
  if (/^\d+-\d+\/\d+$/.test(raw)) {
    const [range, step] = raw.split('/');
    return `Every ${step} minutes from ${range.replace('-', ' through ')}`;
  }
  return `At minutes ${listText(raw, SPECS[0], String)}`;
}

function hourPhrase(raw: string, minuteRaw: string): string {
  if (raw === '*') return /^\d+$/.test(minuteRaw) ? ' past every hour' : '';
  if (/^\*\/\d+$/.test(raw)) return `, every ${raw.slice(2)} hours`;
  if (/^\d+-\d+$/.test(raw)) {
    const [a, b] = raw.split('-').map(Number);
    return `, between ${pad(a)}:00 and ${pad(b)}:59`;
  }
  if (/^\d+$/.test(raw)) return `, between ${pad(Number(raw))}:00 and ${pad(Number(raw))}:59`;
  return `, during hours ${listText(raw, SPECS[1], String)}`;
}

export interface CronInfo {
  description: string;
  next: Date[];
}

export type CronResult = { ok: true; value: CronInfo } | { ok: false; error: string };

/** Explains a 5-field cron expression and lists the next `count` runs (local time) after `from`. */
export function explainCron(input: string, from = new Date(), count = 5): CronResult | null {
  const text = input.trim();
  if (!text) return null;
  const expression = MACROS[text.toLowerCase()] ?? text;
  const raw = expression.split(/\s+/);
  if (raw.length !== 5) {
    return {
      ok: false,
      error: `A cron expression has 5 fields (minute hour day-of-month month day-of-week); this one has ${raw.length}.`,
    };
  }
  let sets: Set<number>[];
  try {
    sets = raw.map((r, i) => parseField(r, SPECS[i]));
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  const [mRaw, hRaw, domRaw, monRaw, dowRaw] = raw;
  const [minutes, hours, doms, months, dows] = sets;

  const time =
    /^\d+$/.test(mRaw) && /^\d+(,\d+)*$/.test(hRaw)
      ? `At ${hRaw
          .split(',')
          .map((h) => `${pad(Number(h))}:${pad(Number(mRaw))}`)
          .join(', ')}`
      : minutePhrase(mRaw) + hourPhrase(hRaw, mRaw);

  const parts = [time];
  const domList = domRaw === '*' ? '' : listText(domRaw, SPECS[2], String);
  const domText = !domList ? '' : domList.startsWith('every') ? domList : `on day ${domList} of the month`;
  const dowText = dowRaw === '*' ? '' : `on ${listText(dowRaw, SPECS[4], (n) => DAY_NAMES[n])}`;
  if (domText && dowText) parts.push(`${domText} or ${dowText}`);
  else if (domText || dowText) parts.push(domText || dowText);
  if (monRaw !== '*') parts.push(`in ${listText(monRaw, SPECS[3], (n) => MONTH_NAMES[n - 1])}`);
  const description = `${parts.join(', ')}.`;

  // Classic cron: when both day fields are restricted, a day matches if either one does.
  const dayMatches = (d: Date) => {
    if (domRaw !== '*' && dowRaw !== '*') return doms.has(d.getDate()) || dows.has(d.getDay());
    if (domRaw !== '*') return doms.has(d.getDate());
    if (dowRaw !== '*') return dows.has(d.getDay());
    return true;
  };
  const sortedHours = [...hours].sort((a, b) => a - b);
  const sortedMinutes = [...minutes].sort((a, b) => a - b);
  const next: Date[] = [];
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  // Walk forward a day at a time; 8 years covers Feb 29 schedules.
  for (let i = 0; i < 366 * 8 && next.length < count; i++, day.setDate(day.getDate() + 1)) {
    if (!months.has(day.getMonth() + 1) || !dayMatches(day)) continue;
    for (const h of sortedHours) {
      for (const m of sortedMinutes) {
        const run = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
        if (run > from && next.length < count) next.push(run);
      }
    }
  }
  return { ok: true, value: { description, next } };
}
