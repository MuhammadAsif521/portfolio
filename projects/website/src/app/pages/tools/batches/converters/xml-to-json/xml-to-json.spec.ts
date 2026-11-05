import { describe, expect, it } from 'vitest';
import { convertJsonToXml, DEFAULT_JSON_TO_XML } from '../json-to-xml/json-to-xml.logic';
import { convertXmlToJson, decodeCharRefs, DEFAULT_XML_TO_JSON, inferXmlScalar, neutralizeDoctype, type XmlToJsonOptions } from './xml-to-json.logic';

const run = (xml: string, over: Partial<XmlToJsonOptions> = {}) => convertXmlToJson(xml, { ...DEFAULT_XML_TO_JSON, indent: 'minify', ...over });

async function json(xml: string, over: Partial<XmlToJsonOptions> = {}): Promise<unknown> {
  const r = await run(xml, over);
  if (!r.ok) throw new Error(r.error.message + (r.error.line ? ` @${r.error.line}:${r.error.column}` : ''));
  return JSON.parse(r.output);
}

const CATALOG = `<?xml version="1.0" encoding="UTF-8"?>
<catalog id="c1">
  <book id="b1" lang="en"><title>XML &amp; You</title><price>10.50</price></book>
  <book id="b2"><title>Second</title><price>8</price></book>
  <note/>
</catalog>`;

describe('xml to json', () => {
  it('converts elements, attributes and repeated tags', async () => {
    expect(await json(CATALOG)).toEqual({
      catalog: {
        '@id': 'c1',
        book: [
          { '@id': 'b1', '@lang': 'en', title: 'XML & You', price: 10.5 },
          { '@id': 'b2', title: 'Second', price: 8 },
        ],
        note: '',
      },
    });
  });

  it('supports other attribute modes and prefixes', async () => {
    const xml = '<a x="1"><b y="2">t</b></a>';
    expect(await json(xml, { attributePrefix: '_' })).toEqual({ a: { _x: 1, b: { _y: 2, '#text': 't' } } });
    expect(await json(xml, { attributes: 'group' })).toEqual({ a: { '@attributes': { x: 1 }, b: { '@attributes': { y: 2 }, '#text': 't' } } });
    expect(await json(xml, { attributes: 'ignore' })).toEqual({ a: { b: 't' } });
  });

  it('names the text node as asked and refuses empty names', async () => {
    expect(await json('<a x="1">t</a>', { textNodeName: '$' })).toEqual({ a: { '@x': 1, $: 't' } });
    expect((await run('<a/>', { textNodeName: '' })).ok).toBe(false);
    expect((await run('<a/>', { attributePrefix: '' })).ok).toBe(false);
  });

  it('can force arrays for all children or for named tags', async () => {
    expect(await json('<r><i>1</i></r>', { arrays: 'always' })).toEqual({ r: { i: [1] } });
    expect(await json('<r><i>1</i><o>x</o></r>', { arrayNames: 'i' })).toEqual({ r: { i: [1], o: 'x' } });
  });

  it('keeps types honest: ids with leading zeros and long numbers stay text', async () => {
    expect(await json('<r><zip>00123</zip><big>12345678901234567890</big><n>-1.5e3</n><t>true</t><f>false</f></r>')).toEqual({
      r: { zip: '00123', big: '12345678901234567890', n: -1500, t: true, f: false },
    });
    expect(inferXmlScalar('1.')).toBe('1.');
    expect(await json('<r><n>5</n></r>', { inferTypes: false })).toEqual({ r: { n: '5' } });
  });

  it('merges CDATA into text, or keeps it separate', async () => {
    expect(await json('<r><![CDATA[<b>1 < 2</b>]]></r>')).toEqual({ r: '<b>1 < 2</b>' });
    expect(await json('<r><![CDATA[<b>]]></r>', { cdata: 'separate' })).toEqual({ r: { '#cdata': '<b>' } });
  });

  it('keeps comments only when asked', async () => {
    expect(await json('<r><!-- note --><a>1</a></r>')).toEqual({ r: { a: 1 } });
    expect(await json('<r><!-- note --><a>1</a></r>', { comments: true })).toEqual({ r: { '#comment': ' note ', a: 1 } });
  });

  it('decodes the built-in entities and numeric character references', async () => {
    expect(await json('<r>&lt;&gt;&amp;&quot;&apos; &#65;&#x42;&#128512;</r>', { inferTypes: false })).toEqual({ r: `<>&"' AB😀` });
    expect(decodeCharRefs('&#0;&#xD800;&#65;')).toBe('&#0;&#xD800;A');
  });

  it('strips namespace prefixes on request', async () => {
    const xml = '<s:Envelope xmlns:s="http://x"><s:Body>hi</s:Body></s:Envelope>';
    expect(await json(xml)).toHaveProperty(['s:Envelope', 's:Body'], 'hi');
    expect(await json(xml, { removeNamespaces: true })).toEqual({ Envelope: { Body: 'hi' } });
  });

  it('includes the declaration only when asked', async () => {
    expect(await json(CATALOG, { declaration: true })).toHaveProperty(['?xml', '@version'], 1);
  });

  it('unwraps the root, and turns empty elements into null', async () => {
    expect(await json('<root><a>1</a></root>', { unwrapRoot: true })).toEqual({ a: 1 });
    expect(await json('<r><e/><f x="1"/></r>', { emptyAsNull: true })).toEqual({ r: { e: null, f: { '@x': 1 } } });
  });

  it('preserves the order of mixed content when asked', async () => {
    const out = (await json('<p>Hello <b>big</b> world</p>', { preserveOrder: true })) as Record<string, unknown>[];
    expect(JSON.stringify(out)).toBe('[{"p":[{"#text":"Hello"},{"b":[{"#text":"big"}]},{"#text":"world"}]}]');
  });

  it('reports malformed XML with line and column', async () => {
    const r = await run('<r>\n  <a>1</b>\n</r>');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).toContain('Invalid XML');
      expect(r.error.message).toContain("closing tag 'b'");
      expect(r.error.line).toBe(2);
      expect(r.error.snippet).toContain('^');
    }
    const unclosed = await run('<r><a>1</a>');
    expect(unclosed.ok).toBe(false);
    const attr = await run('<r a="1" a="2"/>');
    expect(!attr.ok && attr.error.message).toContain('repeated');
    expect((await run('plain text')).ok).toBe(false);
    expect((await run('   ')).ok).toBe(false);
  });

  it('IGNORES a billion-laughs DOCTYPE and never expands entities', async () => {
    const bomb =
      '<?xml version="1.0"?>\n<!DOCTYPE lolz [\n<!ENTITY lol "lol">\n<!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">\n<!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">\n<!ENTITY lol4 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;">\n<!ENTITY lol5 "&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;">\n]>\n<lolz>&lol5;</lolz>';
    const started = Date.now();
    const r = await run(bomb);
    expect(Date.now() - started).toBeLessThan(1500);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.length).toBeLessThan(200);
      expect(r.output).toContain('&lol5;');
      expect(r.warnings.join(' ')).toContain('5 entity declarations');
    }
  });

  it('never loads external entities (XXE) and keeps error lines accurate after a DOCTYPE', async () => {
    const xxe = '<?xml version="1.0"?>\n<!DOCTYPE foo [\n  <!ENTITY xxe SYSTEM "file:///etc/passwd">\n]>\n<foo>&xxe;</foo>';
    const r = await run(xxe);
    expect(r.ok && r.output).toBe('{"foo":"&xxe;"}');
    expect(r.ok && r.warnings.join(' ')).toContain('external references are never loaded');
    const broken = await run(xxe.replace('</foo>', '</bar>'));
    expect(!broken.ok && broken.error.line).toBe(5);
    expect(neutralizeDoctype('<a/>').removed).toBe(false);
  });

  it('handles a quadratic entity blow-up and a pile of plain entities without trouble', async () => {
    const big = '<r>' + '&amp;'.repeat(50_000) + '</r>';
    const r = await run(big, { inferTypes: false });
    expect(r.ok && (JSON.parse(r.output) as { r: string }).r.length).toBe(50_000);
  });

  it('refuses elements named __proto__ and absurd nesting', async () => {
    const proto = await run('<r><__proto__>1</__proto__></r>');
    expect(proto.ok).toBe(false);
    const deep = await run('<a>'.repeat(300) + '</a>'.repeat(300));
    expect(deep.ok).toBe(false);
  });

  it('keeps unicode, emoji and CRLF, and strips a BOM', async () => {
    expect(await json('﻿<r>\r\n  <n>José 😀 世界</n>\r\n</r>')).toEqual({ r: { n: 'José 😀 世界' } });
  });

  it('round-trips JSON through XML and back where XML can express it', async () => {
    const original = {
      library: {
        '@name': 'Main',
        book: [
          { '@id': 'b1', title: 'A & B <C>', year: 2020, tags: { tag: ['x', 'y'] } },
          { '@id': 'b2', title: 'José 😀', year: 1999, tags: { tag: 'z' } },
        ],
        open: true,
      },
    };
    const xml = await convertJsonToXml(JSON.stringify(original), DEFAULT_JSON_TO_XML);
    if (!xml.ok) throw new Error(xml.error.message);
    expect(await json(xml.output)).toEqual(original);
  });
});
