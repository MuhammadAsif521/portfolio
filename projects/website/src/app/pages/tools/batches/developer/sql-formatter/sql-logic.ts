/** Helpers around the sql-formatter library: option mapping, a comment-aware minifier and leading-comma output. */

export type SqlDialect = 'postgresql' | 'mysql' | 'mariadb' | 'sqlite' | 'transactsql' | 'plsql' | 'bigquery' | 'sql';

export const SQL_DIALECTS: readonly { id: SqlDialect; name: string }[] = [
  { id: 'postgresql', name: 'PostgreSQL' },
  { id: 'mysql', name: 'MySQL' },
  { id: 'mariadb', name: 'MariaDB' },
  { id: 'sqlite', name: 'SQLite' },
  { id: 'transactsql', name: 'T-SQL (SQL Server)' },
  { id: 'plsql', name: 'PL/SQL (Oracle)' },
  { id: 'bigquery', name: 'BigQuery' },
  { id: 'sql', name: 'Standard SQL' },
];

export type PlaceholderStyle = 'auto' | 'question' | 'dollar' | 'colon' | 'at' | 'braces';

export const PLACEHOLDER_STYLES: readonly { id: PlaceholderStyle; name: string }[] = [
  { id: 'auto', name: 'Dialect default' },
  { id: 'question', name: '? (positional)' },
  { id: 'dollar', name: '$1, $2 (numbered)' },
  { id: 'colon', name: ':name' },
  { id: 'at', name: '@name' },
  { id: 'braces', name: '{{name}}' },
];

export interface ParamTypesLike {
  positional?: boolean;
  numbered?: ('?' | ':' | '$')[];
  named?: (':' | '@' | '$')[];
  custom?: { regex: string }[];
}

/** Maps the placeholder choice to sql-formatter's paramTypes (undefined keeps the dialect's own defaults). */
export function paramTypesFor(style: PlaceholderStyle): ParamTypesLike | undefined {
  switch (style) {
    case 'question':
      return { positional: true };
    case 'dollar':
      return { numbered: ['$'] };
    case 'colon':
      return { named: [':'] };
    case 'at':
      return { named: ['@'] };
    case 'braces':
      return { custom: [{ regex: String.raw`\{\{\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\}\}` }] };
    default:
      return undefined;
  }
}

export interface SqlFormatOptions {
  dialect: SqlDialect;
  keywordCase: 'upper' | 'lower' | 'preserve';
  /** Spaces per level, or 'tab'. */
  indent: 2 | 4 | 'tab';
  commaPosition: 'trailing' | 'leading';
  /** Blank lines between statements. */
  linesBetweenQueries: number;
  placeholders: PlaceholderStyle;
  /** Break lines wider than this many characters in parenthesised lists. */
  expressionWidth: number;
  logicalOperatorNewline: 'before' | 'after';
}

export const DEFAULT_SQL_OPTIONS: SqlFormatOptions = {
  dialect: 'postgresql',
  keywordCase: 'upper',
  indent: 2,
  commaPosition: 'trailing',
  linesBetweenQueries: 1,
  placeholders: 'auto',
  expressionWidth: 50,
  logicalOperatorNewline: 'before',
};

export type SqlResult = { ok: true; sql: string } | { ok: false; error: string };

/** Turns a sql-formatter error into one plain sentence that says where it stopped and what to try. */
export function explainSqlError(error: unknown, dialect: SqlDialect): string {
  const raw = error instanceof Error ? error.message : String(error);
  const parse = /Parse error: Unexpected (.+?) at line (\d+) column (\d+)/s.exec(raw);
  if (parse) {
    const token = parse[1].split('\n')[0].slice(0, 60);
    return `Could not parse the SQL: unexpected ${token} at line ${parse[2]}, column ${parse[3]}. This dialect may not support that syntax; try another dialect or check the statement.`;
  }
  const unsupported = /Unexpected (.+)$/m.exec(raw);
  if (unsupported) return `Could not parse the SQL near ${unsupported[1].slice(0, 60)}. Try another dialect than ${dialect}.`;
  return 'Could not format this SQL. It may use syntax the selected dialect does not support; try another dialect.';
}

/** Formats with the sql-formatter library (loaded on demand). */
export async function formatSql(sql: string, opts: SqlFormatOptions): Promise<SqlResult> {
  if (!sql.trim()) return { ok: true, sql: '' };
  try {
    const { format } = await import('sql-formatter');
    const paramTypes = paramTypesFor(opts.placeholders);
    const formatted = format(sql, {
      language: opts.dialect,
      keywordCase: opts.keywordCase,
      tabWidth: opts.indent === 'tab' ? 2 : opts.indent,
      useTabs: opts.indent === 'tab',
      linesBetweenQueries: opts.linesBetweenQueries,
      expressionWidth: opts.expressionWidth,
      logicalOperatorNewline: opts.logicalOperatorNewline,
      ...(paramTypes ? { paramTypes } : {}),
    });
    return { ok: true, sql: opts.commaPosition === 'leading' ? leadingCommas(formatted) : formatted };
  } catch (error) {
    return { ok: false, error: explainSqlError(error, opts.dialect) };
  }
}

// Lexical scanning (strings, quoted identifiers, comments) -------------------------------------------------------------

/** Splits SQL into code, quoted text (strings, quoted identifiers, dollar quotes) and comments, so that the minifier
 * and the leading-comma pass never touch the inside of a string or a comment. */
export type Piece = { kind: 'code' | 'quoted' | 'line-comment' | 'block-comment'; text: string };

export function tokenizeRaw(sql: string, dialect: SqlDialect = 'sql'): Piece[] {
  const backslashEscapes = dialect === 'mysql' || dialect === 'mariadb' || dialect === 'bigquery';
  const pieces: Piece[] = [];
  let code = '';
  const flush = () => {
    if (code) pieces.push({ kind: 'code', text: code });
    code = '';
  };
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === '-' && next === '-') {
      flush();
      let end = sql.indexOf('\n', i);
      if (end === -1) end = sql.length;
      pieces.push({ kind: 'line-comment', text: sql.slice(i, end) });
      i = end;
    } else if (ch === '#' && (dialect === 'mysql' || dialect === 'mariadb' || dialect === 'bigquery')) {
      flush();
      let end = sql.indexOf('\n', i);
      if (end === -1) end = sql.length;
      pieces.push({ kind: 'line-comment', text: sql.slice(i, end) });
      i = end;
    } else if (ch === '/' && next === '*') {
      flush();
      const close = sql.indexOf('*/', i + 2);
      const end = close === -1 ? sql.length : close + 2;
      pieces.push({ kind: 'block-comment', text: sql.slice(i, end) });
      i = end;
    } else if (ch === "'" || ch === '"' || ch === '`' || (ch === '[' && dialect === 'transactsql')) {
      flush();
      const closer = ch === '[' ? ']' : ch;
      let j = i + 1;
      while (j < sql.length) {
        if (backslashEscapes && sql[j] === '\\' && ch !== '`') j += 2;
        else if (sql[j] === closer && sql[j + 1] === closer) j += 2;
        else if (sql[j] === closer) break;
        else j++;
      }
      const end = Math.min(j + 1, sql.length);
      pieces.push({ kind: 'quoted', text: sql.slice(i, end) });
      i = end;
    } else if (ch === '$' && dialect === 'postgresql') {
      const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (tag) {
        flush();
        const close = sql.indexOf(tag[0], i + tag[0].length);
        const end = close === -1 ? sql.length : close + tag[0].length;
        pieces.push({ kind: 'quoted', text: sql.slice(i, end) });
        i = end;
      } else {
        code += ch;
        i++;
      }
    } else {
      code += ch;
      i++;
    }
  }
  flush();
  return pieces;
}

/**
 * Collapses SQL to one line: whitespace runs become one space and comments are removed (MySQL optimizer hints
 * and conditional comments, slash-star-plus and slash-star-bang, are kept because they change behaviour).
 * Text inside strings and quoted identifiers is never touched.
 */
export function minifySql(sql: string, dialect: SqlDialect = 'sql'): string {
  let out = '';
  const push = (text: string) => {
    out += out.endsWith(' ') && text.startsWith(' ') ? text.slice(1) : text;
  };
  for (const piece of tokenizeRaw(sql, dialect)) {
    if (piece.kind === 'code') push(piece.text.replace(/\s+/g, ' ').replace(/ ?([,;()]) ?/g, '$1'));
    else if (piece.kind === 'quoted') push(piece.text);
    else if (piece.kind === 'block-comment' && /^\/\*[+!]/.test(piece.text)) push(piece.text.replace(/\s+/g, ' '));
    else push(' ');
  }
  return out.trim();
}

/**
 * Moves each trailing comma to the start of the next line ("a,\n b" becomes "a\n, b"). Commas inside strings,
 * quoted identifiers and comments are left alone, and nothing is moved when the next line starts a comment or
 * continues a multi-line string.
 */
export function leadingCommas(formatted: string): string {
  const isCode = new Uint8Array(formatted.length + 1);
  let offset = 0;
  for (const piece of tokenizeRaw(formatted)) {
    if (piece.kind === 'code') isCode.fill(1, offset, offset + piece.text.length);
    offset += piece.text.length;
  }
  const lines = formatted.split('\n');
  const starts: number[] = [];
  let pos = 0;
  for (const line of lines) {
    starts.push(pos);
    pos += line.length + 1;
  }
  const out: string[] = [];
  let moveToNext = false;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (moveToNext) {
      const indent = /^\s*/.exec(line)![0];
      line = `${indent}, ${line.slice(indent.length)}`;
      moveToNext = false;
    }
    const trimmed = lines[i].replace(/\s+$/, '');
    const next = lines[i + 1];
    if (
      next !== undefined &&
      trimmed.endsWith(',') &&
      isCode[starts[i] + trimmed.length - 1] === 1 &&
      next.trim() !== '' &&
      !/^\s*(--|\/\*|#)/.test(next) &&
      isCode[starts[i + 1] + /^\s*/.exec(next)![0].length] === 1
    ) {
      line = line.replace(/,\s*$/, '');
      moveToNext = true;
    }
    out.push(line);
  }
  return out.join('\n');
}
