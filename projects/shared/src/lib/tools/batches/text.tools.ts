import type { ToolMeta } from '../tools.manifest.js';

/** text tools: manifest entries only (copy, SEO, FAQs). Keep the only import the type above: the backend keeps a verbatim copy. */
export const TEXT_TOOLS: ToolMeta[] = [
  {
    slug: 'word-counter',
    name: 'Word Counter',
    h1: 'Word Counter: Words, Characters, Reading Time and Keywords',
    title: 'Word Counter and Character Counter, Live | Asif Dev',
    description:
      'Count words, characters, sentences and paragraphs as you type, with reading time, top keywords and limits for X posts, SMS and meta tags. Browser only.',
    keyword: 'word counter',
    category: 'text',
    related: ['case-converter', 'text-cleaner', 'text-diff-checker', 'slug-generator'],
    example: {
      input: 'The quick brown fox jumps over the lazy dog. It is a pangram.\n\nWords matter.',
      output:
        'Words: 15\nCharacters: 76 (61 without spaces)\nSentences: 3\nParagraphs: 2\nLines: 3\nLongest word: pangram\nReading time: 4 sec (238 wpm)\nSpeaking time: 6 sec (150 wpm)\nMeta description (155): 79 left',
    },
    sections: [
      {
        heading: 'What each count means',
        paragraphs: [
          'Words are runs of text separated by whitespace or by an em or en dash. Punctuation around a word is ignored, apostrophes and hyphens inside a word stay ("don\'t" and "well-known" are one word each), and a token with no letter or digit, such as "-" or "&", is not counted. Chinese, Japanese, Thai and other scripts written without spaces are split with the browser\'s word segmenter when it has one, and character by character when it does not.',
          'Characters are what a reader sees as one character, not what JavaScript reports as .length. An emoji with a skin tone, a flag or an accented letter written as two code points each counts once, and a Windows line break (CRLF) counts as one. The tool also shows the count without spaces and the size in UTF-8 bytes, which matters for databases and APIs that limit bytes instead of characters.',
          'Sentences end at a full stop, question mark, exclamation mark or ellipsis followed by a space, a closing quote or the end of the text. Decimals, domain names and common abbreviations such as Dr. and e.g. do not end a sentence, but no rule set can be right for every abbreviation in every language, so treat the sentence count as a good estimate. Paragraphs are blocks separated by blank lines.',
        ],
      },
      {
        heading: 'Reading and speaking time: the assumptions',
        paragraphs: [
          'Reading time uses 238 words per minute, the average silent reading rate of adults reading English non-fiction in the 2019 meta-analysis by Marc Brysbaert (190 studies, 18,573 participants). Speaking time uses 150 words per minute, a common planning pace for talks and voice-overs; that figure is a convention, not a measured average. Both are estimates: technical text, a second language or a slide deck read aloud with pauses will run slower.',
          'You can scale the numbers yourself. A 1,000-word article is about four minutes of reading and about six and a half minutes of speaking at these rates.',
        ],
      },
      {
        heading: 'Keywords, limits and large texts',
        paragraphs: [
          'The keyword list shows the most frequent words or two- and three-word phrases, with each one\'s share of all words. English stop words such as "the" and "of" can be skipped. Use it to spot repetition in your own writing. The tool does not claim that any percentage helps a page rank, and it does not suggest a target: write for the reader first.',
          'Character limit presets show how much room is left. X posts are weighted the way X documents it (most Latin characters count 1, Chinese, Japanese, Korean and emoji count 2, every link counts 23), which this tool approximates. Google shortens titles and descriptions by pixel width, so 60 and 155 characters are planning guides rather than rules. SMS messages switch from GSM-7 (160 characters, or 153 per part) to Unicode (70, or 67 per part) as soon as one character falls outside the GSM set, and the tool shows which applies.',
          'Pasting a text of several megabytes works: counting starts shortly after you stop typing and runs in chunks so the page stays responsive. Select part of the text to see its own counts.',
        ],
      },
    ],
    faq: [
      {
        q: 'Why is my count different from Word or Google Docs?',
        a: 'Programs differ on dashes, slashes, numbers, URLs and symbols. This tool counts whitespace- and dash-separated tokens that contain a letter or digit, so expect small differences on text with many dashes or links.',
      },
      {
        q: 'How long does a 1,000-word text take to read?',
        a: 'About four minutes at 238 words per minute (adult silent reading of English non-fiction, Brysbaert 2019), and about six and a half minutes to say aloud at 150 words per minute.',
      },
      {
        q: 'Is there an ideal keyword density?',
        a: 'No. This tool reports how often words occur so you can notice repetition. It makes no claim that a certain percentage improves rankings, and search engines do not publish one.',
      },
      {
        q: 'Does it work with emoji, Arabic, Urdu or Chinese?',
        a: 'Yes. Characters are counted as users see them, right-to-left text counts normally, and scripts without spaces are split with the browser\'s word segmenter where available.',
      },
      {
        q: 'Is my text uploaded anywhere?',
        a: 'No. Counting happens in your browser. Text files you load are read locally and never leave the page.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'case-converter',
    name: 'Case Converter',
    h1: 'Case Converter: Title Case, Sentence Case, camelCase and More',
    title: 'Case Converter: Title, Sentence, camelCase, snake_case',
    description:
      'Convert text to UPPER, lower, Title Case, Sentence case, camelCase, PascalCase, snake_case, kebab-case and more, with copy buttons. Runs in your browser.',
    keyword: 'case converter',
    category: 'text',
    related: ['slug-generator', 'word-counter', 'text-cleaner', 'regex-tester'],
    example: {
      input: 'the quick brown fox: a guide to HTTPServer2',
      output:
        'Title Case: The Quick Brown Fox: A Guide to HTTPServer2\nSentence case: The quick brown fox: a guide to HTTPServer2\ncamelCase: theQuickBrownFoxAGuideToHttpServer2\nsnake_case: the_quick_brown_fox_a_guide_to_http_server2\nCONSTANT_CASE: THE_QUICK_BROWN_FOX_A_GUIDE_TO_HTTP_SERVER2',
    },
    sections: [
      {
        heading: 'Text styles and code styles',
        paragraphs: [
          'Paste text and every style appears at once, each with its own copy button. The text styles are UPPER CASE, lower case, Title Case, Sentence case, Capitalize Each Word, aLtErNaTiNg and iNVERT cASE. The code styles are camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE and dot.case. Line breaks are kept, so you can convert a whole document. Code styles treat each line as its own identifier, which turns a pasted list of column names into a list of variable names in one go.',
          'The code styles first split the input into words, and that step is the difficult part. fooBar, foo_bar, FOO-BAR and "foo bar" all become the words foo and bar. A run of capitals followed by a capitalised word is split before the last capital, so HTTPServer becomes HTTP and Server. Digits stay with the word before them (version2 is one word) and split off in front of a capitalised word (v2Beta becomes v2 and Beta).',
        ],
      },
      {
        heading: 'Title Case follows a style guide',
        paragraphs: [
          'Capitalising every word is not title case. Chicago style keeps articles, coordinating conjunctions and all prepositions in lower case, whatever their length; AP and APA keep only words of three letters or fewer in lower case and capitalise everything of four letters or more. Both always capitalise the first and last word and the first word after a colon, and capitalise both halves of most hyphenated compounds (Well-Known) while leaving small words inside them in lower case (Mother-in-Law). Pick the style in the options.',
          'Acronyms and brand spellings with a capital inside the word (NASA, iPhone, JavaScript) are left as typed, and URLs and email addresses are not touched. If the whole text arrives in capitals, it is normalised first. One honest limit: a tool cannot tell a preposition from an adverb ("Look Up", "Turn Over"), so it applies the word list, and you should still read a headline once before you publish it.',
        ],
      },
      {
        heading: 'Accents, other alphabets and language rules',
        paragraphs: [
          'Conversion uses the Unicode case mappings built into your browser, so accents, Greek and Cyrillic work, and ß becomes SS in upper case as the standard requires. Turkish and Azeri have a dotted and a dotless i, so "istanbul" must become "İSTANBUL" and not "ISTANBUL"; choose the Turkish option to get the right result. Scripts without case, such as Arabic, Urdu, Chinese and emoji, pass through unchanged.',
          'Large texts are converted one style at a time so typing never freezes, and the output panels show a preview while the copy button always copies the full result.',
        ],
      },
    ],
    faq: [
      {
        q: 'What is the difference between Chicago and AP title case?',
        a: 'Chicago lowercases all prepositions, even long ones like "through". AP and APA capitalise any word of four or more letters. Both capitalise the first and last word.',
      },
      {
        q: 'How does it split HTTPServer2 or fooBar?',
        a: 'It splits at lower-to-upper changes and before the last capital of an acronym run, so HTTPServer2 becomes http_server2 in snake_case and fooBar becomes foo_bar.',
      },
      {
        q: 'Why does the Turkish option matter?',
        a: 'In Turkish and Azeri, i upper-cases to İ and I lower-cases to ı. Default case mapping gives the wrong letters for those languages.',
      },
      {
        q: 'Are line breaks preserved?',
        a: 'Yes. Text styles keep every line break as it was, including Windows CRLF. Code styles convert each line to its own identifier.',
      },
      {
        q: 'Is my text sent to a server?',
        a: 'No. All conversion happens in your browser.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'text-diff-checker',
    name: 'Text Diff Checker',
    h1: 'Text Diff Checker: Compare Two Texts by Line, Word or Character',
    title: 'Text Diff Checker: Compare Two Texts Online | Asif Dev',
    description:
      'Compare two texts by line, word or character with side-by-side or unified view, ignore whitespace and case options, and a copyable unified patch.',
    keyword: 'text diff checker',
    category: 'text',
    related: ['regex-tester', 'json-formatter', 'word-counter', 'text-cleaner'],
    example: {
      input: 'Original:\nDear team,\nThe release is on Friday.\nThanks,\nAsif\n\nModified:\nDear team,\nThe release is on Monday.\nPlease review the notes.\nThanks,\nAsif',
      output:
        '--- original\n+++ modified\n@@ -1,4 +1,5 @@\n Dear team,\n-The release is on Friday.\n+The release is on Monday.\n+Please review the notes.\n Thanks,\n Asif',
    },
    sections: [
      {
        heading: 'Three levels of comparison',
        paragraphs: [
          'Paste the original on the left and the changed text on the right. Line mode compares whole lines and is the right choice for code, configuration, logs and lists. Word mode marks only the words that changed inside a paragraph, which suits prose, contracts and documentation. Character mode marks single characters, useful for spotting a typo in an identifier or a changed digit. Character mode compares what a reader sees as one character, so an emoji or an accented letter is never cut in half.',
          'The result can be read side by side, with the original and the modified text next to each other, or as one unified column. Removed text is struck through and added text is underlined, and line views carry a minus or plus marker, so the differences do not depend on telling red from green. Long unchanged stretches are folded to a few lines of context; one switch shows everything.',
        ],
      },
      {
        heading: 'Options and the unified patch',
        paragraphs: [
          'Ignore whitespace treats lines (or, in word and character mode, whitespace) that differ only in spaces, tabs or line breaks as equal, which hides indentation and wrapping noise. Ignore case makes Hello and hello equal. Line endings are normalised, so a file saved with Windows CRLF compares cleanly against one with Unix LF, and a missing final newline is not reported as a change.',
          'The copy button produces a unified patch, the format printed by diff -u and git diff: two header lines and hunks that start with @@ -start,count +start,count @@, followed by lines prefixed with a space, a minus or a plus, with three lines of context. Paste it into a ticket, a code review comment or a chat. When whitespace or case is ignored, the patch describes the lines as they appear in the modified text.',
        ],
      },
      {
        heading: 'How it works and its limits',
        paragraphs: [
          'The comparison uses the jsdiff library, an implementation of the Myers O(ND) algorithm from 1986 that finds a shortest set of insertions and deletions. It runs in your browser and nothing is uploaded. Before the algorithm runs, the identical start and end of the two texts are cut off, which makes the common case of a small edit in a big file instant.',
          'Very large inputs are handled in chunks: word and character mode first compare by line and then look inside only the changed blocks. If two huge texts are almost entirely different, the algorithm would take too long, so after a time limit the tool shows the affected block as replaced as a whole and says so. A diff finds a minimal edit, not the edit a human would call a move: moved paragraphs appear as a removal and an addition.',
        ],
      },
    ],
    faq: [
      {
        q: 'What is the difference between line, word and character diff?',
        a: 'Line mode marks whole lines, word mode marks changed words inside text, and character mode marks single characters. Use lines for code and lists, words for prose, characters for typos.',
      },
      {
        q: 'Why is a moved paragraph shown as removed and added?',
        a: 'Diff algorithms find the smallest set of insertions and deletions, and they do not track moves. A moved block therefore appears once as removed and once as added.',
      },
      {
        q: 'Can it compare Windows and Unix line endings?',
        a: 'Yes. CRLF, LF and CR are all treated as line breaks, so files that differ only in line endings are reported as identical.',
      },
      {
        q: 'What is a unified diff?',
        a: 'The text format of diff -u and git diff: a header, then hunks marked @@ -a,b +c,d @@ with lines starting with a space (unchanged), minus (removed) or plus (added).',
      },
      {
        q: 'Are the texts uploaded?',
        a: 'No. The comparison runs in your browser.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'lorem-ipsum-generator',
    name: 'Lorem Ipsum Generator',
    h1: 'Lorem Ipsum Generator: Paragraphs, Sentences, Words or Bytes',
    title: 'Lorem Ipsum Generator: Paragraphs, Words, Bytes | Asif Dev',
    description:
      'Generate lorem ipsum by paragraphs, sentences, words or bytes as text, HTML or Markdown, with headings and lists. Seedable, and it runs in your browser.',
    keyword: 'lorem ipsum generator',
    category: 'text',
    related: ['word-counter', 'case-converter', 'text-cleaner', 'uuid-generator'],
    example: {
      input: '2 sentences, start with "Lorem ipsum dolor sit amet", seed: demo',
      output: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Atque eveniet ullam doloremque voluptas voluptatum quos ad.',
    },
    sections: [
      {
        heading: 'Choose the amount, the structure and the format',
        paragraphs: [
          'Pick how many paragraphs, sentences, words or bytes you need and the text appears immediately; there is no button to press. Words and bytes are exact: ask for 25 words and you get 25, ask for 4,096 bytes and you get a text of exactly 4,096 bytes, handy for testing database column limits, form validation and upload size checks. Sentences have 6 to 16 words and the longer ones get a comma or two, and paragraphs have 3 to 7 sentences, so the text has a natural rhythm.',
          'When the unit is paragraphs you can also generate headings with paragraphs, a bulleted list or a numbered list. The output format is plain text, HTML (paragraphs in <p>, headings in <h2>, lists in <ul> or <ol>) or Markdown. A toggle starts the text with the classic "Lorem ipsum dolor sit amet, consectetur adipiscing elit". Copy the result or download it as a .txt, .html or .md file.',
        ],
      },
      {
        heading: 'Seeds make placeholder text reproducible',
        paragraphs: [
          'Random filler is a problem in tests and screenshots: the text changes on every run, so snapshot tests fail and designs cannot be compared. Type any seed, for example the name of a page, and the same seed with the same options always gives the same text. Leave the seed empty to get a different text each time you press Generate again. Share the seed and the options with a colleague and they will see the same copy.',
        ],
      },
      {
        heading: 'Where the words come from',
        paragraphs: [
          'Lorem ipsum is not random gibberish. It is a scrambled excerpt of Latin from Cicero\'s De finibus bonorum et malorum, written in 45 BC, in the passage about pain and pleasure that contains the phrase "neque porro quisquam est qui dolorem ipsum quia dolor sit amet". Cicero\'s text is in the public domain. The random sentences here use only words that appear in that passage (about 180 of them); the classic opening line is the familiar altered version and appears only when you switch it on. The sentences are random arrangements of the words and mean nothing.',
          'Designers use it because readers see the shape and weight of a layout instead of reading the text. Do not ship it: search engines and users treat placeholder text on a live page as unfinished work, so search your project for "lorem ipsum" before a release. The generator never repeats a word twice in a row, and everything is created in your browser without any network request.',
        ],
      },
    ],
    faq: [
      {
        q: 'What does lorem ipsum mean?',
        a: 'Nothing. It is a jumbled excerpt of Cicero\'s De finibus bonorum et malorum (45 BC). The first words, "lorem ipsum", come from "dolorem ipsum" ("pain itself") with the start of a word cut off.',
      },
      {
        q: 'Can I get an exact number of bytes?',
        a: 'Yes. Choose bytes and the text has exactly that many UTF-8 bytes. Because the Latin is plain ASCII, bytes equal characters.',
      },
      {
        q: 'How do I get the same text twice?',
        a: 'Enter a seed. The same seed and options always produce identical text, which is useful for tests and design reviews.',
      },
      {
        q: 'Is the generated text safe to use commercially?',
        a: 'The words come from a public domain text from 45 BC and the sentences are generated on your device, so there is nothing to license. Replace it with real copy before publishing.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'slug-generator',
    name: 'Slug Generator',
    h1: 'Slug Generator: Clean URL Slugs from Any Title',
    title: 'Slug Generator: URL Slugs from Text, Accents, Scripts',
    description:
      'Turn titles into URL slugs with accent and script transliteration, separator choice, length limit at a word boundary, stop words and one slug per line.',
    keyword: 'slug generator',
    category: 'text',
    related: ['case-converter', 'word-counter', 'text-cleaner', 'base64-encoder'],
    example: {
      input: 'Über große Brücken: 10 Tips & Tricks\nПривет, мир!\nCrème brûlée à la française\nCrème brûlée à la française',
      output: 'uber-grosse-brucken-10-tips-and-tricks\nprivet-mir\ncreme-brulee-a-la-francaise\ncreme-brulee-a-la-francaise-2',
    },
    sections: [
      {
        heading: 'What the generator does',
        paragraphs: [
          'A slug is the human-readable part of a URL, such as how-to-build-a-rest-api. The tool lowercases the text, removes accents (é becomes e, ñ becomes n, ş becomes s, ł becomes l), turns every run of other symbols into one separator, drops apostrophes so "don\'t" becomes "dont", and replaces & with "and". Choose a hyphen, underscore, dot or no separator, a maximum length that is cut at a whole word, and whether to remove English stop words such as "the" and "of".',
          'Paste many lines to get one slug per line, aligned with your input. With unique suffixes on, repeated titles become title, title-2, title-3, and the suffix always fits inside your length limit. That makes the tool useful for a spreadsheet of article titles or a product import.',
        ],
      },
      {
        heading: 'Transliteration and its honest limits',
        paragraphs: [
          'Latin letters with diacritics are converted for German, French, Spanish, Turkish, Polish and other languages; choose the German option to write ä, ö and ü as ae, oe and ue instead of a, o and u. Cyrillic is converted with a Russian, Ukrainian or Serbian table, chosen automatically from letters only one of them uses, and Greek is supported. Arabic, Persian and Urdu get a basic mapping.',
          'Arabic script leaves out short vowels, so the result is a consonant skeleton: محمد becomes mhmd, not Muhammad. It is readable enough for a slug but it is not a proper romanisation, so for important pages write the slug in English. Scripts without a mapping, such as Chinese, Japanese, Korean and Hindi, are dropped and listed in a warning; switch off "Convert to ASCII" to keep their letters in a Unicode slug.',
        ],
      },
      {
        heading: 'Slug rules from Google Search Central',
        paragraphs: [
          'Google\'s URL structure guidance recommends hyphens instead of underscores to separate words, because hyphens clearly signal a word boundary. It notes that URLs are case sensitive, so if your server treats different cases the same, you should convert everything to one case. It asks for readable words rather than long ID numbers, in the language your audience searches in, and says that characters outside ASCII should be percent-encoded, for example /gem%C3%BCse for Gemüse. Browsers do the encoding when you link to a Unicode slug.',
          'The same guidance says nothing about a maximum length or about removing stop words, so this tool offers them as style choices, not as ranking advice. Shorter slugs are easier to read, say and share, and a slug that matches the page title is easy to recognise. Whatever you choose, keep a slug stable: if a published URL changes, redirect the old one.',
        ],
      },
    ],
    faq: [
      {
        q: 'Should slugs use hyphens or underscores?',
        a: 'Hyphens. Google Search Central recommends hyphens because they clearly signal a word boundary, while underscores are commonly used to keep words together in code.',
      },
      {
        q: 'Should I keep non-English letters in the slug?',
        a: 'You can. Google says non-ASCII characters should be percent-encoded in URLs, and browsers do that for you. An ASCII transliteration is shorter to read in a link and easier to type; either way, use words your audience searches for.',
      },
      {
        q: 'Why did my Arabic or Urdu slug lose its vowels?',
        a: 'These scripts do not write short vowels, so the tool can only map the consonants. For readable URLs write the slug in English or keep the original letters.',
      },
      {
        q: 'Do stop words and short slugs improve rankings?',
        a: 'Google\'s URL guidance does not mention either, so the options are for readability, not for ranking. Pick what reads well and keep URLs stable.',
      },
      {
        q: 'Is anything uploaded?',
        a: 'No. Conversion happens in your browser.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'text-cleaner',
    name: 'Text Cleaner',
    h1: 'Text Cleaner: Sort, Deduplicate, Trim, Split and Extract Lines',
    title: 'Remove Duplicate Lines, Sort and Clean Text | Asif Dev',
    description:
      'Remove duplicate lines, sort A-Z or numerically, trim, drop empty lines, split, join and extract emails or links with a step pipeline in your browser.',
    keyword: 'remove duplicate lines',
    category: 'text',
    related: ['word-counter', 'case-converter', 'text-diff-checker', 'regex-tester'],
    example: {
      input: 'banana\n  Apple \n\ncherry\napple\nBanana\n  cherry\n(steps: trim, remove empty lines, remove duplicates ignoring case, sort A to Z)',
      output: 'Apple\nbanana\ncherry',
    },
    sections: [
      {
        heading: 'A pipeline of line operations',
        paragraphs: [
          'Most text cleanup is a handful of small jobs done in the right order: trim the spaces, drop the blank lines, remove the duplicates, sort what is left. Here each job is a step. Add steps from the list, move them up or down, remove them, and the result updates as you type. The panel under the result shows how many lines each step removed or added, so you can see where a line went.',
          'The available steps are trim (both ends, start or end), collapse repeated spaces and tabs, remove empty lines (optionally those with only spaces), remove duplicate lines, sort, reverse the order, add a prefix and a suffix, split lines at a separator, join lines with a separator, and extract emails, links or numbers. Ready-made pipelines cover the common cases such as cleaning a list, pulling emails out of a block of text or turning a comma separated list into lines.',
        ],
      },
      {
        heading: 'Duplicates and sorting in detail',
        paragraphs: [
          'Duplicate removal keeps the first or the last occurrence and can ignore case and the spaces around a line. Order matters: trim before you remove duplicates, or "apple" and "apple " count as different lines. Sorting offers A to Z and Z to A with accents and case handled the way a dictionary would, natural order (file2 before file10), numeric order by the number a line starts with (decimals, negatives and thousands commas included; lines without a number go last), by length, and a random shuffle you can repeat.',
          'Everything works on text that uses Windows (CRLF), Unix (LF) or old Mac (CR) line endings. If your input uses CRLF throughout, the output does too. Emoji, right-to-left text and accented letters are kept as they are.',
        ],
      },
      {
        heading: 'Extracting emails, links and numbers: the limits',
        paragraphs: [
          'The extract step uses simple patterns on purpose. An email needs a name, an @ sign and a domain with a dot and at least two letters; quoted names, comments and address literals allowed by the full email standard are not recognised. A link starts with http://, https:// or www., ends at the next space or quote, and has trailing punctuation removed (balanced brackets in a Wikipedia address are kept). A number can have a sign, thousands commas, decimals and an exponent, and only ASCII digits are read, so 1.234,56 in European style is two numbers, not one.',
          'These patterns find the usual cases, not every valid one, so check anything important by eye. Add a remove-duplicates step after extraction to get a unique list. Large inputs of hundreds of thousands of lines work, but sorting a huge list takes a few seconds and the page shows a working message meanwhile. Nothing is uploaded, because everything runs in your browser.',
        ],
      },
    ],
    faq: [
      {
        q: 'How do I remove duplicate lines but keep the original order?',
        a: 'Add the remove duplicate lines step and keep the first occurrence; the lines that remain stay in their original order. Do not add a sort step.',
      },
      {
        q: 'Why do "apple" and "apple " survive as different lines?',
        a: 'Lines are compared exactly. Add a trim step before it, or switch on "Ignore spaces around lines" in the duplicate step.',
      },
      {
        q: 'What is natural sort?',
        a: 'It reads digit runs as numbers, so file2 comes before file10. A plain A to Z sort would put file10 first because 1 sorts before 2.',
      },
      {
        q: 'Does the email extractor find every valid address?',
        a: 'No. It finds ordinary addresses (name, @, domain with a dot). Unusual forms allowed by the email standard, such as quoted names, are not matched.',
      },
      {
        q: 'Can I clean a very large file?',
        a: 'Files up to 20 MB can be loaded and several hundred thousand lines work, but sorting a huge list takes a few seconds. Nothing is uploaded.',
      },
    ],
    updatedAt: '2026-11-05',
  },
];
