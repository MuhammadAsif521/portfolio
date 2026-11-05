import type { ToolMeta } from '../tools.manifest.js';

/** developer tools: manifest entries only (copy, SEO, FAQs). Keep the only import the type above: the backend keeps a verbatim copy. */
export const DEVELOPER_TOOLS: ToolMeta[] = [
  {
    slug: 'hash-generator',
    name: 'Hash Generator',
    h1: 'Hash Generator: MD5, SHA-256, SHA-512 and HMAC',
    title: 'Hash Generator: MD5, SHA-1, SHA-256, HMAC | Asif Dev',
    description:
      'Hash text or a file with MD5, SHA-1, SHA-256, SHA-384 and SHA-512, add an HMAC key and compare against an expected hash. Runs in your browser.',
    keyword: 'sha256 hash generator',
    category: 'security',
    related: ['password-generator', 'base64-encoder', 'jwt-decoder', 'uuid-generator'],
    example: {
      input: 'abc',
      output:
        'MD5      900150983cd24fb0d6963f7d28e17f72\nSHA-256  ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    },
    sections: [
      {
        heading: 'What this tool computes',
        paragraphs: [
          "Type or paste text, or choose a file, and the page shows its MD5, SHA-1, SHA-256, SHA-384 and SHA-512 digests side by side. Text is hashed as UTF-8 bytes, so the same string gives the same hash here as in Node.js, Python or sha256sum. SHA-1 and the SHA-2 family come from the Web Crypto API built into your browser; MD5, which Web Crypto deliberately leaves out, comes from the spark-md5 library. Output can be lowercase or uppercase hex, or Base64.",
          "Switch on HMAC mode to compute a keyed hash (RFC 2104). The key can be typed as text or entered as hex bytes, which is how the RFC 4231 test vectors are written. An HMAC proves that whoever made it knew the key, which is why webhook signatures from services such as Stripe or GitHub use it. A plain hash proves nothing about who produced it.",
        ],
      },
      {
        heading: 'Checking a download or a signature',
        paragraphs: [
          "Paste the hash a publisher gave you into the compare box. It accepts hex in any case, with or without colons or spaces, and Base64, and tells you which algorithm matched. The length of a hex string is a good hint: 32 characters is MD5, 40 is SHA-1, 64 is SHA-256, 96 is SHA-384 and 128 is SHA-512. A mismatch means the bytes differ, not that the file is dangerous: a changed line ending, a different encoding or a wrong key gives a completely different hash.",
          "Files are read in 8 MB slices with a progress readout, and MD5 is computed in 1 MB chunks so the page stays responsive. Because SHA through Web Crypto needs the whole message in memory, files are limited to 512 MB. For larger files use sha256sum or Get-FileHash on the command line.",
        ],
      },
      {
        heading: 'What a hash is not for',
        paragraphs: [
          "MD5 and SHA-1 are broken for security purposes: attackers can construct two different inputs with the same digest, and a SHA-1 collision was demonstrated publicly in 2017. They remain fine for catching accidental corruption or as cache keys. Do not use them to sign anything. Never store passwords with a plain SHA-256 either; it is built to be fast, which helps an attacker. Use Argon2id, bcrypt or scrypt, which are slow on purpose and salted.",
          "A hash cannot be decrypted. People sometimes look up common hashes in tables of precomputed values, which only works for short, guessable inputs. Nothing you enter here is sent anywhere, but treat a secret key typed into any web page with care and use throwaway keys when you only want to test an implementation.",
        ],
      },
    ],
    faq: [
      {
        q: 'Can I decrypt or reverse a hash?',
        a: 'No. A hash is a one-way function, not encryption. Tools that claim to reverse hashes only look the value up in tables of known inputs, which works for weak, common passwords and fails for anything long or random.',
      },
      {
        q: 'Which algorithm should I use?',
        a: 'SHA-256 is the usual choice for checksums and integrity checks. Use SHA-384 or SHA-512 if a specification asks for them. Use MD5 or SHA-1 only to match an existing system. For passwords use Argon2id, bcrypt or scrypt instead of any plain hash.',
      },
      {
        q: 'Why does my hash differ from the one in my code?',
        a: 'The usual causes are a trailing newline, a different text encoding, Windows line endings (CRLF versus LF), or hashing a string in one place and its Base64 form in another. Hash the same bytes and the results match.',
      },
      {
        q: 'What is HMAC and when do I need it?',
        a: 'HMAC mixes a secret key into the hash so only someone with the key can produce or verify it. It is used for webhook signatures, signed cookies and API request signing. Compare HMACs in constant time in your server code.',
      },
      {
        q: 'Is my text or file uploaded?',
        a: 'No. Hashing happens in your browser with Web Crypto and a small MD5 library. Nothing is sent to a server, and nothing is stored after you close the page.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'password-generator',
    name: 'Password Generator',
    h1: 'Random Password and Passphrase Generator',
    title: 'Password Generator with Entropy Meter | Asif Dev',
    description:
      'Generate random passwords and word passphrases with the Web Crypto random generator. See the entropy in bits and how it is calculated. Nothing is stored.',
    keyword: 'random password generator',
    category: 'security',
    related: ['hash-generator', 'uuid-generator', 'jwt-decoder', 'base64-encoder'],
    example: {
      input: 'Length 20, lowercase + uppercase + digits + symbols',
      output: 'Example result (yours will differ): a 20-character password\nEntropy: about 129 bits (20 x log2(89))',
    },
    sections: [
      {
        heading: 'How the passwords are made',
        paragraphs: [
          "Every character is chosen with crypto.getRandomValues, the browser's cryptographically secure random generator, not Math.random. Picking a character from a list of, say, 89 options by taking a random number modulo 89 would make some characters slightly more likely than others. This tool avoids that with rejection sampling: random 32-bit values that fall in the uneven tail are thrown away and redrawn, so every character is exactly equally likely.",
          "You can set a length from 4 to 128, tick the character types you want, skip look-alike characters such as l, 1, I, O and 0, and leave out any characters a site refuses. If you ask for every ticked type to appear, a password that misses one is discarded and redrawn. That keeps the result uniform over all valid passwords, unlike the common shortcut of inserting one character of each type and shuffling.",
        ],
      },
      {
        heading: 'Passphrases and entropy',
        paragraphs: [
          "Passphrase mode joins random words from the EFF Large Wordlist, a list of 7,776 words published by the Electronic Frontier Foundation under a Creative Commons Attribution licence. Each word adds log2(7,776), about 12.9 bits, so six words give about 77.5 bits. Passphrases are easier to type and remember than random symbols, which makes them a good choice for a password manager's master password or a disk encryption key.",
          "The strength bar shows entropy: the base-2 logarithm of the number of different results the generator could produce. For a password the formula is length x log2(pool size); with the require-every-type option the exact count is computed by inclusion-exclusion and the formula is shown on screen. The labels are only a guide to that number. This tool does not claim a time to crack, because that depends on how a service stores passwords and on an attacker's hardware, neither of which the page can know.",
        ],
      },
      {
        heading: 'Using them safely',
        paragraphs: [
          "Use a different password for every account and keep them in a password manager so you never have to memorise them. A long random password is only as safe as the site that stores it, so turn on two-factor authentication wherever it is offered. Current NIST guidance on digital identity (SP 800-63B) favours length and discourages forced composition rules and routine expiry, so if a site allows it, a longer password beats a shorter one with more symbols.",
          "Generated values exist only in this page's memory. They are not sent anywhere, not logged and not saved, and reloading the page clears them. Copy a password straight into your manager rather than leaving it in a note or chat.",
        ],
      },
    ],
    faq: [
      {
        q: 'Is this random enough for real passwords?',
        a: 'Yes. It uses the Web Crypto random generator that browsers provide for security purposes, plus rejection sampling so no character is favoured. That is the same class of randomness password managers use.',
      },
      {
        q: 'How long should a password be?',
        a: 'For accounts kept in a password manager, 16 to 20 random characters is a common choice, and longer costs you nothing. For something you must type or remember, a passphrase of six or more random words is better than a short password.',
      },
      {
        q: 'What does "bits of entropy" mean?',
        a: 'It is the base-2 logarithm of how many different values the generator could have produced. Each extra bit doubles the search space. It describes the generator, not a particular password, and it assumes the attacker knows your settings.',
      },
      {
        q: 'Where does the word list come from?',
        a: 'The EFF Large Wordlist, 7,776 words chosen to be easy to read and spell, released under CC BY 3.0 US. It is downloaded only if you use passphrase mode.',
      },
      {
        q: 'Do you store or send what I generate?',
        a: 'No. Generation runs in your browser, results are not stored, and the page makes no request containing them. Closing or reloading the page discards everything.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'qr-code-generator',
    name: 'QR Code Generator',
    h1: 'QR Code Generator for URLs, WiFi, Contacts and More',
    title: 'QR Code Generator: URL, WiFi, vCard, PNG, SVG | Asif Dev',
    description:
      'Make QR codes for links, WiFi, contacts, email, SMS and locations. Choose error correction, size and colours, then download PNG or SVG. No upload.',
    keyword: 'qr code generator',
    category: 'utility',
    related: ['url-encoder-decoder', 'base64-encoder', 'color-converter', 'uuid-generator'],
    example: {
      input: 'WiFi: network HomeNet, WPA, password secret123',
      output: 'WIFI:T:WPA;S:HomeNet;P:secret123;;\nEncoded as a QR code you can download as PNG or SVG.',
    },
    sections: [
      {
        heading: 'What you can encode',
        paragraphs: [
          "Choose a content type and fill in the fields; the code updates as you type. Text or URL encodes whatever you enter. WiFi builds the WIFI:T:WPA;S:name;P:password;; string that Android and iPhone cameras read as an offer to join the network, with the special characters backslash, semicolon, comma, colon and double quote escaped. Contact creates a vCard 3.0 card. Email produces a mailto: link with a subject and body, SMS an sms: link with a message, and Location a geo: link from a latitude and longitude, which the page checks are in range.",
          "The page shows the QR version, the grid size and the number of data bytes. If your content does not fit, it tells you the limit for the error-correction level you chose instead of failing silently. A version 40 code holds roughly 2.9 KB at the lowest level, but codes that dense are hard to scan; keep content short, and use a short URL rather than a long one.",
        ],
      },
      {
        heading: 'Making a code that scans',
        paragraphs: [
          "Error correction trades capacity for resilience: levels L, M, Q and H can recover about 7%, 15%, 25% and 30% of damaged modules. Use M for most screens and prints, and H if you will place a logo over the middle or the code may get scuffed. Keep the quiet zone, the empty border around the code, at the standard four modules; scanners rely on it to find the edges, and the page warns you when it is smaller.",
          "Dark code on a light background scans best. Inverted codes (light on dark) fail on many scanners, and low-contrast colour pairs fail on phone cameras, so the page checks the contrast ratio and warns below 4:1, a practical rule of thumb rather than a standard. Always test the finished code with a real phone, and print it at a size that suits the scanning distance, for example at least 2 cm across for a handheld scan.",
        ],
      },
      {
        heading: 'Exporting and privacy',
        paragraphs: [
          "Download a PNG at the pixel size you set, or an SVG that stays sharp at any size and suits print and signage. Browsers that support it also offer Copy image, which puts the PNG on the clipboard. Everything is generated in your browser with the open-source qrcode library, so the text, WiFi password or contact details you enter are never uploaded.",
          "Static codes like these contain the data itself and never expire, but they also cannot be edited or tracked afterwards. If you need to change a printed code's destination later, point it at a URL you control and redirect from there.",
        ],
      },
    ],
    faq: [
      {
        q: 'Do these QR codes expire?',
        a: 'No. The data is stored in the code itself, so it works as long as it can be scanned. The code cannot be changed afterwards. For a destination you may need to change, encode a URL on your own domain and redirect it.',
      },
      {
        q: 'Which error-correction level should I choose?',
        a: 'M is a good default. Choose H if the code will carry a logo or may be damaged, and L only when you need to fit more data and the code will be clean and large.',
      },
      {
        q: 'Why will my QR code not scan?',
        a: 'Common causes are too little contrast, an inverted colour scheme, no quiet zone, a code printed too small for the distance, or content that is so long the grid is very dense. Shorten the content and test with a phone.',
      },
      {
        q: 'Is the WiFi password sent anywhere?',
        a: 'No. The code is generated in your browser and nothing is uploaded. Anyone who scans the code can read the password, so only display it where that is acceptable.',
      },
      {
        q: 'PNG or SVG?',
        a: 'Use SVG for print, signage and anything that gets resized, because it is vector. Use PNG for screens, documents and chat apps that do not accept SVG.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'url-encoder-decoder',
    name: 'URL Encoder and Decoder',
    h1: 'URL Encoder, Decoder and Parser',
    title: 'URL Encoder and Decoder with URL Parser | Asif Dev',
    description:
      'Percent-encode and decode URLs in component, whole-URL and form modes, spot double encoding, and split any URL into editable parts. Runs in your browser.',
    keyword: 'url encoder decoder',
    category: 'web',
    related: ['base64-encoder', 'qr-code-generator', 'jwt-decoder', 'regex-tester'],
    example: {
      input: 'name=Zoë & Co/2026 100%',
      output: 'name%3DZo%C3%AB%20%26%20Co%2F2026%20100%25',
    },
    sections: [
      {
        heading: 'Three ways to encode',
        paragraphs: [
          "Percent-encoding replaces characters that are not safe in a URL with a percent sign and the hexadecimal value of each UTF-8 byte, so ë becomes %C3%AB. Which characters are left alone depends on the job, and the mode selector covers the three you meet in practice. Component mode is JavaScript's encodeURIComponent: it escapes everything except letters, digits and - _ . ! ~ * ' ( ), which is right for a single query value, a path segment or a redirect target.",
          "Whole-URL mode is encodeURI. It keeps ; , / ? : @ & = + $ # so a complete URL stays a URL, which means it will not protect an & or = that sits inside a value. Form mode produces application/x-www-form-urlencoded as the WHATWG URL standard defines it: spaces become +, and only letters, digits and * - . _ remain unescaped. That is what an HTML form or URLSearchParams sends, and it is why + in a query string means a space but in a path is a literal plus.",
        ],
      },
      {
        heading: 'Decoding errors and double encoding',
        paragraphs: [
          "Decoding fails on a percent sign that is not followed by two hex digits, such as the 100% in a sentence, or on byte sequences that are not valid UTF-8, typically text encoded in Latin-1 where é is %E9 instead of %C3%A9. Instead of a vague URIError the tool points at the exact position and sequence, explains the likely cause, and shows a lenient decode that leaves the broken parts as they were.",
          "Double encoding happens when an already-encoded value is encoded again: %20 turns into %2520. It is a frequent cause of links that show literal %20 in the page or APIs that reject a request. The tool flags text that looks encoded more than once, lists each decoding step, and warns when you are about to encode text that already contains percent-escapes.",
        ],
      },
      {
        heading: 'Taking a URL apart',
        paragraphs: [
          "Paste a full URL to split it with the browser's own URL parser into protocol, user, host, port, path, query parameters and fragment. Query parameters appear as editable rows; change, add or remove them and the rebuilt URL updates. Internationalised domain names are shown in readable Unicode and in their punycode form (xn--mnchen-3ya.de for münchen.de), which is what DNS and certificates use. Seeing both helps spot look-alike domains, although the tool does not judge whether a name is deceptive.",
          "Rebuilt URLs write parameters in form encoding, so a space becomes +, and duplicate names such as tag=a&tag=b are kept in order. A URL with no scheme is reported as such rather than guessed at.",
        ],
      },
    ],
    faq: [
      {
        q: 'What is the difference between encodeURI and encodeURIComponent?',
        a: 'encodeURIComponent escapes reserved characters such as / ? & = # and is meant for one piece of a URL. encodeURI leaves them alone so a whole URL remains valid. Using encodeURI on a query value is a common bug because it does not escape & or =.',
      },
      {
        q: 'Should a space be %20 or +?',
        a: 'In a path, always %20. In a query string both are read as a space by form decoders, but only %20 is unambiguous everywhere. Use + only when you produce application/x-www-form-urlencoded data on purpose.',
      },
      {
        q: 'Why does decoding say my text is malformed?',
        a: 'Either a % is not followed by two hex digits, or the escaped bytes are not valid UTF-8. A literal percent sign must be written as %25. Text from older systems may be Latin-1 or Windows-1252 and needs converting.',
      },
      {
        q: 'How do I know if a URL is double encoded?',
        a: 'Look for %25 followed by two hex digits, such as %2520 or %253A. Decode once and see whether percent-escapes remain. The tool does this and shows every step.',
      },
      {
        q: 'Is the URL sent to a server?',
        a: 'No. Encoding, decoding and parsing all run in your browser, so tokens and private links you paste are not uploaded.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'sql-formatter',
    name: 'SQL Formatter',
    h1: 'SQL Formatter and Minifier',
    title: 'SQL Formatter for PostgreSQL, MySQL, T-SQL | Asif Dev',
    description:
      'Format or minify SQL for PostgreSQL, MySQL, MariaDB, SQLite, T-SQL, PL/SQL and BigQuery. Set keyword case, indent and commas. Runs in your browser.',
    keyword: 'sql formatter',
    category: 'web',
    related: ['json-formatter', 'json-to-mongoose-schema', 'regex-tester', 'json-viewer'],
    example: {
      input: 'select id,name from users where active=1 and age>30 order by name',
      output: 'SELECT\n  id,\n  name\nFROM\n  users\nWHERE\n  active = 1\n  AND age > 30\nORDER BY\n  name',
    },
    sections: [
      {
        heading: 'Format, then read',
        paragraphs: [
          "Paste a query and it is laid out with each clause on its own line, one column per line, conditions indented and keywords in the case you choose. That makes a 400-character one-liner from an ORM log or a slow-query report readable enough to review. Formatting uses the open-source sql-formatter library, run in your browser, and the same input always gives the same output, so it is also useful for tidying SQL before you commit it.",
          "Choose the dialect that matches your database: PostgreSQL, MySQL, MariaDB, SQLite, T-SQL for SQL Server, PL/SQL for Oracle, BigQuery or standard SQL. Dialects differ in quoting ([name] in T-SQL, backticks in MySQL), in operators such as PostgreSQL's ->> and in reserved words, so the wrong dialect can give a parse error or odd breaks.",
        ],
      },
      {
        heading: 'Options that matter',
        paragraphs: [
          "Keywords can be upper case, lower case or left as typed. Indent is two or four spaces or a tab. Commas can end the line or start the next one, a style some teams use so a diff of an added column touches one line. You can also put AND and OR at the start or end of the line and choose how many blank lines separate statements.",
          "Query parameters keep their form. Pick how placeholders are written (?, $1, :name, @name or double braces) so the formatter treats them as one token instead of splitting them; the dialect default is usually right. Minify does the reverse: it collapses whitespace and removes comments, leaving strings, quoted identifiers, PostgreSQL dollar-quoted text and MySQL optimizer hints untouched.",
        ],
      },
      {
        heading: 'What formatting does not do',
        paragraphs: [
          "A formatter changes layout only. It does not check that tables, columns or functions exist, does not validate semantics, and never runs your query, so a formatted query can still fail in the database. If the tool cannot parse the text it reports the line and column of the problem and suggests trying another dialect instead of guessing.",
          "Be careful with minified output when a line comment is the last thing in the text; this tool removes comments so that cannot happen, but if you minify by hand, a -- comment will swallow everything after it on the same line. Review diffs after reformatting a large file, since whitespace changes can hide real edits.",
        ],
      },
    ],
    faq: [
      {
        q: 'Does it validate my SQL?',
        a: 'No. It only formats. It will reject text it cannot tokenise, but it does not know your schema, so a well-formatted query may still be wrong. Run it against a test database to find out.',
      },
      {
        q: 'Which dialect should I pick?',
        a: 'The one that matches the database running the query. If the text came from a tool such as a query log, check which database produced it. Standard SQL is a safe fallback for simple statements.',
      },
      {
        q: 'Why is my parameter placeholder split apart?',
        a: 'Placeholder syntax varies. Set the placeholder style to match yours, for example $1 for PostgreSQL drivers or ? for MySQL, so the formatter keeps it as one token.',
      },
      {
        q: 'Does minify change what my query does?',
        a: 'It removes comments and extra whitespace and keeps string contents exactly, so the statement is equivalent. MySQL optimizer hints and conditional comments are kept because they change behaviour.',
      },
      {
        q: 'Is my SQL uploaded?',
        a: 'No. Formatting happens in your browser. Queries often contain table names and values you may not want to share, and none of it leaves the page.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'color-converter',
    name: 'Color Converter and Contrast Checker',
    h1: 'Color Converter: HEX, RGB, HSL, OKLCH and WCAG Contrast',
    title: 'Color Converter: HEX, RGB, HSL, OKLCH, Contrast | Asif Dev',
    description:
      'Convert colours between HEX, RGB, HSL, HSV, CMYK and OKLCH, check WCAG 2.2 contrast ratios and build tint and shade palettes. Runs in your browser.',
    keyword: 'color converter hex to rgb',
    category: 'web',
    related: ['qr-code-generator', 'meta-tag-generator', 'base64-encoder', 'regex-tester'],
    example: {
      input: '#1d4ed8 on #ffffff',
      output:
        'rgb(29 78 216)  hsl(224 76% 48%)  oklch(0.4882 0.2172 264.38)\nContrast 6.70:1 (AA pass, AAA normal text fail)',
    },
    sections: [
      {
        heading: 'Every format from one input',
        paragraphs: [
          "Type a colour in almost any CSS notation (a hex code with 3, 4, 6 or 8 digits, rgb(), hsl(), hwb(), oklab(), oklch(), a CSS name such as rebeccapurple) or the non-CSS notations hsv() and cmyk(), or pick one with the colour picker. The page shows HEX, RGB, HSL, HWB, HSV, CMYK, OKLCH and OKLab, each with a copy button, plus the CSS name when there is an exact match or the nearest name when there is not. Alpha is carried through where the format supports it.",
          "OKLCH is the newer, perceptually based notation from CSS Color 4: lightness, chroma and hue, designed so that equal numeric steps look like equal steps. It is supported in current versions of the major browsers; the page tells you whether yours can display it. The conversion uses the sRGB, XYZ and OKLab matrices published in the specification, and the test suite checks them against the primaries, for example red is oklch(0.628 0.2577 29.23).",
        ],
      },
      {
        heading: 'Contrast checking with WCAG 2.2',
        paragraphs: [
          "Enter a text colour and a background and the page computes the WCAG contrast ratio from relative luminance: each channel is linearised with the sRGB curve, weighted 0.2126, 0.7152 and 0.0722, and the ratio is (lighter + 0.05) / (darker + 0.05). It then lists the results for AA (4.5:1 for normal text, 3:1 for large text) and AAA (7:1 and 4.5:1), plus the 3:1 threshold for user-interface components and graphics. Large text means at least 24 px, or 18.66 px if bold.",
          "The ratio is never rounded up: 4.499:1 fails 4.5:1, and the displayed value is truncated rather than rounded so a near miss is not hidden. A translucent text colour is blended over the background first, as a browser paints it. Contrast ratios are a minimum for accessibility, not a guarantee of comfortable reading, and WCAG 2.x does not model how thin fonts or very small text affect legibility.",
        ],
      },
      {
        heading: 'Palettes and CSS variables',
        paragraphs: [
          "For any colour you get nine tints, mixed towards white, and nine shades, mixed towards black, at even steps, each labelled with a readable text colour, and a block of CSS custom properties you can paste into :root. The mixing is done in sRGB, so results are predictable and match Sass's mix(); they are a quick starting point rather than a designed scale, and mid steps can look muddier than a hand-tuned or OKLCH-based palette.",
          "CMYK here is plain arithmetic from RGB. It is not colour-managed, so it will not match a print shop's profile, and colours outside the sRGB gamut, such as very saturated OKLCH values, are brought into gamut by reducing chroma. Treat the numbers as screen values.",
        ],
      },
    ],
    faq: [
      {
        q: 'How do I convert HEX to RGB?',
        a: 'Split the hex code into pairs and read each as a number from 0 to 255: #1d4ed8 is 1d = 29, 4e = 78 and d8 = 216, so rgb(29 78 216). Paste it above to do it instantly, along with HSL and OKLCH.',
      },
      {
        q: 'What contrast ratio do I need?',
        a: 'WCAG 2.2 level AA asks for 4.5:1 for normal text and 3:1 for large text and for user-interface components. Level AAA asks for 7:1 and 4.5:1. Aim higher than the minimum where you can.',
      },
      {
        q: 'What is OKLCH and why use it?',
        a: 'OKLCH describes a colour by lightness, chroma and hue in a space designed to match human perception, so changing lightness does not shift the apparent hue as HSL does. It can also express colours beyond sRGB. Provide a hex fallback if you must support very old browsers.',
      },
      {
        q: 'Why does the CMYK value not match my printer?',
        a: 'This is a simple mathematical conversion with no ink or paper profile. Real print conversion depends on ICC profiles and the press, so ask your printer for their profile if exact colour matters.',
      },
      {
        q: 'Are my colours sent anywhere?',
        a: 'No. Parsing, conversion and contrast calculations run in your browser.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'json-viewer',
    name: 'JSON Viewer',
    h1: 'JSON Viewer: Explore Large JSON as a Tree',
    title: 'JSON Viewer: Searchable Tree, Paths, Large Files | Asif Dev',
    description:
      'View JSON as a collapsible tree with search, type badges, JSONPath copy and stats. Handles files of tens of megabytes in a worker. No upload.',
    keyword: 'json viewer',
    category: 'web',
    related: ['json-formatter', 'json-to-typescript', 'json-to-yaml', 'json-to-csv'],
    example: {
      input: '{"users":[{"id":1,"name":"Ada"}]}',
      output: 'Select name in the tree:\nJSONPath  $.users[0].name\nDot path  users[0].name',
    },
    sections: [
      {
        heading: 'A tree built for big documents',
        paragraphs: [
          "Paste JSON or choose a file of up to 100 MB and explore it as a collapsible tree. Each row shows the key, a type badge (obj, arr, str, num, bool, null) and a short preview: a child count for containers and the value for primitives. Large arrays are paged 200 items at a time, and only the rows in view are drawn, so a list of a hundred thousand records scrolls smoothly.",
          "The document is parsed and held in a Web Worker, a background thread, and the page asks it for just the rows it needs. Parsing a big file therefore does not freeze the interface, and the browser never has to copy the whole structure into the page. If workers are unavailable the same code runs on the page instead, and very large files may then make it pause briefly; the stats panel says which mode was used. Nothing is uploaded either way.",
        ],
      },
      {
        heading: 'Search, paths and levels',
        paragraphs: [
          "Search keys, values or both, with optional case matching. Results are listed (up to 500 are found) and clicking one opens its ancestors and scrolls it into view. Click any row to select it and see a breadcrumb; from there copy its JSONPath such as $.users[0].name, its dot path such as users[0].name, or the value itself as formatted JSON. Keys that are not plain identifiers use bracket notation, for example $['first name'].",
          "Expand to level N opens the tree down to the depth you choose, stopping after 5,000 rows so the page stays quick, and Collapse all folds it back. The tree works from the keyboard: arrow keys move, right and left expand and collapse, Enter selects. The stats panel reports size, maximum depth, number of values, keys, objects, arrays and each primitive type, and names the longest array.",
        ],
      },
      {
        heading: 'Invalid JSON and limits',
        paragraphs: [
          "If the text is not valid JSON, the viewer reports the line and column of the first problem with a plain explanation, such as a trailing comma, single quotes, an unquoted key or a string that is never closed, and shows the offending text with a caret. It parses strict JSON as JSON.parse does, so comments, NaN and trailing commas are errors. Large integers beyond 9,007,199,254,740,991 lose precision when parsed by JavaScript, a limit of the language rather than of this tool.",
          "Duplicate keys in an object keep the last value, as in JavaScript. Newline-delimited JSON (JSONL) is not a single JSON document, so paste or load one record at a time. For files beyond 100 MB, a command-line tool such as jq is a better fit.",
        ],
      },
    ],
    faq: [
      {
        q: 'How large a JSON file can it open?',
        a: 'Files up to 100 MB are accepted. Tens of megabytes parse in the background without freezing the page; very large files need enough free memory in the browser, and for anything bigger a command-line tool such as jq is better.',
      },
      {
        q: 'What is the difference between JSONPath and a dot path?',
        a: 'JSONPath starts with $ and is a query language standardised as RFC 9535, for example $.users[0].name. A dot path is the property-access form used in JavaScript code, users[0].name. The viewer copies either.',
      },
      {
        q: 'Why does it say my JSON is invalid when it works in my code?',
        a: 'JSON is stricter than a JavaScript object literal: double quotes only, no trailing commas, no comments, no undefined or NaN. The error shows the exact position.',
      },
      {
        q: 'Can it edit the JSON?',
        a: 'No, it is a viewer. To reformat, minify or sort keys, use the JSON formatter, and to generate types from a sample use the JSON to TypeScript tool.',
      },
      {
        q: 'Is my JSON uploaded?',
        a: 'No. The file is read and parsed in your browser, inside a worker, and nothing is sent to a server.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'meta-tag-generator',
    name: 'Meta Tag Generator',
    h1: 'Meta Tag Generator with Google and Social Previews',
    title: 'Meta Tag Generator: Title, Open Graph, Robots | Asif Dev',
    description:
      'Generate title, meta description, canonical, robots, Open Graph and Twitter card tags with live length meters and search and social previews.',
    keyword: 'meta tag generator',
    category: 'seo',
    related: ['robots-txt-generator', 'url-encoder-decoder', 'color-converter', 'qr-code-generator'],
    example: {
      input: 'Title: Handmade Ceramic Mugs | Clay & Co.\nCanonical: https://example.com/mugs',
      output:
        '<title>Handmade Ceramic Mugs | Clay &amp; Co.</title>\n<link rel="canonical" href="https://example.com/mugs">\n<meta property="og:url" content="https://example.com/mugs">',
    },
    sections: [
      {
        heading: 'What it writes',
        paragraphs: [
          "Fill in the form and the page writes the tags for the head of your HTML: charset and viewport, the title, the meta description, a canonical link, a robots meta tag, theme colours, favicon and manifest links, Open Graph tags for link previews and Twitter card tags. Values are escaped so quotes and ampersands cannot break the markup. Empty fields produce no tag, and Open Graph values default to the page title and description unless you override them. Copy the result or download it as a .html snippet.",
          "The robots tag is written only when it differs from the default. Untick indexing for noindex, untick following for nofollow, and optionally add max-snippet and max-image-preview, which are directives Google documents. A warning reminds you that a page blocked in robots.txt cannot show crawlers its noindex tag, so do not use both on a page you want removed from results.",
        ],
      },
      {
        heading: 'Titles and descriptions',
        paragraphs: [
          "Google's documentation says a title element should be descriptive and concise, unique per page, free of keyword stuffing, and that the site name can go at the start or end separated by a hyphen, colon or pipe. It also says there is no limit on how long a title can be, but that results are cut off to fit the screen, so the important words should come first. Google may rewrite a title when it judges another text, such as a heading, describes the page better.",
          "The length meters are therefore guides. The title meter estimates pixel width using Arial letter widths against the roughly 600 px desktop width often quoted by SEO tools; that figure is a rule of thumb, not a Google rule, and real results use Google's own fonts. Meta descriptions have no length limit either, snippets are cut to fit, and Google may ignore your text in favour of page content, so the meter marks about 70 to 160 characters as typical rather than required.",
        ],
      },
      {
        heading: 'Social cards and what to expect',
        paragraphs: [
          "The Open Graph protocol asks for og:title, og:type, og:image and og:url, and an alt text for the image; the tool takes og:url from your canonical URL. Twitter or X reads twitter:card and can fall back to the Open Graph tags for the rest, so the tool writes only the card type, handles and an image alt text when Open Graph is on. A 1200 x 630 pixel image is a common size for large cards.",
          "The social preview shows an image only after you type an address, and then only your browser requests that URL; the page itself fetches nothing and sends nothing. Meta tags help search engines and platforms understand a page, but they do not guarantee rankings, rich results or a particular snippet, and each platform caches previews on its own schedule.",
        ],
      },
    ],
    faq: [
      {
        q: 'How long should a title tag be?',
        a: 'Google sets no length limit but truncates titles to fit the screen. Roughly 50 to 60 characters, or about 600 pixels, usually shows in full on desktop, so put the key words first. Treat that as a guide rather than a rule.',
      },
      {
        q: 'Does the meta description affect rankings?',
        a: 'Google says it may use the meta description as the snippet when it describes the page better than the page text, and that is about presentation. Do not expect it to change rankings. A clear, unique description can still help people decide to click.',
      },
      {
        q: 'Do I need a meta keywords tag?',
        a: 'No. Google has said it does not use the keywords meta tag, so this tool does not generate one.',
      },
      {
        q: 'What does the canonical tag do?',
        a: 'It tells search engines which URL is the preferred version when several URLs show the same content. It is a strong hint, not a command, and should be an absolute URL in the head. Add a self-referencing canonical to normal pages.',
      },
      {
        q: 'Why does the preview not match what Google or Facebook show?',
        a: 'The previews are illustrations. Google uses its own fonts, may rewrite titles and snippets, and platforms cache link previews, so a changed tag can take time to appear. Use each platform\'s own debugger for the final check.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'robots-txt-generator',
    name: 'Robots.txt Generator and Tester',
    h1: 'Robots.txt Generator and Tester, with AI Crawler Presets',
    title: 'Robots.txt Generator and Tester, AI Crawlers | Asif Dev',
    description:
      'Build a robots.txt with presets for Googlebot, GPTBot, ClaudeBot and other AI crawlers, check it for mistakes and test URLs using Google rules.',
    keyword: 'robots.txt generator',
    category: 'seo',
    related: ['meta-tag-generator', 'url-encoder-decoder', 'regex-tester', 'http-status-codes'],
    example: {
      input:
        'User-agent: *\nDisallow: /admin/\nAllow: /admin/public/\nTest: /admin/public/logo.png',
      output: 'Allowed: Allow: /admin/public/ is the longest matching rule',
    },
    sections: [
      {
        heading: 'Building the file',
        paragraphs: [
          "A robots.txt file sits at the root of a host and lists groups of rules. Each group starts with one or more User-agent lines naming a crawler, followed by Allow and Disallow lines whose values are URL paths. Pick a preset (allow everything, block everything, a typical site, opt out of AI training, block all AI crawlers), then edit the groups, add Sitemap URLs, or paste an existing file to load it into the builder. The file updates as you type and can be copied or downloaded as robots.txt.",
          "The crawler list is checked against vendor documentation: Googlebot, Googlebot-Image, Googlebot-News, Googlebot-Video and Google-Extended from Google, GPTBot, OAI-SearchBot and ChatGPT-User from OpenAI, ClaudeBot, Claude-SearchBot and Claude-User from Anthropic, PerplexityBot and Perplexity-User from Perplexity, and Applebot-Extended from Apple. Bingbot and CCBot (Common Crawl) are included as widely used names. Vendors add and rename crawlers, so recheck their pages before relying on the list.",
        ],
      },
      {
        heading: 'How rules are matched',
        paragraphs: [
          "The tester follows Google's documented behaviour. A crawler uses only the group with the most specific matching user-agent, and falls back to the * group when it has none; names are case-insensitive but paths are case-sensitive. For a URL, the rule with the longest matching path wins, and if an Allow and a Disallow tie, Allow wins. A * in a path matches any run of characters, a trailing $ anchors the end, and a trailing * is ignored. So Allow: /admin/public/ overrides Disallow: /admin/ for files inside it.",
          "The linter flags the mistakes that matter: paths that do not start with / or *, rules before any User-agent line, relative Sitemap URLs, a blanket Disallow: / for all crawlers, files over Google's 500 KiB limit, and rules Google ignores such as Crawl-delay and noindex. Other crawlers can differ in edge cases, so the tester describes Google's behaviour only.",
        ],
      },
      {
        heading: 'What robots.txt cannot do',
        paragraphs: [
          "robots.txt is a request to well-behaved crawlers, defined as the Robots Exclusion Protocol in RFC 9309. It is not security: anyone can read the file, and listing a private path in it advertises that the path exists. Use authentication for anything private. It also does not remove pages from search. A URL blocked by robots.txt can still be indexed, without a description, if other sites link to it. To keep a page out of results, allow crawling and serve a noindex robots meta tag or X-Robots-Tag header, because a blocked page's noindex is never read.",
          "AI crawler rules are requests too. Blocking GPTBot or ClaudeBot signals that content should not be used for training, but fetchers that act on a user's request, such as ChatGPT-User and Perplexity-User, may not follow robots.txt, and blocking search crawlers such as OAI-SearchBot or Claude-SearchBot can keep your site out of those products' answers. Blocking Google-Extended does not affect Google Search.",
        ],
      },
    ],
    faq: [
      {
        q: 'Does robots.txt remove a page from Google?',
        a: 'No. It stops crawling, not indexing. A blocked URL can still appear in results without a snippet if other pages link to it. Use a noindex meta tag or header on a crawlable page, or remove the page, to take it out of results.',
      },
      {
        q: 'How do I block AI crawlers?',
        a: 'Add a group for each crawler token, for example User-agent: GPTBot with Disallow: /, or use the AI presets. Compliant training crawlers will honour it. Some user-triggered fetchers may ignore robots.txt, so use server-side rules if you need to enforce a block.',
      },
      {
        q: 'Does Google support Crawl-delay?',
        a: "No. Google ignores it. To slow Google down, have your server answer with 500, 503 or 429 status codes when it is overloaded. Some other crawlers, such as Anthropic's ClaudeBot, read Crawl-delay.",
      },
      {
        q: 'Where do I put the robots.txt file?',
        a: 'At the top level of each host, for example https://example.com/robots.txt. It applies only to that host, protocol and port, so a subdomain needs its own file.',
      },
      {
        q: 'Which rule wins when Allow and Disallow both match?',
        a: 'The one with the longer path. If they are equally long, Allow wins. The tester shows the deciding rule for any URL.',
      },
    ],
    updatedAt: '2026-11-05',
  },
];
