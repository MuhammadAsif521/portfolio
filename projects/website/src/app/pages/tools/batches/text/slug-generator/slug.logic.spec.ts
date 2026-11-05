import { describe, expect, it } from 'vitest';
import { DEFAULT_SLUG_OPTIONS, SLUG_STOP_WORDS, detectCyrillic, joinWithLimit, slugify, slugifyLines, transliterate } from './slug.logic';

const slug = (text: string, o = {}) => slugify(text, o).slug;

describe('basic slugs', () => {
  it('lowercases, hyphenates and trims', () => {
    expect(slug('  Hello, World!  ')).toBe('hello-world');
    expect(slug('10 Tips for Better Angular Apps')).toBe('10-tips-for-better-angular-apps');
    expect(slug('multiple   spaces\tand\nlines')).toBe('multiple-spaces-and-lines');
    expect(slug('--already--sluggy--')).toBe('already-sluggy');
  });
  it('empty and symbol-only input give an empty slug', () => {
    expect(slug('')).toBe('');
    expect(slug('   ')).toBe('');
    expect(slug('!!! ??? ---')).toBe('');
    expect(slug('👋🎉')).toBe('');
  });
  it('apostrophes vanish, other punctuation separates', () => {
    expect(slug("Don't stop – it's 5 o'clock")).toBe('dont-stop-its-5-oclock');
    expect(slug("l’été à Paris")).toBe('lete-a-paris');
    expect(slug('node.js/express_v4')).toBe('node-js-express-v4');
  });
  it('ampersand becomes "and" unless switched off', () => {
    expect(slug('Tom & Jerry')).toBe('tom-and-jerry');
    expect(slug('R&D')).toBe('r-and-d');
    expect(slug('Tom & Jerry', { ampersandToAnd: false })).toBe('tom-jerry');
  });
  it('keeps case when asked', () => {
    expect(slug('Hello World', { lowercase: false })).toBe('Hello-World');
  });
  it('separator choices', () => {
    expect(slug('a b c', { separator: '_' })).toBe('a_b_c');
    expect(slug('a b c', { separator: '.' })).toBe('a.b.c');
    expect(slug('a b c', { separator: '' })).toBe('abc');
  });
});

describe('Latin transliteration', () => {
  it.each([
    ['Über große Brücken, Straße', 'uber-grosse-brucken-strasse'],
    ['Müller Käse Öl', 'muller-kase-ol'],
    ['Crème brûlée à la façon française', 'creme-brulee-a-la-facon-francaise'],
    ['Œuvre Æther', 'oeuvre-aether'],
    ['Año nuevo, niño ñandú ¿qué?', 'ano-nuevo-nino-nandu-que'],
    ['İstanbul Işık Çiğdem Şeker Ğ', 'istanbul-isik-cigdem-seker-g'],
    ['Zażółć gęślą jaźń', 'zazolc-gesla-jazn'],
    ['Łódź Wrocław Gdańsk', 'lodz-wroclaw-gdansk'],
    ['Smørrebrød og Åse, Đorđe Þór', 'smorrebrod-og-ase-dorde-thor'],
  ])('%s', (input, expected) => {
    expect(slug(input)).toBe(expected);
  });
  it('German option expands umlauts', () => {
    expect(slug('Müller Käse Öl Größe', { language: 'de' })).toBe('mueller-kaese-oel-groesse');
    expect(slug('Über', { language: 'de' })).toBe('ueber');
    expect(slug('Müller', { language: 'auto' })).toBe('muller');
  });
  it('decomposed accents give the same result as precomposed', () => {
    expect(slug('café')).toBe('cafe');
    expect(slug('café')).toBe('cafe');
  });
  it('case is kept when lowercase is off', () => {
    expect(slug('Über Straße', { lowercase: false })).toBe('Uber-Strasse');
    expect(slug('ÆSIR', { lowercase: false })).toBe('AeSIR');
  });
});

describe('Cyrillic', () => {
  it('Russian', () => {
    expect(slug('Привет, мир!')).toBe('privet-mir');
    expect(slug('Москва — столица России')).toBe('moskva-stolitsa-rossii');
    expect(slug('Щука, чашка, ёлка, юла, яма, съезд, быть')).toBe('shchuka-chashka-yolka-yula-yama-sezd-byt');
    expect(slug('Съешь ещё этих мягких булок')).toBe('sesh-eshchyo-etikh-myagkikh-bulok');
  });
  it('Ukrainian is detected and uses its own rules', () => {
    expect(detectCyrillic('Київ')).toBe('uk');
    expect(slug('Київ, Україна')).toBe('kyiv-ukraina');
    expect(slug('Гарний день, їжак, Єнакієве')).toBe('harnyi-den-yizhak-yenakiieve');
    expect(slug('Львів і Харків')).toBe('lviv-i-kharkiv');
  });
  it('Serbian Cyrillic', () => {
    expect(detectCyrillic('Ђорђе')).toBe('sr');
    expect(slug('Ђорђе је љут, њушка, џак, ћирилица')).toBe('djordje-je-ljut-njuska-dzak-cirilica');
  });
  it('can be forced with the language option', () => {
    expect(slug('город', { language: 'uk' })).toBe('horod');
    expect(slug('город', { language: 'ru' })).toBe('gorod');
  });
  it('Greek', () => {
    expect(slug('Καλημέρα κόσμε')).toBe('kalimera-kosme');
    expect(slug('Ελλάδα Αθήνα')).toBe('ellada-athina');
  });
});

describe('Arabic, Persian and Urdu (consonant skeleton)', () => {
  it('maps letters, drops marks, converts digits', () => {
    expect(slug('مرحبا بالعالم')).toBe('mrhba-balaalm');
    expect(slug('محمد')).toBe('mhmd');
    expect(slug('السَّلامُ عَلَيْكُمْ')).toBe('alslam-alykm');
    expect(slug('رقم ٢٠٢٦')).toBe('rqm-2026');
  });
  it('Persian and Urdu letters', () => {
    expect(slug('چای')).toBe('chay');
    expect(slug('پاکستان')).toBe('pakstan');
    expect(slug('کتاب گھر ٹی وی')).toBe('ktab-ghr-ty-wy');
    expect(slug('ڈاکٹر')).toBe('daktr');
  });
});

describe('scripts without a mapping', () => {
  it('are dropped and reported in ASCII mode', () => {
    const r = slugify('Hello 日本語 world');
    expect(r.slug).toBe('hello-world');
    expect(r.dropped.sort()).toEqual(['日', '本', '語'].sort());
    expect(slugify('日本語').slug).toBe('');
  });
  it('are kept when transliteration is off (Unicode slug)', () => {
    expect(slug('日本語 テスト', { transliterate: false })).toBe('日本語-テスト');
    expect(slug('Crème Brûlée', { transliterate: false })).toBe('crème-brûlée');
    expect(slug('Привет мир', { transliterate: false })).toBe('привет-мир');
    expect(slug('مرحبا بالعالم', { transliterate: false })).toBe('مرحبا-بالعالم');
  });
  it('transliterate() reports dropped letters and leaves symbols', () => {
    expect(transliterate('a日b')).toEqual({ text: 'a b', dropped: ['日'] });
    expect(transliterate('x & y').text).toBe('x & y');
  });
});

describe('stop words', () => {
  it('removes them on request but never empties the slug', () => {
    expect(slug('The Best of the Web and Beyond', { removeStopWords: true })).toBe('best-web-beyond');
    expect(slug('The Best of the Web', { removeStopWords: false })).toBe('the-best-of-the-web');
    expect(slug('To be or not to be', { removeStopWords: true })).toBe('not');
    expect(slug('the of and', { removeStopWords: true })).toBe('the-of-and');
    expect(SLUG_STOP_WORDS.has('the')).toBe(true);
  });
});

describe('maximum length', () => {
  it('cuts at a word boundary', () => {
    expect(slug('the quick brown fox jumps', { maxLength: 15 })).toBe('the-quick-brown');
    expect(slug('the quick brown fox jumps', { maxLength: 16 })).toBe('the-quick-brown');
    expect(slug('the quick brown fox jumps', { maxLength: 9 })).toBe('the-quick');
    expect(slug('the quick brown fox jumps', { maxLength: 100 })).toBe('the-quick-brown-fox-jumps');
  });
  it('cuts a single long word hard, never leaves a trailing separator', () => {
    expect(slug('supercalifragilistic', { maxLength: 5 })).toBe('super');
    expect(slug('ab cdefghij', { maxLength: 3 })).toBe('ab');
    expect(joinWithLimit(['a', 'b'], '-', 0)).toBe('a-b');
    expect(joinWithLimit([], '-', 5)).toBe('');
  });
  it('counts characters, not UTF-16 units, for a hard cut of a Unicode word', () => {
    expect(slug('😀😀😀', { transliterate: false, maxLength: 2 })).toBe('');
    expect(slug('日本語テスト', { transliterate: false, maxLength: 3 })).toBe('日本語');
  });
});

describe('batches', () => {
  const lines = (...l: string[]) => l.join('\n');
  it('one slug per line, blank lines stay blank, CRLF works', () => {
    expect(slugifyLines('Hello World\r\n\r\nSecond Line').slugs).toEqual(['hello-world', '', 'second-line']);
    expect(slugifyLines('').slugs).toEqual(['']);
  });
  it('adds numeric suffixes to duplicates', () => {
    const r = slugifyLines(lines('Same', 'same', 'SAME!', 'other'));
    expect(r.slugs).toEqual(['same', 'same-2', 'same-3', 'other']);
    expect(r.suffixed).toBe(2);
  });
  it('can be switched off', () => {
    expect(slugifyLines(lines('a', 'a'), { uniqueSuffix: false }).slugs).toEqual(['a', 'a']);
  });
  it('suffixes do not collide with real slugs and respect the separator and maximum length', () => {
    const r = slugifyLines(lines('a', 'a', 'a 2', 'a')).slugs;
    expect(r).toEqual(['a', 'a-2', 'a-2-2', 'a-3']);
    expect(new Set(r).size).toBe(4);
    expect(slugifyLines(lines('x', 'x'), { separator: '_' }).slugs).toEqual(['x', 'x_2']);
    expect(slugifyLines(lines('x', 'x'), { separator: '' }).slugs).toEqual(['x', 'x2']);
    const limited = slugifyLines(lines('abcdef ghi', 'abcdef ghi', 'abcdef ghi'), { maxLength: 8 }).slugs;
    expect(limited).toEqual(['abcdef', 'abcdef-2', 'abcdef-3']);
    for (const s of limited) expect(s.length).toBeLessThanOrEqual(8);
  });
  it('collects dropped letters across lines', () => {
    expect(slugifyLines(lines('日本', 'x 中')).dropped.sort()).toEqual(['中', '日', '本'].sort());
  });
  it('handles 100,000 lines fast, with unique suffixes for repeats', () => {
    const input = Array.from({ length: 100_000 }, (_, i) => (i % 2 ? 'Same Title' : `Title Número ${i}`)).join('\n');
    const t0 = performance.now();
    const r = slugifyLines(input);
    expect(performance.now() - t0).toBeLessThan(6000);
    expect(new Set(r.slugs).size).toBe(100_000);
    expect(r.slugs[1]).toBe('same-title');
    expect(r.slugs[3]).toBe('same-title-2');
  });
});

describe('defaults', () => {
  it('are the SEO-friendly choices', () => {
    expect(DEFAULT_SLUG_OPTIONS).toMatchObject({ separator: '-', lowercase: true, transliterate: true });
  });
});
