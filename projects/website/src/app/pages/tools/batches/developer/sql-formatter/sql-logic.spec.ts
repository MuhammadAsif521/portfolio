import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SQL_OPTIONS,
  explainSqlError,
  formatSql,
  leadingCommas,
  minifySql,
  paramTypesFor,
  tokenizeRaw,
  type SqlFormatOptions,
} from './sql-logic';

const opts = (over: Partial<SqlFormatOptions> = {}): SqlFormatOptions => ({ ...DEFAULT_SQL_OPTIONS, ...over });

describe('tokenizeRaw', () => {
  it('separates code, strings, identifiers and comments', () => {
    const pieces = tokenizeRaw(`select 'a -- b', "x;y" /* c */ from t -- end`);
    expect(pieces.map((p) => p.kind)).toEqual(['code', 'quoted', 'code', 'quoted', 'code', 'block-comment', 'code', 'line-comment']);
    expect(pieces[1].text).toBe(`'a -- b'`);
  });

  it('handles doubled quotes, backslash escapes (MySQL) and dollar quotes (PostgreSQL)', () => {
    expect(tokenizeRaw(`'it''s'`)).toEqual([{ kind: 'quoted', text: `'it''s'` }]);
    expect(tokenizeRaw(`'a\\'b' x`, 'mysql')[0]).toEqual({ kind: 'quoted', text: `'a\\'b'` });
    expect(tokenizeRaw(`select $$a;b$$, $f$x$f$`, 'postgresql').filter((p) => p.kind === 'quoted').map((p) => p.text)).toEqual(['$$a;b$$', '$f$x$f$']);
    expect(tokenizeRaw('select [my col] from t', 'transactsql')[1]).toEqual({ kind: 'quoted', text: '[my col]' });
  });

  it('tolerates unterminated strings and comments', () => {
    expect(tokenizeRaw(`select 'oops`).at(-1)).toEqual({ kind: 'quoted', text: `'oops` });
    expect(tokenizeRaw('a /* never closed').at(-1)?.kind).toBe('block-comment');
  });
});

describe('minifySql', () => {
  it('collapses whitespace and strips comments', () => {
    expect(minifySql('SELECT  a ,\n   b\nFROM   t -- the table\nWHERE a = 1 /* x */ AND b = 2;')).toBe('SELECT a,b FROM t WHERE a = 1 AND b = 2;');
  });

  it('never changes text inside strings or quoted identifiers', () => {
    expect(minifySql(`select  'a   ,  b -- not a comment'   ,  "Col   X"  from   t`)).toBe(`select 'a   ,  b -- not a comment',"Col   X" from t`);
  });

  it('keeps MySQL optimizer hints and conditional comments', () => {
    expect(minifySql('SELECT /*+ NO_RANGE_OPTIMIZATION(t1) */   a FROM t1', 'mysql')).toBe('SELECT /*+ NO_RANGE_OPTIMIZATION(t1) */ a FROM t1');
    expect(minifySql('/*! SET x = 1 */ ;', 'mysql')).toBe('/*! SET x = 1 */;');
  });

  it('removes # comments only where the dialect has them', () => {
    expect(minifySql('SELECT 1 # note\nFROM t', 'mysql')).toBe('SELECT 1 FROM t');
    expect(minifySql('SELECT a #> b FROM t', 'postgresql')).toBe('SELECT a #> b FROM t');
  });

  it('returns an empty string for blank input', () => {
    expect(minifySql('  \n ')).toBe('');
  });
});

describe('leadingCommas', () => {
  it('moves trailing commas to the next line', () => {
    expect(leadingCommas('SELECT\n  a,\n  b,\n  c\nFROM t')).toBe('SELECT\n  a\n  , b\n  , c\nFROM t');
  });

  it('leaves commas inside strings and comments alone', () => {
    const sql = "SELECT\n  'a,\n  b',\n  c -- x,\nFROM t";
    expect(leadingCommas(sql)).toBe("SELECT\n  'a,\n  b'\n  , c -- x,\nFROM t");
  });

  it('does not move a comma onto a comment line', () => {
    expect(leadingCommas('SELECT\n  a,\n  -- note\n  b')).toBe('SELECT\n  a,\n  -- note\n  b');
  });

  it('returns text without line-end commas unchanged', () => {
    expect(leadingCommas('SELECT a, b FROM t')).toBe('SELECT a, b FROM t');
  });
});

describe('paramTypesFor', () => {
  it('maps each choice', () => {
    expect(paramTypesFor('auto')).toBeUndefined();
    expect(paramTypesFor('question')).toEqual({ positional: true });
    expect(paramTypesFor('dollar')).toEqual({ numbered: ['$'] });
    expect(paramTypesFor('colon')).toEqual({ named: [':'] });
    expect(paramTypesFor('at')).toEqual({ named: ['@'] });
    expect(paramTypesFor('braces')?.custom?.[0].regex).toContain('\\{\\{');
  });
});

describe('formatSql (sql-formatter)', () => {
  it('formats a query with upper-case keywords and 2-space indent', async () => {
    const r = await formatSql('select a,b from t where a=1 and b=2', opts());
    expect(r).toEqual({ ok: true, sql: 'SELECT\n  a,\n  b\nFROM\n  t\nWHERE\n  a = 1\n  AND b = 2' });
  });

  it('applies keyword case, tab indent and leading commas', async () => {
    const r = await formatSql('SELECT a,b FROM t', opts({ keywordCase: 'lower', indent: 'tab', commaPosition: 'leading' }));
    expect(r).toEqual({ ok: true, sql: 'select\n\ta\n\t, b\nfrom\n\tt' });
  });

  it('keeps ? and $1 placeholders as one token', async () => {
    const q = await formatSql('select * from t where a=? and b=?', opts({ dialect: 'mysql', placeholders: 'question' }));
    expect(q.ok && q.sql).toContain('a = ?');
    const p = await formatSql('select * from t where a=$1 and b=$2', opts({ placeholders: 'dollar' }));
    expect(p.ok && p.sql).toContain('b = $2');
    const b = await formatSql('select * from t where a={{ id }}', opts({ placeholders: 'braces' }));
    expect(b.ok && b.sql).toContain('{{ id }}');
  });

  it('formats dialect-specific syntax', async () => {
    const r = await formatSql('select top 5 [Name] from dbo.Users', opts({ dialect: 'transactsql' }));
    expect(r.ok && r.sql).toContain('[Name]');
    const bq = await formatSql('select `a` from `proj.ds.t`', opts({ dialect: 'bigquery' }));
    expect(bq.ok).toBe(true);
  });

  it('puts several statements apart with the chosen number of blank lines', async () => {
    const r = await formatSql('select 1; select 2;', opts({ linesBetweenQueries: 2 }));
    expect(r.ok && r.sql).toBe('SELECT\n  1;\n\n\nSELECT\n  2;');
  });

  it('returns empty output for blank input', async () => {
    expect(await formatSql('  ', opts())).toEqual({ ok: true, sql: '' });
  });

  it('turns unsupported syntax into a plain error with a position', async () => {
    const r = await formatSql("select 'unterminated from t", opts());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/line 1/);
      expect(r.error).toMatch(/dialect/i);
      expect(r.error).not.toMatch(/at .*\.js/);
    }
  });

  it('explains errors that carry no position', () => {
    expect(explainSqlError(new Error('boom'), 'mysql')).toMatch(/another dialect/);
    expect(explainSqlError(new Error('Parse error: Unexpected ")" at line 3 column 7\n...'), 'sql')).toContain('line 3, column 7');
  });
});
