import { describe, expect, it } from 'vitest';
import { convertXmlToJson, DEFAULT_XML_TO_JSON } from '../xml-to-json/xml-to-json.logic';
import { convertJsonToXml, DEFAULT_JSON_TO_XML, sanitizeXmlName, type JsonToXmlOptions } from './json-to-xml.logic';

const run = (json: string, over: Partial<JsonToXmlOptions> = {}) => convertJsonToXml(json, { ...DEFAULT_JSON_TO_XML, declaration: false, indent: 'minify', ...over });

async function xml(json: string, over: Partial<JsonToXmlOptions> = {}): Promise<string> {
  const r = await run(json, over);
  if (!r.ok) throw new Error(r.error.message);
  return r.output;
}

describe('json to xml', () => {
  it('uses a single top-level key as the root, otherwise "root"', async () => {
    expect(await xml('{"catalog":{"a":1}}')).toBe('<catalog><a>1</a></catalog>');
    expect(await xml('{"a":1,"b":2}')).toBe('<root><a>1</a><b>2</b></root>');
    expect(await xml('{"a":1,"b":2}', { rootName: 'data' })).toBe('<data><a>1</a><b>2</b></data>');
  });

  it('writes attributes from the prefix and text from the text key', async () => {
    expect(await xml('{"a":{"@id":"1","@n":2,"#text":"hi"}}')).toBe('<a id="1" n="2">hi</a>');
    expect(await xml('{"a":{"_id":"1"}}', { attributePrefix: '_' })).toBe('<a id="1"/>');
    expect(await xml('{"r":{"@id":"1"}}', { attributePrefix: '' })).toBe('<r><_id>1</_id></r>');
  });

  it('turns arrays into repeated elements, and unkeyed arrays into items', async () => {
    expect(await xml('{"r":{"i":[1,2,3]}}')).toBe('<r><i>1</i><i>2</i><i>3</i></r>');
    expect(await xml('[1,2]')).toBe('<root><item>1</item><item>2</item></root>');
    expect(await xml('{"r":{"m":[[1,2],[3]]}}')).toBe('<r><m><item>1</item><item>2</item></m><m><item>3</item></m></r>');
    expect(await xml('[{"a":1}]', { itemName: 'row', rootName: 'rows' })).toBe('<rows><row><a>1</a></row></rows>');
  });

  it('escapes text and attribute values', async () => {
    expect(await xml('{"r":{"t":"a < b & c > d \\"q\\" \'s\'","@x":"say \\"hi\\" & <go>"}}')).toBe(
      '<r x="say &quot;hi&quot; &amp; &lt;go&gt;"><t>a &lt; b &amp; c &gt; d &quot;q&quot; &apos;s&apos;</t></r>',
    );
  });

  it('writes line breaks in attributes as character references', async () => {
    expect(await xml('{"r":{"@x":"a\\nb\\tc"}}')).toBe('<r x="a&#10;b&#9;c"/>');
  });

  it('renames invalid names and says so', async () => {
    const r = await run('{"r":{"first name":1,"1st":2,"a/b":3,"ok":4,"é-ü":5}}');
    expect(r.ok && r.output).toBe('<r><first_name>1</first_name><_1st>2</_1st><a_b>3</a_b><ok>4</ok><é-ü>5</é-ü></r>');
    expect(r.ok && r.warnings.join(' ')).toContain('"first name" to first_name');
    expect(sanitizeXmlName('')).toBe('_');
    expect(sanitizeXmlName('9')).toBe('_9');
    expect(sanitizeXmlName('__proto__')).toBe('_proto_');
  });

  it('keeps two keys that sanitise to the same name apart', async () => {
    expect(await xml('{"r":{"a b":1,"a_b":2}}')).toBe('<r><a_b>1</a_b><a_b_2>2</a_b_2></r>');
  });

  it('rejects an invalid explicit root name', async () => {
    const r = await run('{"a":1}', { rootName: 'bad name' });
    expect(!r.ok && r.error.message).toContain('not a valid XML element name');
  });

  it('writes null as an empty element, or leaves it out', async () => {
    expect(await xml('{"r":{"a":null,"b":"x"}}')).toBe('<r><a/><b>x</b></r>');
    expect(await xml('{"r":{"a":null,"b":"x"}}', { emptyElements: 'pair' })).toBe('<r><a></a><b>x</b></r>');
    const omitted = await run('{"r":{"a":null,"b":"x"}}', { nullAs: 'omit' });
    expect(omitted.ok && omitted.output).toBe('<r><b>x</b></r>');
    expect(omitted.ok && omitted.warnings.join(' ')).toContain('null');
  });

  it('writes numbers, booleans and big integers exactly', async () => {
    expect(await xml('{"r":{"n":1.5,"t":true,"big":12345678901234567890}}')).toBe('<r><n>1.5</n><t>true</t><big>12345678901234567890</big></r>');
  });

  it('adds a declaration and indentation', async () => {
    const r = await convertJsonToXml('{"r":{"a":1}}', DEFAULT_JSON_TO_XML);
    expect(r.ok && r.output).toBe('<?xml version="1.0" encoding="UTF-8"?>\n<r>\n  <a>1</a>\n</r>\n');
    const tab = await convertJsonToXml('{"r":{"a":1}}', { ...DEFAULT_JSON_TO_XML, indent: 'tab', declaration: false });
    expect(tab.ok && tab.output).toBe('<r>\n\t<a>1</a>\n</r>\n');
  });

  it('removes characters XML cannot hold, and reports them', async () => {
    const r = await run('{"r":{"t":"a\\u0001b\\ud800c"}}');
    expect(r.ok && r.output).toBe('<r><t>abc</t></r>');
    expect(r.ok && r.warnings.join(' ')).toContain('2 characters');
  });

  it('keeps unicode and emoji', async () => {
    expect(await xml('{"r":{"t":"José 😀 世界"}}')).toBe('<r><t>José 😀 世界</t></r>');
  });

  it('produces XML that the XML parser accepts (round trip, with markup-looking text)', async () => {
    const original = { doc: { '@v': 1, title: '<script>alert(1)</script>', items: { item: [{ '#text': 'one', '@n': 1 }, { '#text': 'two', '@n': 2 }] } } };
    const out = await xml(JSON.stringify(original), { indent: '2' });
    const back = await convertXmlToJson(out, { ...DEFAULT_XML_TO_JSON, indent: 'minify', inferTypes: true });
    expect(back.ok && JSON.parse(back.output)).toEqual(original);
  });

  it('reports invalid JSON with line and column', async () => {
    const r = await run('{\n"a": 1,\n}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.line).toBe(3);
  });

  it('copes with a hostile __proto__ key', async () => {
    const r = await run('{"r":{"__proto__":{"x":1}}}');
    expect(r.ok && r.output).toBe('<r><_proto_><x>1</x></_proto_></r>');
  });
});
