import { describe, expect, it } from 'vitest';
import {
  CASE_META,
  DEFAULT_CASE_OPTIONS,
  allVariants,
  capitalizeWord,
  convertCase,
  splitWords,
  toAlternating,
  toInverted,
  toSentenceCase,
  toTitleCase,
  type CaseOptions,
} from './case-converter.logic';

const TR: CaseOptions = { ...DEFAULT_CASE_OPTIONS, locale: 'tr' };
const AP: CaseOptions = { ...DEFAULT_CASE_OPTIONS, titleStyle: 'ap-apa' };

describe('splitWords', () => {
  it.each([
    ['fooBar', ['foo', 'Bar']],
    ['foo_bar', ['foo', 'bar']],
    ['FOO-BAR', ['FOO', 'BAR']],
    ['HTTPServer2', ['HTTP', 'Server2']],
    ['parseHTTPResponse', ['parse', 'HTTP', 'Response']],
    ['XMLHttpRequest', ['XML', 'Http', 'Request']],
    ['foo.bar baz', ['foo', 'bar', 'baz']],
    ['  leading and trailing  ', ['leading', 'and', 'trailing']],
    ['v2Beta', ['v2', 'Beta']],
    ['mp3 player', ['mp3', 'player']],
    ["don't stop", ['dont', 'stop']],
    ['ünÄhnlichKeit', ['ün', 'Ähnlich', 'Keit']],
    ['привет_мир', ['привет', 'мир']],
    ['', []],
    ['___', []],
  ])('%s', (input, expected) => {
    expect(splitWords(input)).toEqual(expected);
  });
});

describe('identifier styles', () => {
  it('converts every kind of identifier input the same way', () => {
    for (const input of ['fooBar', 'foo_bar', 'FOO-BAR', 'Foo Bar', 'foo.bar', 'FooBar']) {
      expect(convertCase(input, 'camel'), input).toBe('fooBar');
      expect(convertCase(input, 'pascal'), input).toBe('FooBar');
      expect(convertCase(input, 'snake'), input).toBe('foo_bar');
      expect(convertCase(input, 'kebab'), input).toBe('foo-bar');
      expect(convertCase(input, 'constant'), input).toBe('FOO_BAR');
      expect(convertCase(input, 'dot'), input).toBe('foo.bar');
    }
  });
  it('HTTPServer2 splits at the acronym', () => {
    expect(convertCase('HTTPServer2', 'snake')).toBe('http_server2');
    expect(convertCase('HTTPServer2', 'camel')).toBe('httpServer2');
    expect(convertCase('HTTPServer2', 'pascal')).toBe('HttpServer2');
  });
  it('each line becomes its own identifier and the line breaks survive', () => {
    expect(convertCase('first name\r\nlast Name\n\nuser_id', 'snake')).toBe('first_name\r\nlast_name\n\nuser_id');
    expect(convertCase('a b\rc d', 'camel')).toBe('aB\rcD');
  });
  it('keeps accents and non-Latin letters', () => {
    expect(convertCase('crème brûlée', 'pascal')).toBe('CrèmeBrûlée');
    expect(convertCase('Привет Мир', 'snake')).toBe('привет_мир');
    expect(convertCase('straße am meer', 'constant')).toBe('STRASSE_AM_MEER');
  });
  it('empty and symbol-only input', () => {
    expect(convertCase('', 'camel')).toBe('');
    expect(convertCase('!!! ???', 'snake')).toBe('');
  });
});

describe('upper and lower', () => {
  it('handles accents, ß, Greek final sigma and Cyrillic', () => {
    expect(convertCase('straße', 'upper')).toBe('STRASSE');
    expect(convertCase('ÉCOLE Ñandú', 'lower')).toBe('école ñandú');
    expect(convertCase('ΟΔΟΣ', 'lower')).toBe('οδος');
    expect(convertCase('Привет', 'upper')).toBe('ПРИВЕТ');
  });
  it('Turkish dotted and dotless i', () => {
    expect(convertCase('istanbul', 'upper', TR)).toBe('İSTANBUL');
    expect(convertCase('ISPARTA', 'lower', TR)).toBe('ısparta');
    expect(convertCase('istanbul', 'upper')).toBe('ISTANBUL');
  });
  it('keeps emoji, CJK, RTL and line breaks untouched', () => {
    expect(convertCase('hi 👋 日本\r\nمرحبا', 'upper')).toBe('HI 👋 日本\r\nمرحبا');
  });
});

describe('title case', () => {
  it('Chicago: lowercases articles, conjunctions and all prepositions; first and last word capitalised', () => {
    expect(toTitleCase('the quick brown fox jumps over the lazy dog')).toBe('The Quick Brown Fox Jumps over the Lazy Dog');
    expect(toTitleCase('a tale of two cities')).toBe('A Tale of Two Cities');
    expect(toTitleCase('what are you waiting for')).toBe('What Are You Waiting For');
    expect(toTitleCase('learning to code with angular')).toBe('Learning to Code with Angular');
  });
  it('AP / APA: lowercases words of three letters or fewer, capitalises four and up', () => {
    expect(toTitleCase('the quick brown fox jumps over the lazy dog', AP)).toBe('The Quick Brown Fox Jumps Over the Lazy Dog');
    expect(toTitleCase('learning to code with angular', AP)).toBe('Learning to Code With Angular');
  });
  it('capitalises the word after a colon or dash', () => {
    expect(toTitleCase('node.js: a guide to the basics')).toBe('node.js: A Guide to the Basics'); // domain-like token kept as typed
    expect(toTitleCase('mongodb: the definitive guide')).toBe('Mongodb: The Definitive Guide');
    expect(toTitleCase('rise and fall - a history of the web')).toBe('Rise and Fall - A History of the Web');
  });
  it('hyphenated words', () => {
    expect(toTitleCase('a well-known state-of-the-art tool')).toBe('A Well-Known State-of-the-Art Tool');
    expect(toTitleCase('mother-in-law')).toBe('Mother-in-Law');
  });
  it('keeps acronyms and camel-case brands, fixes lower and Capitalised words', () => {
    expect(toTitleCase('NASA and the iPhone in JavaScript land')).toBe('NASA and the iPhone in JavaScript Land');
    expect(toTitleCase('The Lord Of The Rings')).toBe('The Lord of the Rings');
  });
  it('ALL CAPS input is normalised first; a single shouted word is kept', () => {
    expect(toTitleCase('THE QUICK BROWN FOX')).toBe('The Quick Brown Fox');
    expect(toTitleCase('NASA')).toBe('NASA');
  });
  it('apostrophes do not capitalise the next letter, "I" stays "I"', () => {
    expect(toTitleCase("don't stop believing and i won't")).toBe("Don't Stop Believing and I Won't");
    expect(toTitleCase('it’s a trap')).toBe('It’s a Trap');
  });
  it('leaves URLs and emails alone', () => {
    expect(toTitleCase('visit https://Example.com/Path or mail me@Example.com today')).toBe(
      'Visit https://Example.com/Path or Mail me@Example.com Today',
    );
  });
  it('each line is its own title, line breaks preserved', () => {
    expect(toTitleCase('a day in the life\r\nthe end of the road')).toBe('A Day in the Life\r\nThe End of the Road');
  });
  it('accents and Cyrillic', () => {
    expect(toTitleCase('éloge de la paresse')).toBe('Éloge De La Paresse');
    expect(toTitleCase('война и мир')).toBe('Война И Мир');
  });
  it('empty input', () => {
    expect(toTitleCase('')).toBe('');
    expect(toTitleCase('   ')).toBe('   ');
  });
});

describe('sentence case', () => {
  it('capitalises the first letter of each sentence and lowercases the rest', () => {
    expect(toSentenceCase('HELLO WORLD. THIS IS A TEST! REALLY? YES')).toBe('Hello world. This is a test! Really? Yes');
    expect(toSentenceCase('Hello World. this Is a Test! really? yes')).toBe('Hello world. This is a test! Really? Yes');
  });
  it('capitalises after a line break too, keeps CRLF', () => {
    expect(toSentenceCase('first line\r\nsecond line')).toBe('First line\r\nSecond line');
  });
  it('does not break at decimals, domains or known abbreviations', () => {
    expect(toSentenceCase('pi is 3.14 and the site is example.com. next one')).toBe('Pi is 3.14 and the site is example.com. Next one');
    expect(toSentenceCase('ask Dr. smith about e.g. this. ok')).toBe('Ask dr. smith about e.g. this. Ok');
  });
  it('capitalises I and its contractions', () => {
    expect(toSentenceCase("i think i'm right and i'll prove it")).toBe("I think I'm right and I'll prove it");
  });
  it('keeps acronyms in mixed text but not when everything is in capitals', () => {
    expect(toSentenceCase('use the NASA api in JavaScript')).toBe('Use the NASA api in JavaScript');
    expect(toSentenceCase('USE THE NASA API')).toBe('Use the nasa api');
  });
  it('skips leading quotes and digits before the first letter', () => {
    expect(toSentenceCase('"quoted start". 2nd item')).toBe('"Quoted start". 2nd item');
  });
  it('Turkish locale', () => {
    expect(toSentenceCase('ISPARTA ILI', TR)).toBe('Isparta ılı');
  });
  it('empty input', () => {
    expect(toSentenceCase('')).toBe('');
  });
});

describe('capitalize each word', () => {
  it('capitalises every word, including small ones, lower-casing the rest', () => {
    expect(convertCase('the QUICK brown-fox of don’t', 'capitalize')).toBe('The Quick Brown-Fox Of Don’t');
  });
  it('capitalizeWord is code point safe', () => {
    expect(capitalizeWord('élan')).toBe('Élan');
    expect(capitalizeWord('𐐨x')).toBe('𐐀x'); // Deseret letters live outside the BMP
    expect(capitalizeWord('')).toBe('');
  });
});

describe('alternating and inverted', () => {
  it('alternates only across letters that have a case', () => {
    expect(toAlternating('hello world')).toBe('hElLo WoRlD');
    expect(toAlternating('a1b2c3')).toBe('a1B2c3');
    expect(toAlternating('日本 ab')).toBe('日本 aB');
  });
  it('inverts case, keeps accents and symbols', () => {
    expect(toInverted('Hello World 123')).toBe('hELLO wORLD 123');
    expect(toInverted('École Ñ 👋')).toBe('éCOLE ñ 👋');
    expect(toInverted(toInverted('MiXeD CaSe Привет'))).toBe('MiXeD CaSe Привет');
  });
});

describe('allVariants', () => {
  it('returns every variant in the declared order', () => {
    const v = allVariants('hello world');
    expect(v.map((x) => x.id)).toEqual(CASE_META.map((m) => m.id));
    expect(v.find((x) => x.id === 'title')?.value).toBe('Hello World');
    expect(v.find((x) => x.id === 'dot')?.value).toBe('hello.world');
  });
});

describe('large input', () => {
  it('converts ~1 MB in every style without choking', () => {
    const text = 'the quick brown fox jumps over the lazy dog, straße ÉCOLE 👋\n'.repeat(16_000);
    const t0 = performance.now();
    for (const m of CASE_META) {
      const out = convertCase(text, m.id);
      expect(out.length).toBeGreaterThan(m.group === 'text' ? text.length - 5 : 1000);
    }
    expect(performance.now() - t0).toBeLessThan(20_000);
  });
});
