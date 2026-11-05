import type { ToolMeta } from '../tools.manifest.js';

/** documents tools: manifest entries only (copy, SEO, FAQs). Keep the only import the type above: the backend keeps a verbatim copy. */
export const DOCUMENT_TOOLS: ToolMeta[] = [
  {
    slug: 'docx-viewer',
    name: 'DOCX Viewer',
    h1: 'DOCX Viewer: Open a Word Document in Your Browser',
    title: 'DOCX Viewer: Open Word Files Online | Asif Dev',
    description:
      'Open a .docx file without Word: see headings, lists, tables and images, copy the text, or save it as HTML or plain text. Nothing is uploaded.',
    keyword: 'docx viewer online',
    category: 'documents',
    related: ['markdown-viewer', 'pdf-viewer', 'pptx-viewer', 'json-formatter'],
    example: {
      input: 'proposal.docx (3 pages: one heading, two bullet lists, a 4-column pricing table, one PNG logo)',
      output:
        'Document view with the heading, both lists and the table. 612 words, 3,904 characters, 1 image, 1 table. Warnings: none. Download as .html or .txt.',
    },
    sections: [
      {
        heading: 'How to use the viewer',
        paragraphs: [
          'Drop a .docx file onto the file box or pick it with the button. The document appears at once, with headings, bold and italic text, numbered and bulleted lists, tables and inline pictures. Switch between the Document view, which keeps the structure, and the Text-only view, which shows plain text that is easy to read and select. The counts above the result give words, characters, images and tables, which is handy when you need a quick size check on a contract, a brief or a manuscript.',
          'From there you can copy the text to the clipboard, download a standalone HTML file that opens in any browser, or download a plain .txt file. The HTML download is a reasonable way to move content into a CMS or an email template, because you get clean headings, paragraphs and tables instead of Word\'s styling.',
        ],
      },
      {
        heading: 'How the conversion works',
        paragraphs: [
          'A .docx file is a zip archive of XML parts. The viewer uses the mammoth library to read the document body and convert Word paragraph styles such as Heading 1 into semantic HTML. The result is then passed through DOMPurify before it is displayed, so scripts and event handlers in a hostile file cannot run. Everything happens in your browser; the file is read locally and no request is made with its contents.',
          'Pictures embedded in the file are turned into data URLs so they show inline. Only PNG, JPEG, GIF, WebP and BMP images are shown. Vector formats that Word commonly uses, such as EMF and WMF, cannot be displayed by a browser, so they are skipped and counted instead. Links open only if they use http, https or mailto. Anything mammoth could not convert cleanly is listed in a collapsible warnings note, which is worth opening when a document looks wrong.',
        ],
      },
      {
        heading: 'Limits and what to expect',
        paragraphs: [
          'This is a reader, not a layout engine. Exact Word layout is not reproduced: fonts, page size and margins, headers and footers, comments, tracked changes, multi-column sections, text boxes, floating shapes and equations are dropped or simplified. Internal bookmarks and footnote links are shown as text but are not clickable. If you need to see precisely how a page will print, open the file in Word or export it to PDF and use the PDF viewer.',
          'The legacy .doc format and password-protected .docx files are not supported, and the viewer says so instead of showing garbage. Files up to about 25 MB are accepted. For a file that looks incomplete, check the warnings first, then check whether the missing content lives in a text box or a header, since those are the usual places where text goes missing.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is my document uploaded?',
        a: 'No. The file is read and converted in your browser, and nothing is sent to a server.',
      },
      {
        q: 'Will it look exactly like it does in Word?',
        a: 'No. It reproduces the content and basic structure (headings, lists, tables, images), not fonts, page layout, headers, footers or text boxes.',
      },
      {
        q: 'Can it open an old .doc file or a password-protected file?',
        a: 'No. Only the modern .docx format is supported, and encrypted files cannot be read. Save a .doc as .docx in Word or LibreOffice first.',
      },
      {
        q: 'Why are some pictures missing?',
        a: 'Browsers can only show PNG, JPEG, GIF, WebP and BMP. Images stored as EMF or WMF are skipped and counted in the image summary.',
      },
      {
        q: 'What is the size limit?',
        a: 'About 25 MB. Larger files are rejected with a message so the page does not run out of memory.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'pdf-viewer',
    name: 'PDF Viewer',
    h1: 'PDF Viewer with Search and Text Extraction',
    title: 'PDF Viewer: Search and Extract Text | Asif Dev',
    description:
      'View a PDF in your browser with page thumbnails, zoom and full-text search, and extract all its text. Handles password-protected PDFs. Nothing is uploaded.',
    keyword: 'pdf viewer online',
    category: 'documents',
    related: ['docx-viewer', 'pdf-to-images', 'merge-pdf', 'split-pdf'],
    example: {
      input: 'annual-report.pdf (212 pages, 6.4 MB), search for "revenue"',
      output:
        '37 matches across 21 pages. Match 1 of 37 highlighted on page 4. Document info: 212 pages, producer "LibreOffice 7.6", PDF 1.7, 6.4 MB.',
    },
    sections: [
      {
        heading: 'Reading a PDF page by page',
        paragraphs: [
          'Open a PDF and the viewer shows one page at a time with previous and next buttons, a box to jump to a page number and the left and right arrow keys. A thumbnail list on the side renders lazily, so only the thumbnails you scroll to are drawn. Zoom runs from 50 to 300 percent, with a fit-to-width option that suits phones and narrow windows.',
          'Showing a single page keeps the viewer light. Rendering all 500 pages of a manual at once would use a lot of memory, so the viewer draws the current page and frees the memory again when you move on. Document info lists the page count, title, author, creator, producer, creation and modification dates, PDF version and file size, which is useful when you need to know which tool produced a file.',
        ],
      },
      {
        heading: 'Search and text extraction',
        paragraphs: [
          'Type a word in the search box and the viewer scans the text of every page, reports how many matches it found, and highlights them on the current page. Use next and previous match to jump between hits, even across pages. Highlight positions are approximate for PDFs that use unusual fonts or heavily custom spacing, so treat the box as a pointer to the spot rather than a pixel-exact outline.',
          'Extract text gives you the text of the whole document in page order, which you can copy or download as a .txt file. That is the way to get text out, because text selection directly on the rendered page is not available. Layout is lost in extraction: columns, tables and headers can come out in reading order that differs from what you see, so check the result before using it in a script.',
        ],
      },
      {
        heading: 'Limits, passwords and scanned files',
        paragraphs: [
          'The viewer uses Mozilla pdf.js, the same engine behind Firefox\'s built-in reader. If a PDF is password-protected, a password box appears; the password is used only by pdf.js on your device. A corrupt file or a file that is not a PDF gives a plain message instead of a blank page. Files up to about 100 MB are accepted, and the whole file is read into browser memory, so a very large file on a phone may be slow.',
          'A scanned PDF is usually just pictures of pages. It has no text layer, so search finds nothing and extraction returns nothing, because the tool does not do OCR. Forms, annotations and embedded JavaScript are not interactive here. If search works in your desktop reader but not here, the file probably stores its text in a way that is hard to read; try extracting the text to see what is actually there.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is my PDF uploaded?',
        a: 'No. pdf.js renders the file locally in your browser, and nothing is sent to a server. A password you type is used only by pdf.js on your device.',
      },
      {
        q: 'Why does search find nothing in my PDF?',
        a: 'It is probably a scan: the pages are images with no text layer. This viewer has no OCR, so there is no text to search or extract.',
      },
      {
        q: 'Can I select text on the page?',
        a: 'Not directly on the page. Use search to find a phrase, or Extract text to copy or download all of it.',
      },
      {
        q: 'Can it open password-protected PDFs?',
        a: 'Yes, if you know the password. A box appears and the password is used only by pdf.js in your browser.',
      },
      {
        q: 'Are form fields and links interactive?',
        a: 'No. Forms, annotations and JavaScript inside a PDF are not interactive in this viewer; it is for reading, searching and extracting text.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'xlsx-viewer',
    name: 'XLSX Viewer',
    h1: 'XLSX Viewer: Browse an Excel File Online',
    title: 'XLSX Viewer: Open Excel Files Online | Asif Dev',
    description:
      'Browse .xlsx sheets in your browser with sorting, search, and CSV or JSON export of the current sheet. No Excel needed, nothing is uploaded.',
    keyword: 'xlsx viewer online',
    category: 'documents',
    related: ['csv-viewer', 'excel-to-json', 'json-formatter', 'docx-viewer'],
    example: {
      input: 'orders.xlsx: sheets "Orders" (8,420 rows x 9 columns) and "Customers", search "pending", sort by Total',
      output:
        'Orders: 8,420 rows, 9 columns. Filter "pending" leaves 312 rows, sorted by Total. Download CSV or JSON of those 312 rows.',
    },
    sections: [
      {
        heading: 'Browsing a workbook',
        paragraphs: [
          'Choose an .xlsx file and each worksheet appears as a tab. The grid is virtualised: only the rows and columns on screen are drawn, so a sheet with more than 100,000 cells scrolls smoothly instead of freezing the page. Column widths are set automatically, and you can switch between Narrow, Auto and Wide when long text gets cut off. The first row can be treated as a header or as ordinary data with one toggle, and the row and column counts update to match.',
          'Click a column header to sort it, and use the search box to filter rows that contain your text in any cell. Sorting and filtering do not change the file. They change the view, which is also what the export uses.',
        ],
      },
      {
        heading: 'Exporting the current sheet',
        paragraphs: [
          'Download the current sheet as CSV or JSON. The export respects the filter and the sort, so if you searched for one customer and sorted by date, you get exactly those rows in that order. That makes the viewer a quick way to move spreadsheet data into a script, a Mongo import or a test fixture without opening Excel. Paste the JSON into the JSON formatter or turn it into TypeScript interfaces with the related tools.',
          'Dates come out as ISO dates, for example 2026-03-14, which is easier for code to read than the display format Excel used. When you export to CSV, remember that the target program decides how to read each column: an id such as 00123 is kept as text here, but may lose its leading zeros if you reopen the CSV in Excel.',
        ],
      },
      {
        heading: 'What it does not show',
        paragraphs: [
          'The viewer reads the file with the read-excel-file library and shows the values Excel last saved. Formulas are not recalculated, so you see the cached result; if a workbook was generated by a script that never calculated its formulas, those cells can be empty. Charts, images, conditional formatting, cell colours and fonts, merged-cell layout, pivot tables and macros are not displayed.',
          'Only the modern .xlsx format is supported. Legacy .xls and the binary .xlsb format cannot be opened, so re-save them as .xlsx first. Files up to about 30 MB are accepted, and the whole sheet is held in memory, so very large workbooks may be slow on a phone. If a number looks different from what you see in Excel, the cause is usually number formatting, since the viewer shows the stored value rather than the formatted text.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is my spreadsheet uploaded?',
        a: 'No. The workbook is read and displayed in your browser. Nothing is sent to a server.',
      },
      {
        q: 'Why is a formula cell empty or showing an old value?',
        a: 'The viewer shows the result Excel saved last and does not recalculate formulas. Open and save the file in Excel or LibreOffice to refresh the stored results.',
      },
      {
        q: 'Can it open .xls or .xlsb files?',
        a: 'No. Only .xlsx (Excel 2007 and later) is supported. Re-save older files as .xlsx first.',
      },
      {
        q: 'Does the export include my filter and sort?',
        a: 'Yes. The CSV and JSON downloads contain the rows currently visible, in the current order, for the selected sheet.',
      },
      {
        q: 'Does it show charts or colours?',
        a: 'No. Charts, images, conditional formatting, cell colours, fonts, merged-cell layout and pivot tables are not displayed, only the cell values.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'csv-viewer',
    name: 'CSV Viewer',
    h1: 'CSV Viewer: Open and Inspect Large CSV Files',
    title: 'CSV Viewer: Open Large CSV Files Online | Asif Dev',
    description:
      'Open CSV, TSV and delimited text files in your browser with auto delimiter detection, sorting, filtering and export to CSV or JSON. Nothing is uploaded.',
    keyword: 'csv viewer online',
    category: 'documents',
    related: ['xlsx-viewer', 'csv-to-json', 'json-to-csv', 'json-formatter'],
    example: {
      input: 'users.csv\nid;name;city\n1;Asif;Lahore\n2;"Sara; Jr.";Karachi\n3;Omar',
      output:
        'Delimiter detected: semicolon. 3 rows, 3 columns. Row 3 has 2 fields instead of 3. Row 2 keeps "Sara; Jr." as one cell.',
    },
    sections: [
      {
        heading: 'Opening a delimited file',
        paragraphs: [
          'Pick a .csv, .tsv or .txt file and the viewer parses it with Papa Parse. It tries comma, semicolon, tab and pipe, picks the delimiter that fits best, and lets you override the choice when the guess is wrong. Spreadsheet exports from Excel in many European locales use semicolons, while database dumps often use tabs or pipes, so the override matters. Choose the encoding as well: UTF-8, Windows-1252, ISO-8859-1 or UTF-16. If accented letters appear as odd symbols, switch from UTF-8 to Windows-1252 and the text usually becomes right.',
          'Toggle whether the first row is a header, click a column header to sort, and type in the filter box to keep only rows containing your text. The viewer shows how many rows match. The grid is virtualised, so only visible rows are drawn, and the file is read in chunks so the page stays responsive while it loads.',
        ],
      },
      {
        heading: 'Quoting, bad rows and data checks',
        paragraphs: [
          'Quoted fields, doubled quotes, newlines inside a quoted cell and a byte order mark at the start of the file are all handled. A cell such as "Sara; Jr." stays one cell even when the delimiter is a semicolon. The viewer also reports rows whose number of fields differs from the header, which is the quickest way to find a stray delimiter, an unescaped quote or a truncated line in an export before it breaks an import.',
          'All values are shown as text. There is no type inference, so 00123 keeps its zeros and 1e5 is not turned into a number. That is deliberate for inspection, but remember it when you reuse the data: your importer decides whether a column is a number, a date or a string. Export the filtered and sorted rows as CSV or JSON to hand a clean subset to a script, a Mongo import or a test fixture.',
        ],
      },
      {
        heading: 'Size limits and performance',
        paragraphs: [
          'Files up to 100 MB are accepted, with a warning above 25 MB because everything is held in memory. Sorting is available up to 300,000 rows; beyond that you can still scroll, filter and export, but sorting is switched off so the page does not stall. Very large files can be slow on phones and low-memory laptops, in which case split the file or filter it with a command-line tool first.',
          'The viewer does not edit anything. It is a read-only inspector, so the original file is never changed. For an Excel file use the XLSX viewer instead, since csv has no sheets, formulas or formatting. When a CSV from a spreadsheet looks wrong, check the delimiter, the encoding and the row-length report first, in that order.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is my file uploaded?',
        a: 'No. The file is read and parsed in your browser, and nothing is sent to a server.',
      },
      {
        q: 'How does it choose the delimiter?',
        a: 'It tests comma, semicolon, tab and pipe and picks the best fit. You can override the choice manually if the guess is wrong.',
      },
      {
        q: 'Why do accented letters look broken?',
        a: 'The file probably is not UTF-8. Switch the encoding to Windows-1252 or ISO-8859-1 and the text should display correctly.',
      },
      {
        q: 'How large a file can it open?',
        a: 'Up to 100 MB, with a warning above 25 MB. Sorting works up to 300,000 rows. The file is held in memory, so very large files can be slow on phones.',
      },
      {
        q: 'Does it convert numbers and dates?',
        a: 'No. Every value is shown as text, so leading zeros and long ids stay exactly as in the file.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'pptx-viewer',
    name: 'PPTX Viewer',
    h1: 'PPTX Viewer: Read Slide Text, Notes and Images',
    title: 'PPTX Viewer: Read PowerPoint Text and Notes | Asif Dev',
    description:
      'Open a .pptx deck in your browser and list each slide with its title, text, tables, speaker notes and images. Export text or Markdown. No upload.',
    keyword: 'pptx viewer online',
    category: 'documents',
    related: ['docx-viewer', 'pdf-viewer', 'markdown-viewer', 'xlsx-viewer'],
    example: {
      input: 'launch-plan.pptx (12 slides, speaker notes on 5, 3 pictures)',
      output:
        '12 slides. Slide 1: "Q4 Launch Plan" ... Slide 7: title, 4 bullets, notes "Mention the pilot customers". Download as .txt or .md.',
    },
    sections: [
      {
        heading: 'What the viewer shows',
        paragraphs: [
          'Drop a .pptx file and the viewer lists every slide in order. Each slide shows its title, its body text, any tables, the speaker notes and embedded pictures as thumbnails, with the slide count at the top. It is built for reading and reusing the content of a deck: finding what a slide says, pulling the notes out, or checking an inherited presentation without installing PowerPoint.',
          'Copy all text to the clipboard, or download it as plain text or Markdown. The Markdown export puts each slide under its own heading, with lists and tables in Markdown form, so you can paste a talk outline into documentation or a README and edit it with the Markdown viewer.',
        ],
      },
      {
        heading: 'How the file is read',
        paragraphs: [
          'A .pptx file is a zip archive of XML files, one per slide plus parts for notes, relationships and media. The viewer unpacks the archive in your browser with the fflate library, reads the slide order from the presentation part, and walks each slide\'s XML for text and tables. Nothing is sent over the network.',
          'Pictures are shown only when they are PNG, JPEG, GIF, WebP or BMP, because those are the formats a browser can draw. Other image types are not shown. Slides appear in the order the deck defines, not in the order of file names inside the archive, which differ in decks where slides were reordered or deleted.',
        ],
      },
      {
        heading: 'Limits to know about',
        paragraphs: [
          'This shows content and structure, not pixel-perfect slides. Themes, layouts, animations, transitions, shapes, fonts, charts and SmartArt are not rendered. Text that lives inside a chart, SmartArt or a grouped image may be missing from the output, so a slide that looks full in PowerPoint can look sparse here. If you need the exact look of a slide, export the deck to PDF from PowerPoint and open it in the PDF viewer.',
          'The old .ppt format and password-protected files are not supported, and a plain message tells you so. Files up to about 50 MB are accepted. A common pitfall is a deck made mostly of screenshots: the text is in the pictures, so the extracted text will be short. In that case the thumbnails are the only record of what is on the slide, and there is no OCR to read them.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is my presentation uploaded?',
        a: 'No. The file is unpacked and read in your browser, and nothing is sent to a server.',
      },
      {
        q: 'Does it show slides exactly as they look in PowerPoint?',
        a: 'No. It shows text, tables, notes and images in order, but not themes, layouts, animations, shapes, fonts, charts or SmartArt.',
      },
      {
        q: 'Can it read speaker notes?',
        a: 'Yes. Notes are listed under each slide and included in the plain-text and Markdown downloads.',
      },
      {
        q: 'Why is text missing from some slides?',
        a: 'Text inside charts, SmartArt or grouped images is not always extracted, and text baked into screenshots is not readable without OCR.',
      },
      {
        q: 'Does it support .ppt or protected files?',
        a: 'No. Only the modern .pptx format without a password works, up to about 50 MB.',
      },
    ],
    updatedAt: '2026-11-05',
  },
  {
    slug: 'markdown-viewer',
    name: 'Markdown Viewer',
    h1: 'Markdown Viewer and Live Preview Editor',
    title: 'Markdown Viewer: Live Preview Editor | Asif Dev',
    description:
      'Write or open Markdown and see a live GitHub-style preview with tables and task lists. Copy or download as .md or .html. Runs in your browser.',
    keyword: 'markdown viewer online',
    category: 'documents',
    related: ['markdown-to-html', 'docx-viewer', 'pptx-viewer', 'json-formatter'],
    example: {
      input: '# Release notes\n\n- [x] Fix login\n- [ ] Add export\n\n| Tool | Status |\n|---|---|\n| CSV | done |',
      output:
        'Preview: a heading, a task list with one ticked box, and a two-column table. 93 characters, 8 lines, reading time under 1 min.',
    },
    sections: [
      {
        heading: 'Edit on the left, read on the right',
        paragraphs: [
          'Type or paste Markdown in the editor and the preview updates a moment after you stop typing, so long documents stay responsive. You can also open a .md, .markdown or .txt file up to 5 MB. The renderer is marked with GitHub Flavored Markdown switched on, so tables, task lists, strikethrough, automatic links and fenced code blocks behave the way they do in a README on GitHub.',
          'A status line shows word, character and line counts and an estimated reading time based on about 200 words per minute, which is a rough guide rather than a measurement. Copy the Markdown or the rendered HTML, or download a .md file or a standalone .html page that you can open anywhere.',
        ],
      },
      {
        heading: 'Safe by default',
        paragraphs: [
          'Markdown allows raw HTML, which is a risk when the text comes from someone else. The preview is cleaned with DOMPurify in strict mode: scripts, event handler attributes and similar tricks are removed before anything is shown. Links open in a new tab, and only for http, https and mailto addresses.',
          'Remote images are not loaded. For privacy, an image that points to another website is shown as its alt text, because loading it would send a request to a third party the moment you paste a document. Images embedded as data: URLs do show. If you paste a README that relies on badges or screenshots hosted elsewhere, expect to see only the alt text in the preview even though it will render on the site that hosts it.',
        ],
      },
      {
        heading: 'Limits and common pitfalls',
        paragraphs: [
          'Code blocks are shown in plain monospace without syntax colouring. Mermaid diagrams, maths notation and footnotes are not supported, and front matter at the top of a file, the YAML block between two lines of three dashes used by static site generators, is displayed as ordinary text. Heading ids and some extensions used by specific platforms may also differ from what you get elsewhere, since Markdown has several dialects.',
          'The most common surprises are small. A list needs a blank line before it in some cases, a table needs its header separator row, and a single line break inside a paragraph does not start a new line unless you end the line with two spaces or a backslash. If the preview looks different from your target platform, check these before assuming the tool is wrong.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is my text uploaded?',
        a: 'No. Rendering and sanitising happen in your browser. Nothing is sent to a server.',
      },
      {
        q: 'Why do my images not appear?',
        a: 'Remote images are not loaded, for privacy. They appear as alt text. Images embedded as data: URLs do show.',
      },
      {
        q: 'Does it support GitHub Flavored Markdown?',
        a: 'Yes: tables, task lists, strikethrough, autolinks and fenced code blocks. Syntax colouring, Mermaid, maths and footnotes are not supported.',
      },
      {
        q: 'Is raw HTML in my Markdown allowed?',
        a: 'It is cleaned. Scripts and event handlers are removed, and only safe markup is kept in the preview.',
      },
      {
        q: 'What is the file size limit?',
        a: 'Files up to 5 MB can be opened. You can also paste text directly into the editor.',
      },
    ],
    updatedAt: '2026-11-05',
  },
];
