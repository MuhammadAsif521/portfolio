import type { ToolMeta } from '../tools.manifest.js';

/** converters tools: manifest entries only (copy, SEO, FAQs). Keep the only import the type above: the backend keeps a verbatim copy. */
export const CONVERTER_TOOLS: ToolMeta[] = [
  {
    slug: 'json-to-csv',
    name: 'JSON to CSV',
    h1: 'JSON to CSV Converter: Flatten, Export and Open in Excel',
    title: 'JSON to CSV Converter: Flatten Nested JSON | Asif Dev',
    description:
      'Convert a JSON array, API response or nested object to CSV. Flatten keys, pick delimiters, add an Excel BOM and guard formulas. Runs in your browser.',
    keyword: 'json to csv',
    category: 'converters',
    related: ['csv-to-json', 'csv-viewer', 'json-formatter', 'excel-to-json'],
    example: {
      input: '[{"id":1,"name":"Asif","address":{"city":"Lahore"},"tags":["node","angular"]},{"id":2,"name":"Sara","address":{"city":"Leeds"},"tags":[]}]',
      output: 'id,name,address.city,tags\n1,Asif,Lahore,"[""node"",""angular""]"\n2,Sara,Leeds,[]',
    },
    sections: [
      {
        heading: 'How to convert JSON to CSV',
        paragraphs: [
          'Paste JSON into the input box, drop a .json file on it, or load the sample. The CSV appears next to it as you type, and you can copy it or download a .csv file. A top-level array of objects is the usual case: each object becomes a row and every key becomes a column. The tool also accepts an array of arrays, an array of plain values, a single object, and an API envelope such as {"page":1,"data":[...]}, where it finds the largest array of objects on its own. If the rows sit somewhere else, type a path like data.users in the path box.',
          'Objects in an array rarely have identical keys, so the columns are the union of all keys, in the order they first appear or alphabetically if you prefer. A row that lacks a key gets an empty cell. A null value becomes an empty cell or the word null, as you choose. Numbers and booleans are written as they are, and strings that contain the delimiter, a quote or a line break are quoted correctly, with quotes inside doubled, as RFC 4180 describes.',
        ],
      },
      {
        heading: 'Nested objects, arrays and dates',
        paragraphs: [
          'CSV is flat, JSON is not, so something has to give. By default nested objects are flattened into dot paths: {"address":{"city":"Lahore"}} becomes a column named address.city. If you would rather keep the structure, choose to leave nested objects as a JSON string in one cell. Arrays have three modes: a JSON string in one cell, a joined list such as node; angular, or one column per item (tags.0, tags.1). The per-item mode can create many columns, so the tool stops at 10,000 columns and tells you to pick another mode.',
          'JSON has no date type, so dates arrive as text, usually ISO 8601. Excel tends to show 2024-03-05T14:30:00Z as plain text. The Excel-friendly option rewrites full ISO timestamps as 2024-03-05 14:30:00 in UTC, which Excel recognises as a date. Date-only strings such as 2024-03-05 are left alone. Integers larger than 2^53 are kept digit for digit instead of being rounded by the JSON parser, in browsers that expose the original number text.',
        ],
      },
      {
        heading: 'Excel, encoding and CSV injection',
        paragraphs: [
          'Excel assumes your computer\'s legacy code page unless a file starts with a UTF-8 byte order mark. If accents or emoji look garbled after you open a downloaded CSV, switch on the BOM option. The BOM is added to the downloaded file only, not to the text you copy. Semicolon-delimited output is what Excel expects in many European locales, and CRLF line endings match RFC 4180.',
          'A CSV cell that begins with =, +, - or @ can be run as a formula when the file is opened in Excel or Google Sheets. That is called CSV injection or formula injection, and it matters whenever JSON from users or an external API ends up in a spreadsheet someone else opens. The guard option prefixes such cells with a single quote so they are shown as text. Plain numbers such as -5 are left untouched. The guard reduces the risk but cannot promise that every spreadsheet program treats every cell as text, so keep untrusted exports out of automated imports.',
          'Everything runs in your browser. Inputs above about one megabyte are converted in a background worker so the page stays responsive, and very large inputs are limited by your browser\'s memory, with a 50 MB cap on files.',
        ],
      },
    ],
    faq: [
      {
        q: 'How do I convert nested JSON to CSV?',
        a: 'Leave "Nested objects" on flatten. Each nested key becomes a dotted column such as address.city. Choose how arrays are written: a JSON string, a joined list or one column per item.',
      },
      {
        q: 'Why do the columns differ between rows?',
        a: 'JSON objects in an array can have different keys. The CSV uses the union of all keys as columns and leaves the cell empty where a row has no value for that key.',
      },
      {
        q: 'Why does Excel show garbled characters?',
        a: 'Excel guesses a legacy encoding unless the file begins with a UTF-8 byte order mark. Turn on "BOM for Excel" and download the file instead of copying the text.',
      },
      {
        q: 'What does the CSV injection guard do?',
        a: 'It puts a single quote in front of any text cell that starts with =, +, - or @, so spreadsheets show it as text rather than evaluating it as a formula. Numbers like -5 are not changed.',
      },
      {
        q: 'Is my JSON uploaded anywhere?',
        a: 'No. The conversion runs in your browser, in a background worker for large inputs. Nothing is sent to a server.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'csv-to-json',
    name: 'CSV to JSON',
    h1: 'CSV to JSON Converter for CSV and TSV Files of Any Size',
    title: 'CSV to JSON Converter: CSV and TSV Online | Asif Dev',
    description:
      'Convert CSV or TSV to JSON with delimiter detection, header control and safe type detection. Handles quoted cells and large files in your browser.',
    keyword: 'csv to json',
    category: 'converters',
    related: ['json-to-csv', 'json-formatter', 'excel-to-json', 'json-to-typescript'],
    example: {
      input: 'id,name,active,zip\n1,Asif,true,00123\n2,"Lee, Kim",false,54000',
      output: '[\n  { "id": 1, "name": "Asif", "active": true, "zip": "00123" },\n  { "id": 2, "name": "Lee, Kim", "active": false, "zip": 54000 }\n]',
    },
    sections: [
      {
        heading: 'Using the converter',
        paragraphs: [
          'Paste CSV or TSV text, drop a file on the input, or load the sample. The JSON updates as you type. The delimiter is detected from the first lines: the tool counts commas, semicolons, tabs and pipes outside quoted text and picks the one that splits the lines into the same number of fields. If detection guesses wrong on an unusual file, choose the delimiter yourself. You can switch between an array of objects, where the header row supplies the keys, and an array of arrays, which keeps the header as the first row.',
          'Cells in quotes may contain delimiters, doubled quotes and line breaks, including Windows CRLF breaks. A leading byte order mark is removed. Spaces around cells and column names are trimmed by default, blank lines are skipped, and empty cells can become null instead of an empty string. If a column name is duplicated or empty it gets a numeric suffix such as name_2 or column_3, and the tool says so.',
        ],
      },
      {
        heading: 'Type detection that does not corrupt data',
        paragraphs: [
          'With type detection on, true and false become booleans, null becomes null, and numbers become JSON numbers. The rules are deliberately cautious. Anything with a leading zero, such as the zip code 00123 or a phone number, stays a string, because turning it into the number 123 destroys information. A number with more than 15 significant digits, for example a 19-digit id, also stays a string, since JSON parsers in JavaScript would round it. Values such as 1,000 or +44 7700 are text too. Switch detection off to keep every cell a string.',
          'This matters because naive converters turn identifiers into numbers. A product code 1E5 or a long order number can silently change. If you need a specific column to be numeric and the tool left it as text, convert it in your code after parsing, where you know the schema.',
        ],
      },
      {
        heading: 'Errors, warnings and big files',
        paragraphs: [
          'A quote that opens a cell and never closes would swallow the rest of the file, so the tool refuses that input and points to the line and column where the quote opened. A closing quote followed by more text, as in "x"y, is reported with its line and an explanation: inside a quoted cell a literal quote is written as two quotes. Rows with more or fewer cells than the header are still converted, with missing values set to null and extra values kept under an __extra key, and a warning lists the first line numbers affected.',
          'Inputs above about one megabyte are parsed in a background worker, so typing and scrolling stay smooth. Files up to 50 MB can be loaded; a file over one megabyte is not shown in the editor, only its result. Huge JSON output is truncated in the preview but copy and download always use the full text. For files in the gigabyte range use a streaming command-line tool, because a browser tab has to hold the whole text in memory.',
        ],
      },
    ],
    faq: [
      {
        q: 'How does it detect the delimiter?',
        a: 'It counts commas, semicolons, tabs and pipes outside quotes in the first lines and picks the one that gives the same number of fields on most lines. You can override it.',
      },
      {
        q: 'Why is my zip code or id still a string?',
        a: 'Values with leading zeros and numbers with more than 15 digits are kept as strings on purpose, because converting them to JSON numbers would change or round them.',
      },
      {
        q: 'Can it convert TSV or semicolon files?',
        a: 'Yes. Tab, semicolon and pipe delimiters are detected automatically or can be chosen from the Delimiter list.',
      },
      {
        q: 'What happens when a row has the wrong number of cells?',
        a: 'The row is kept: missing values become null and extra values go into an __extra array. A warning names the first affected line numbers.',
      },
      {
        q: 'Is the file uploaded?',
        a: 'No. Parsing happens in your browser, in a background worker for large inputs.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'json-to-yaml',
    name: 'JSON to YAML',
    h1: 'JSON to YAML Converter with Indent and Quoting Control',
    title: 'JSON to YAML Converter: Clean, Valid YAML | Asif Dev',
    description:
      'Convert JSON to YAML with indent, line width, quoting and key sorting options. Safe quoting keeps yes, no and numeric strings as text. In your browser.',
    keyword: 'json to yaml',
    category: 'converters',
    related: ['yaml-to-json', 'json-formatter', 'json-to-xml', 'json-to-typescript'],
    example: {
      input: '{"name":"api","replicas":3,"country":"no","ports":[80,443],"env":{"LOG_LEVEL":"info"}}',
      output: "name: api\nreplicas: 3\ncountry: 'no'\nports:\n  - 80\n  - 443\nenv:\n  LOG_LEVEL: info",
    },
    sections: [
      {
        heading: 'What the converter does',
        paragraphs: [
          'YAML is a superset of JSON in spirit, so every JSON document has a YAML equivalent. Paste JSON, drop a file, or load the sample and the YAML is written as you type using the js-yaml dumper. Objects become mappings, arrays become sequences, and the options only change how the result looks: indent width of 2, 3, 4 or 6 spaces, the column at which long text is folded onto the next line, and whether to sort keys alphabetically at every level.',
          'You can write list items flush with their key, which is the style used in most Kubernetes manifests and Helm charts, or indented underneath it, which is the default elsewhere. A top-level array can optionally be written as several YAML documents separated by ---, one per item, which is handy for turning a list of Kubernetes objects into a multi-document file for kubectl apply.',
        ],
      },
      {
        heading: 'Quoting and the Norway problem',
        paragraphs: [
          'The tricky part of writing YAML is deciding which strings need quotes. Under YAML 1.1 rules, the plain words yes, no, on, off, y and n are booleans, so the two-letter country code NO written without quotes is parsed as false by many tools. Strings that look like numbers (123), dates (2001-01-01), null or an empty value change type the same way. This converter quotes any string that could be misread, so the data you get back is the data you put in.',
          'You choose the quote character used when quotes are needed, single or double, or you can quote every string for maximum predictability. Multi-line strings are written as block scalars with a | and the right chomping indicator, and keys that need quoting, such as n, are quoted as well. Anchors and aliases are never written: JSON has no shared references, so repeated data is simply repeated in full.',
        ],
      },
      {
        heading: 'Limits and tips',
        paragraphs: [
          'JSON integers beyond 2^53 are kept digit for digit as plain YAML integers in browsers that expose the original number text, instead of being rounded. Comments cannot be produced because JSON has none, and key order follows the input unless you sort. Duplicate keys in JSON are collapsed by the JSON parser before conversion, with the last value winning, so check the source if that matters.',
          'If a downstream tool is strict, remember that YAML versions differ. Values written here are safe under both the 1.1 and 1.2 rules because ambiguous strings are quoted. Use the YAML to JSON tool to check the round trip: converting the result back should return your original data. Inputs over about a megabyte are processed in a background worker, and everything stays in your browser.',
        ],
      },
    ],
    faq: [
      {
        q: 'Why did the converter put quotes around "no" or "yes"?',
        a: 'In YAML 1.1 those words are booleans. Quoting keeps them as strings in every parser. The same applies to strings that look like numbers, dates or null.',
      },
      {
        q: 'How do I get the Kubernetes list style?',
        a: 'Turn on "Flush list items" so a dash starts at the same indent as its key, and use 2 spaces of indent.',
      },
      {
        q: 'Can it write several YAML documents?',
        a: 'Yes. With "One document per array item" a top-level JSON array becomes documents separated by ---.',
      },
      {
        q: 'Does it keep large numbers exact?',
        a: 'Integers beyond 2^53 are written with all their digits in browsers that expose the original number text. Other browsers round them in the JSON parser and the tool warns you.',
      },
      {
        q: 'Is the JSON sent to a server?',
        a: 'No. The conversion runs entirely in your browser.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'yaml-to-json',
    name: 'YAML to JSON',
    h1: 'YAML to JSON Converter in Safe Mode, with Anchors and Merge Keys',
    title: 'YAML to JSON Converter: Safe, With Line Errors | Asif Dev',
    description:
      'Convert YAML to JSON in safe mode: anchors, merge keys and multi-document files, exact line errors, unsafe tags rejected. Runs in your browser.',
    keyword: 'yaml to json',
    category: 'converters',
    related: ['json-to-yaml', 'json-formatter', 'xml-to-json', 'json-to-typescript'],
    example: {
      input: 'defaults: &d\n  retries: 3\nprod:\n  <<: *d\n  timeout: 10\n  active: yes',
      output: '{\n  "defaults": { "retries": 3 },\n  "prod": { "retries": 3, "timeout": 10, "active": "yes" }\n}',
    },
    sections: [
      {
        heading: 'Converting YAML to JSON',
        paragraphs: [
          'Paste YAML, drop a .yaml or .yml file, or load the sample, and the JSON appears as you type. Block and flow styles, quoted and plain scalars, literal and folded block text, anchors and aliases, and merge keys are all handled. Merge keys (<<: *base) copy a base mapping into another one, a pattern common in Docker Compose and CI files; you can switch their expansion off to see the raw structure. A file with several documents separated by --- becomes an array of documents, or you can take only the first.',
          'The tool follows the YAML 1.2 core rules by default, so yes, no, on and off stay as text and a date such as 2001-01-01 stays a string, which is what most modern parsers do. If your file was written for a YAML 1.1 tool, tick the 1.1 option to read yes and no as booleans, 0777 as octal, and to support timestamps, !!set and !!binary, which are converted to ISO text, arrays and base64 text.',
        ],
      },
      {
        heading: 'Safe mode only',
        paragraphs: [
          'Some YAML libraries can construct arbitrary objects from tags such as !!js/function or !!python/object/apply, which has led to real remote code execution bugs when untrusted YAML was loaded. This converter only ever uses a plain-data schema. A document containing one of those tags is rejected with an "unknown tag" error and the exact line, never executed or constructed.',
          'Aliases are limited as well. A "billion laughs" YAML file is a few hundred bytes of anchors that reference each other, which is harmless to read but expands to gigabytes when written as JSON. The converter measures the expanded size before writing anything and refuses documents that blow up, and it also refuses circular aliases because JSON cannot represent them. If you do not need aliases at all, turn off "Allow anchors and aliases" to reject any file that uses them.',
        ],
      },
      {
        heading: 'Errors, numbers and limits',
        paragraphs: [
          'Syntax errors report the line and column together with a short excerpt and a caret, for example a tab used for indentation, a duplicated mapping key, an unclosed bracket or an unknown alias. Integers beyond 2^53 are written to JSON with every digit rather than rounded, and the special floats .inf and .nan, which JSON cannot hold, become null with a warning.',
          'JSON has no comments, so YAML comments are dropped, and key order follows the file unless you ask for sorting. Non-string keys such as numbers become strings. Very large files are converted in a background worker, and nothing leaves your browser. For configuration that matters, validate the JSON against your schema afterwards: valid YAML can still have the wrong shape.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is it safe to paste untrusted YAML?',
        a: 'The converter only loads plain data. Tags like !!js/function or !!python/object are rejected, and alias expansion is size-limited, so a hostile file cannot run code or exhaust memory. Still, avoid pasting real secrets into any website.',
      },
      {
        q: 'Why is "yes" a string in the output?',
        a: 'YAML 1.2 treats only true and false as booleans. Tick "YAML 1.1 rules" if your file was written for a parser that reads yes and no as booleans.',
      },
      {
        q: 'How are multiple documents handled?',
        a: 'A file with --- separators becomes a JSON array with one item per document. Choose "First document only" to convert just the first.',
      },
      {
        q: 'What are merge keys?',
        a: 'The <<: *name syntax copies the keys of an anchored mapping into another mapping. The converter expands them, and you can switch that off.',
      },
      {
        q: 'Where do the line numbers in errors come from?',
        a: 'They come from the YAML parser position of the first problem, shown with a short excerpt and a caret under the column.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'xml-to-json',
    name: 'XML to JSON',
    h1: 'XML to JSON Converter with Attribute and Array Control',
    title: 'XML to JSON Converter: Attributes and Arrays | Asif Dev',
    description:
      'Convert XML to JSON with attribute prefixes, array rules, CDATA and namespace handling. DOCTYPE entities are never expanded. Runs in your browser.',
    keyword: 'xml to json',
    category: 'converters',
    related: ['json-to-xml', 'json-formatter', 'yaml-to-json', 'json-to-typescript'],
    example: {
      input: '<book id="b1"><title>XML &amp; You</title><tag>a</tag><tag>b</tag></book>',
      output: '{\n  "book": {\n    "@id": "b1",\n    "title": "XML & You",\n    "tag": ["a", "b"]\n  }\n}',
    },
    sections: [
      {
        heading: 'How the mapping works',
        paragraphs: [
          'XML and JSON model data differently, so any converter makes choices. Here an element becomes a key, nested elements become nested objects, and an element that repeats becomes an array. Attributes are written as keys with a prefix (@ by default, any prefix you type), grouped under one @attributes key, or dropped. When an element has attributes or children and also text, the text goes under a text key named #text unless you rename it.',
          'The single-item problem is the classic trap: one <item> becomes an object while two become an array, which breaks code that loops over the result. Choose "every child is an array", or list tag names such as item, row that must always be arrays. CDATA sections can be merged into the text or kept under a #cdata key, comments are dropped unless you keep them, and XML declarations are left out unless you ask for them.',
        ],
      },
      {
        heading: 'Types, namespaces and mixed content',
        paragraphs: [
          'With type detection on, numbers and the words true and false become JSON values in text and attributes, while values with leading zeros and numbers with more than 15 digits stay text so identifiers survive. Numeric character references such as &#65; are decoded along with the five standard entities.',
          'Namespace prefixes stay in the names (s:Envelope) because they carry meaning; use the strip option when you only want local names. Namespace declarations stay as attributes. Mixed content such as <p>Hello <b>big</b> world</p> cannot be expressed as a plain object without losing the order of text and elements, so use the "preserve order" option, which produces an ordered array of nodes instead.',
        ],
      },
      {
        heading: 'Security, errors and limits',
        paragraphs: [
          'XML can declare custom entities in a DOCTYPE, and a "billion laughs" file uses nested entities to expand a few hundred bytes into gigabytes, while external entities can make a naive parser read local files (XXE). This tool never expands them: the DOCTYPE is blanked out before parsing, with line breaks kept so error line numbers still match, and a warning tells you what was ignored. References to custom entities stay as literal text. Elements named __proto__ are refused, and extremely deep nesting is rejected.',
          'Malformed XML is validated first, so errors carry an exact line and column with an excerpt, for example a closing tag that does not match the opening tag or a repeated attribute. Inputs over about a megabyte are converted in a background worker. The tool reads documents, not schemas: it does not validate against an XSD or DTD, and it is not meant for streaming files of hundreds of megabytes.',
        ],
      },
    ],
    faq: [
      {
        q: 'Why is a single element an object but two become an array?',
        a: 'That is how repeated tags are detected. Choose "every child is an array" or list tag names under "Always arrays" so the shape is stable.',
      },
      {
        q: 'How are attributes represented?',
        a: 'By default as keys with an @ prefix next to the child elements. You can change the prefix, group them under @attributes, or leave them out.',
      },
      {
        q: 'Is it safe against XML entity bombs?',
        a: 'Yes. The DOCTYPE is ignored, so custom and external entities are never expanded. Only the five standard entities and numeric character references are decoded.',
      },
      {
        q: 'What happens to mixed text and elements?',
        a: 'In the default object form the order is lost. Turn on "Preserve order" to get an ordered array of text and element nodes.',
      },
      {
        q: 'Does it validate against an XSD?',
        a: 'No. It checks that the XML is well-formed and reports the line and column of the first error, but it does not validate against a schema.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'json-to-xml',
    name: 'JSON to XML',
    h1: 'JSON to XML Converter: Well-Formed XML from Any JSON',
    title: 'JSON to XML Converter: Valid, Escaped XML | Asif Dev',
    description:
      'Convert JSON to well-formed XML with a root name, attributes, arrays as repeated elements and escaping. Invalid names are renamed with warnings.',
    keyword: 'json to xml',
    category: 'converters',
    related: ['xml-to-json', 'json-formatter', 'json-to-yaml', 'json-to-typescript'],
    example: {
      input: '{"order":{"@id":1001,"customer":"Asif","item":["Pen","Pad"],"note":null}}',
      output: '<?xml version="1.0" encoding="UTF-8"?>\n<order id="1001">\n  <customer>Asif</customer>\n  <item>Pen</item>\n  <item>Pad</item>\n  <note/>\n</order>',
    },
    sections: [
      {
        heading: 'How JSON becomes XML',
        paragraphs: [
          'XML needs exactly one root element, and JSON does not, so the root name is a choice. If you leave it empty and your JSON has a single top-level key, that key becomes the root; otherwise the root is called root. You can type any valid name instead. Objects become elements with child elements, and arrays become repeated elements with the same name, so {"item":["Pen","Pad"]} writes two <item> elements. An array with no key of its own, such as a top-level array, uses the array item name you set, item by default.',
          'Attributes come from keys that start with a prefix, @ by default: {"@id":1001} becomes id="1001". When an element has attributes and text, put the text under the text key, #text by default. Numbers, booleans and big integers are written as text, null becomes an empty element or is left out, and you can choose self-closing tags (<a/>) or open and close pairs. Indent with 2 or 4 spaces, a tab, or minify, and add or drop the XML declaration.',
        ],
      },
      {
        heading: 'Escaping and invalid names',
        paragraphs: [
          'Text and attribute values are escaped, so & < > " and \' are written as entities and a value such as <script> arrives as data, not markup. Line breaks and tabs inside attribute values are written as character references because XML parsers would otherwise normalise them to spaces. Characters that XML 1.0 cannot contain at all, such as most control characters and unpaired emoji halves, are removed, and the tool counts how many.',
          'JSON keys can be anything, but XML names must start with a letter or underscore and contain only letters, digits, hyphens, periods and underscores. A key like first name or 1st is renamed to first_name or _1st, and a warning lists the changes so you can see them. If two keys would end up with the same name, the second gets a numeric suffix so nothing is overwritten. A key named __proto__ is renamed too.',
        ],
      },
      {
        heading: 'Limits and tips',
        paragraphs: [
          'XML has no number or boolean type, no null, and element order matters, so a round trip through XML cannot be perfectly lossless: numbers return as text unless the XML to JSON tool detects them, and a single-item array comes back as a plain value unless you force arrays. Use the paired tool to check what your data looks like after the trip.',
          'This tool writes elements, attributes and text. It does not generate namespaces, CDATA sections, comments or schemas. Large inputs are converted in a background worker, and nothing is uploaded: the work happens in your browser.',
        ],
      },
    ],
    faq: [
      {
        q: 'How do I set attributes?',
        a: 'Name keys with the attribute prefix, @ by default. {"@id":1} becomes id="1" on the element. You can change or disable the prefix.',
      },
      {
        q: 'What happens to JSON keys that are not valid XML names?',
        a: 'They are renamed (spaces and symbols become underscores, a leading digit gets an underscore) and a warning lists every change.',
      },
      {
        q: 'How are arrays written?',
        a: 'Each item becomes an element with the key name, so an array under "item" produces repeated <item> elements. Arrays without a key use the item name you choose.',
      },
      {
        q: 'Is the output escaped?',
        a: 'Yes. Ampersands, angle brackets and quotes are escaped in text and attributes, so values cannot inject markup.',
      },
      {
        q: 'Can null be represented?',
        a: 'XML has no null. A null value becomes an empty element, or is left out of objects if you choose that option.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'markdown-to-html',
    name: 'Markdown to HTML',
    h1: 'Markdown to HTML Converter with a Sanitised Live Preview',
    title: 'Markdown to HTML Converter: GFM and Live Preview | Asif Dev',
    description:
      'Convert Markdown to HTML with GFM tables and task lists, heading ids and a full-page option. Safe sanitised preview plus raw HTML to copy or download.',
    keyword: 'markdown to html',
    category: 'converters',
    related: ['markdown-viewer', 'json-formatter', 'base64-encoder', 'regex-tester'],
    example: {
      input: '# Notes\n\n- [x] Done\n- **Bold** and `code`\n\n| a | b |\n|---|---|\n| 1 | 2 |',
      output: '<h1 id="notes">Notes</h1>\n<ul>\n<li><input checked="" disabled="" type="checkbox"> Done</li>\n<li><strong>Bold</strong> and <code>code</code></li>\n</ul>\n<table>...</table>',
    },
    sections: [
      {
        heading: 'What you get',
        paragraphs: [
          'Type or paste Markdown, drop a .md file, or load the sample. The tool shows two things: a rendered preview and the raw HTML source, which you can copy or download as an .html file. Conversion uses the marked library with GitHub Flavored Markdown switched on by default, which adds tables, task lists, strikethrough and automatic links. Turn GFM off for plain CommonMark-style behaviour, and turn on the line break option if a single newline inside a paragraph should become a <br>.',
          'Heading ids are generated from the heading text (lowercase, hyphenated, unique, with letters of any alphabet kept), so links like #release-notes work, and duplicates become same, same-1 and so on. The full-document option wraps the result in a complete page with a doctype, a charset, a viewport tag, a title taken from your first heading and a short stylesheet, so you can save and open it directly.',
        ],
      },
      {
        heading: 'Preview versus output: read this before publishing',
        paragraphs: [
          'Markdown allows raw HTML, and marked passes it through unchanged. That means a <script> tag, an onerror attribute or a javascript: link in your Markdown ends up in the HTML output exactly as written. The HTML panel shows precisely what marked produced and the download is that text, nothing removed. The preview is different: it is cleaned with DOMPurify using a strict allow-list that removes scripts, event handlers, forms, styles, iframes and data attributes, allows only http, https, mailto, tel and in-page links, and never loads remote images, replacing them with their alt text so the preview makes no network requests.',
          'When the Markdown contains active content the tool warns you. If the Markdown comes from users or an untrusted source, you must sanitise the resulting HTML yourself before publishing it, on the server with a maintained sanitiser, ideally together with a Content Security Policy. A sanitised preview here does not make the downloaded HTML safe.',
        ],
      },
      {
        heading: 'Limits',
        paragraphs: [
          'Markdown has several dialects and extensions. This tool covers CommonMark plus GFM; it does not process front matter, footnotes, math, diagrams or custom containers, and it does not highlight code blocks, it only adds the language class that highlighters use. Inputs above about a megabyte are converted in a background worker, and the preview is switched off for very large results so the page stays fast. Nothing is uploaded: conversion and sanitising both run in your browser.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is the HTML output sanitised?',
        a: 'No. The output is exactly what marked produced, including any raw HTML in the Markdown. Only the on-page preview is sanitised. Sanitise untrusted Markdown yourself before publishing.',
      },
      {
        q: 'What does GFM add?',
        a: 'Tables, task lists, strikethrough with double tildes and automatic links for plain URLs. Turn it off for stricter base Markdown.',
      },
      {
        q: 'Why do images not show in the preview?',
        a: 'The preview never loads remote resources, so it shows the alt text instead. Your HTML output keeps the image tags unchanged.',
      },
      {
        q: 'Can I get a complete HTML page?',
        a: 'Yes. Turn on "Full HTML document" for a doctype, head, title from your first heading and a small stylesheet, then download the file.',
      },
      {
        q: 'Are my notes uploaded?',
        a: 'No. Conversion and preview run in your browser.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'excel-to-json',
    name: 'Excel to JSON',
    h1: 'Excel to JSON Converter: Read an XLSX Sheet as JSON or CSV',
    title: 'Excel to JSON Converter: XLSX to JSON or CSV | Asif Dev',
    description:
      'Convert an .xlsx sheet to JSON or CSV in your browser. Choose the sheet and header row, set date and empty-cell handling. Nothing is uploaded.',
    keyword: 'excel to json',
    category: 'converters',
    related: ['csv-to-json', 'xlsx-viewer', 'json-to-csv', 'json-formatter'],
    example: {
      input: 'orders.xlsx, sheet "Orders": header row id | customer | paid | date, one data row 1 | Asif | TRUE | 5 Mar 2024',
      output: '[\n  { "id": 1, "customer": "Asif", "paid": true, "date": "2024-03-05T00:00:00.000Z" }\n]',
    },
    sections: [
      {
        heading: 'Converting a workbook',
        paragraphs: [
          'Choose an .xlsx or .xlsm file, or drag it onto the drop zone. The workbook is opened in your browser, the sheet list fills in, and the first sheet that has data is converted straight away. Pick another sheet from the list at any time. Text, numbers, booleans and dates come through as their own types, and empty cells follow the rule you choose: null, left out of the object, or an empty string.',
          'Real spreadsheets often start with a title or a few blank rows, so you tell the tool which row holds the column names. Type 3 and rows 1 and 2 are ignored; type 0 if the sheet has no header, and keys become column_1, column_2 and so on. Duplicate or empty header cells get numeric suffixes. You can output an array of objects or an array of arrays, minified or indented, or switch to CSV with a comma, semicolon or tab delimiter and an optional Excel byte order mark on the download.',
        ],
      },
      {
        heading: 'Dates and numbers',
        paragraphs: [
          'Excel stores dates as plain numbers plus a display format, and the reader recognises date formats and turns those cells into dates. You then decide how they are written: a full ISO timestamp, a date only (2024-03-05), or a date and time (2024-03-05 14:30:00). Values are read as stored, which means UTC, with no time zone conversion, so a cell showing 9:00 stays 9:00.',
          'Numbers are read as JavaScript numbers, which are exact up to about 15 significant digits. Long identifiers such as card numbers or 18-digit ids lose their trailing digits if the cell was stored as a number, and the tool warns when it sees integers beyond 2^53. Format those cells as Text in Excel before saving to keep every digit.',
        ],
      },
      {
        heading: 'What it can and cannot read',
        paragraphs: [
          'The tool reads saved values only. A formula cell gives the result Excel stored when the file was last saved; nothing is recalculated, and a formula that had an error shows as empty. Hidden rows and columns are still included, merged cells keep only their top-left value, and formatting, charts, images, pivot tables and macros are ignored. Legacy .xls files and password-protected workbooks are not supported, and you get a plain explanation saying so; open them in Excel or LibreOffice and save as .xlsx first.',
          'Files over about a megabyte are opened in a background worker, and large sheets are converted in slices, so the page stays responsive. Files up to 50 MB are accepted, but a very large workbook may still exhaust a browser tab\'s memory. Nothing is uploaded: the file never leaves your device.',
        ],
      },
    ],
    faq: [
      {
        q: 'Does it recalculate formulas?',
        a: 'No. It reads the value Excel saved last time. A formula whose result was never saved, or ended in an error, appears as an empty cell.',
      },
      {
        q: 'Can it read old .xls files?',
        a: 'No. Only .xlsx and .xlsm workbooks are supported. Open an .xls file in Excel or LibreOffice and save it as .xlsx.',
      },
      {
        q: 'How do I skip title rows above the header?',
        a: 'Set "Header row" to the row number that holds the column names. Rows above it are ignored. Use 0 when the sheet has no header.',
      },
      {
        q: 'Why do some long numbers look wrong?',
        a: 'Excel stores numbers as floating-point values, exact to about 15 digits. Format ids and card numbers as Text in Excel before saving to keep every digit.',
      },
      {
        q: 'Is my spreadsheet uploaded?',
        a: 'No. The workbook is opened in your browser and never sent anywhere.',
      },
    ],
    updatedAt: '2026-11-05',
  },
];
