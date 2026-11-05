import { IMAGE_TYPES, MB, bytesToBase64, countWords, extensionOf, isOleOffice, isZip } from '../shared/doc-utils';

export const PPTX_MAX_MB = 50;
/** One embedded picture bigger than this is skipped (and counted). */
const MAX_IMAGE_BYTES = 5 * MB;
/** All pictures together; past this, further pictures are skipped (and counted). */
const MAX_TOTAL_IMAGE_BYTES = 40 * MB;
/** An XML part that inflates beyond this is refused (guards against zip bombs). */
const MAX_XML_BYTES = 30 * MB;
const MAX_INFLATED_BYTES = 250 * MB;

export class PptxError extends Error {}

export interface PptxParagraph {
  text: string;
  level: number;
  bullet: boolean;
}

export interface PptxImage {
  src: string;
  alt: string;
}

export interface PptxSlide {
  number: number;
  title: string;
  body: PptxParagraph[];
  /** Each table is rows of cell text. */
  tables: string[][][];
  notes: string;
  images: PptxImage[];
  /** Pictures in formats a browser cannot show, or too large to embed. */
  skippedImages: number;
  /** Charts and diagrams: their content is not read. */
  skippedObjects: number;
}

export interface PptxDeck {
  slides: PptxSlide[];
  stats: { slides: number; words: number; images: number; tables: number; notes: number; skippedImages: number; skippedObjects: number };
}

export function checkPptxBytes(head: Uint8Array): void {
  if (head.length === 0) throw new PptxError('This file is empty.');
  if (isOleOffice(head)) {
    throw new PptxError(
      'This looks like an older PowerPoint file (.ppt) or a password-protected presentation. Save it as .pptx (without a password) and open that.',
    );
  }
  if (!isZip(head)) throw new PptxError('This is not a .pptx file. A .pptx is a ZIP package that PowerPoint saves; this file is something else.');
}

// ── XML helpers ────────────────────────────────────────────────────────────────

function parseXml(bytes: Uint8Array | undefined): Document | null {
  if (!bytes) return null;
  const doc = new DOMParser().parseFromString(new TextDecoder('utf-8').decode(bytes), 'application/xml');
  return doc.getElementsByTagName('parsererror').length ? null : doc;
}

const local = (el: Element): string => el.localName;
const kids = (el: Element, name?: string): Element[] => Array.from(el.children).filter((c) => !name || local(c) === name);
const all = (el: Element | Document, name: string): Element[] => Array.from(el.getElementsByTagNameNS('*', name));
const first = (el: Element, name: string): Element | undefined => all(el, name)[0];
const attr = (el: Element | undefined, name: string): string => el?.getAttribute(name) ?? '';

/** Resolves a relationship target ("../media/a.png") against the folder of the part that holds it. */
export function resolveTarget(baseDir: string, target: string): string {
  if (/^[a-z]+:/i.test(target)) return '';
  const parts = (target.startsWith('/') ? target.slice(1) : `${baseDir}${target}`).split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else if (part && part !== '.') out.push(part);
  }
  return out.join('/');
}

/** rId -> resolved part path for a .rels file. */
function relationships(bytes: Uint8Array | undefined, baseDir: string): Map<string, string> {
  const map = new Map<string, string>();
  const doc = parseXml(bytes);
  if (!doc) return map;
  for (const rel of all(doc, 'Relationship')) {
    if (attr(rel, 'TargetMode') === 'External') continue;
    map.set(attr(rel, 'Id'), resolveTarget(baseDir, attr(rel, 'Target')));
  }
  return map;
}

/** Text of one <a:p>: runs and fields in order, <a:br> as a line break. */
function paragraphText(p: Element): string {
  let out = '';
  for (const child of kids(p)) {
    const name = local(child);
    if (name === 'r' || name === 'fld') out += kids(child, 't').map((t) => t.textContent ?? '').join('');
    else if (name === 'br') out += '\n';
  }
  return out;
}

function paragraphsOf(txBody: Element | undefined, placeholderBody: boolean): PptxParagraph[] {
  if (!txBody) return [];
  return kids(txBody, 'p')
    .map((p) => {
      const pPr = kids(p, 'pPr')[0];
      const hasBullet = !!pPr && kids(pPr).some((c) => ['buChar', 'buAutoNum', 'buBlip'].includes(local(c)));
      const noBullet = !!pPr && kids(pPr).some((c) => local(c) === 'buNone');
      return {
        text: paragraphText(p).replace(/[\u000b\r]/g, '\n').trim(),
        level: Math.min(8, Number(attr(pPr, 'lvl')) || 0),
        bullet: hasBullet || (placeholderBody && !noBullet),
      };
    })
    .filter((p) => p.text !== '');
}

// ── slide parsing ──────────────────────────────────────────────────────────────

interface ZipFiles {
  [name: string]: Uint8Array;
}

function parseSlide(number: number, path: string, files: ZipFiles, imageBudget: { used: number }, imageCache: Map<string, string>): PptxSlide {
  const dir = path.slice(0, path.lastIndexOf('/') + 1);
  const relsPath = `${dir}_rels/${path.slice(dir.length)}.rels`;
  const rels = relationships(files[relsPath], dir);
  const doc = parseXml(files[path]);
  const slide: PptxSlide = { number, title: '', body: [], tables: [], notes: '', images: [], skippedImages: 0, skippedObjects: 0 };
  if (!doc) return slide;

  const tree = all(doc, 'spTree')[0];
  const titles: string[] = [];

  const visit = (parent: Element): void => {
    for (const el of kids(parent)) {
      switch (local(el)) {
        case 'grpSp':
          visit(el);
          break;
        case 'sp': {
          const ph = first(el, 'ph');
          const type = attr(ph, 'type');
          if (['sldNum', 'dt', 'ftr', 'hdr'].includes(type)) break;
          const isTitle = type === 'title' || type === 'ctrTitle';
          const paragraphs = paragraphsOf(kids(el, 'txBody')[0], !!ph && !isTitle && (type === '' || type === 'body'));
          if (isTitle) titles.push(paragraphs.map((p) => p.text.replace(/\s*\n\s*/g, ' ')).join(' '));
          else slide.body.push(...paragraphs);
          break;
        }
        case 'graphicFrame': {
          const table = first(el, 'tbl');
          if (table) {
            slide.tables.push(
              kids(table, 'tr').map((tr) =>
                kids(tr, 'tc').map((tc) =>
                  paragraphsOf(kids(tc, 'txBody')[0], false)
                    .map((p) => p.text.replace(/\s*\n\s*/g, ' '))
                    .join(' '),
                ),
              ),
            );
          } else {
            const uri = attr(first(el, 'graphicData'), 'uri');
            if (/\/(chart|diagram)$/.test(uri)) slide.skippedObjects++;
          }
          break;
        }
        case 'pic': {
          const blip = first(el, 'blip');
          const target = rels.get(attr(blip, 'r:embed') || (blip?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed') ?? ''));
          const cNvPr = first(el, 'cNvPr');
          const alt = attr(cNvPr, 'descr') || attr(cNvPr, 'title') || '';
          const type = target ? IMAGE_TYPES[extensionOf(target)] : undefined;
          const bytes = target ? files[target] : undefined;
          if (!target || !type || !bytes || bytes.length > MAX_IMAGE_BYTES || imageBudget.used + bytes.length > MAX_TOTAL_IMAGE_BYTES) {
            slide.skippedImages++;
            break;
          }
          let src = imageCache.get(target);
          if (!src) {
            src = `data:${type};base64,${bytesToBase64(bytes)}`;
            imageCache.set(target, src);
            imageBudget.used += bytes.length;
          }
          slide.images.push({ src, alt: alt.trim() });
          break;
        }
        default:
          break;
      }
    }
  };
  if (tree) visit(tree);
  slide.title = titles.join(' ').trim();

  const notesPath = [...rels.values()].find((p) => /^ppt\/notesSlides\//.test(p));
  const notesDoc = notesPath ? parseXml(files[notesPath]) : null;
  if (notesDoc) {
    const lines: string[] = [];
    for (const sp of all(notesDoc, 'sp')) {
      const type = attr(first(sp, 'ph'), 'type');
      if (type !== 'body') continue;
      lines.push(...paragraphsOf(kids(sp, 'txBody')[0], false).map((p) => p.text));
    }
    slide.notes = lines.join('\n').trim();
  }
  return slide;
}

// ── deck ───────────────────────────────────────────────────────────────────────

/** Reads slide text, tables, notes and pictures from a .pptx. Browser/jsdom only (DOMParser). */
export async function readPptx(buffer: ArrayBuffer): Promise<PptxDeck> {
  checkPptxBytes(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 8)));
  const { unzipSync } = await import('fflate');

  let inflated = 0;
  let files: ZipFiles;
  try {
    files = unzipSync(new Uint8Array(buffer), {
      filter: (file) => {
        const name = file.name;
        const wanted = /^ppt\/(presentation\.xml|_rels\/presentation\.xml\.rels|slides\/slide\d+\.xml|slides\/_rels\/slide\d+\.xml\.rels|notesSlides\/notesSlide\d+\.xml)$/i.test(name);
        const image = /^ppt\/media\/[^/]+$/i.test(name) && extensionOf(name) in IMAGE_TYPES;
        if (!wanted && !image) return false;
        if (file.originalSize > (image ? MAX_IMAGE_BYTES : MAX_XML_BYTES)) return false;
        inflated += file.originalSize;
        if (inflated > MAX_INFLATED_BYTES) throw new PptxError('This file expands to far more data than a normal presentation, so it was not opened.');
        return true;
      },
    });
  } catch (error) {
    if (error instanceof PptxError) throw error;
    throw new PptxError('Could not read this presentation. It may be damaged, password-protected, or not a PowerPoint .pptx file.');
  }

  if (!files['ppt/presentation.xml']) {
    throw new PptxError('This ZIP file does not contain a PowerPoint presentation (.pptx).');
  }

  // Slide order comes from presentation.xml; fall back to the numbering of the files.
  const presentation = parseXml(files['ppt/presentation.xml']);
  const rels = relationships(files['ppt/_rels/presentation.xml.rels'], 'ppt/');
  let paths: string[] = [];
  if (presentation) {
    const rNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    paths = all(presentation, 'sldId')
      .map((el) => rels.get(el.getAttributeNS(rNs, 'id') ?? '') ?? '')
      .filter((p) => !!files[p]);
  }
  if (!paths.length) {
    paths = Object.keys(files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
      .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)?.[1]) - Number(/(\d+)\.xml$/.exec(b)?.[1]));
  }
  if (!paths.length) throw new PptxError('This presentation has no slides.');

  const budget = { used: 0 };
  const cache = new Map<string, string>();
  const slides = paths.map((p, i) => parseSlide(i + 1, p, files, budget, cache));

  const text = deckToText({ slides, stats: emptyStats(slides.length) });
  return {
    slides,
    stats: {
      slides: slides.length,
      words: countWords(text),
      images: slides.reduce((n, s) => n + s.images.length, 0),
      tables: slides.reduce((n, s) => n + s.tables.length, 0),
      notes: slides.filter((s) => s.notes).length,
      skippedImages: slides.reduce((n, s) => n + s.skippedImages, 0),
      skippedObjects: slides.reduce((n, s) => n + s.skippedObjects, 0),
    },
  };
}

const emptyStats = (slides: number): PptxDeck['stats'] => ({ slides, words: 0, images: 0, tables: 0, notes: 0, skippedImages: 0, skippedObjects: 0 });

// ── exports ────────────────────────────────────────────────────────────────────

const heading = (s: PptxSlide): string => `Slide ${s.number}${s.title ? `: ${s.title}` : ''}`;

/** All text of the deck: per slide the title, body, tables (tab separated) and notes. */
export function deckToText(deck: PptxDeck): string {
  return deck.slides
    .map((s) => {
      const lines = [heading(s)];
      for (const p of s.body) lines.push(`${'  '.repeat(p.level)}${p.bullet ? '- ' : ''}${p.text}`);
      for (const table of s.tables) {
        lines.push('', ...table.map((row) => row.join('\t')));
      }
      if (s.notes) lines.push('', `Notes: ${s.notes}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

const mdCell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** Markdown: a heading per slide, bullets for bullet paragraphs, GFM tables, notes as a quote. */
export function deckToMarkdown(deck: PptxDeck): string {
  return deck.slides
    .map((s) => {
      const out = [`## ${heading(s)}`, ''];
      s.body.forEach((p, i) => {
        if (p.bullet) {
          out.push(`${'  '.repeat(p.level)}- ${p.text.replace(/\n/g, ' ')}`);
          if (!s.body[i + 1]?.bullet) out.push('');
        } else {
          out.push(p.text.replace(/\n/g, '  \n'), '');
        }
      });
      for (const table of s.tables) {
        if (!table.length) continue;
        const width = Math.max(...table.map((r) => r.length));
        const pad = (r: string[]) => Array.from({ length: width }, (_, i) => mdCell(r[i] ?? ''));
        out.push(`| ${pad(table[0]).join(' | ')} |`, `| ${pad(table[0]).map(() => '---').join(' | ')} |`);
        for (const row of table.slice(1)) out.push(`| ${pad(row).join(' | ')} |`);
        out.push('');
      }
      if (s.images.length) out.push(`_Images on this slide: ${s.images.map((i) => i.alt || 'untitled').join(', ')}_`, '');
      if (s.notes) out.push(...s.notes.split('\n').map((l) => `> ${l}`), '');
      return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
    })
    .join('\n\n');
}
