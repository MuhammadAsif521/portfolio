// ─── Interfaces ──────────────────────────────────────────────────────────────
export interface TextEditorPlaceholder extends RichTextPlaceholder {}

export type DropdownOption = {
  value: string;
  name: string;
};

export interface RichTextPlaceholder {
  key: string;
  label: string;
  required: boolean;
}

export interface TbBtn {
  cmd: string;
  icon: string;
  title: string;
}

export interface TbOpt {
  value: string;
  label: string;
}

export interface CannedResponse {
  id: string;
  name: string;
}

// ─── Toolbar Constants ───────────────────────────────────────────────────────

export const HISTORY_CONTROLS: TbBtn[] = [
  { cmd: 'undo', icon: 'undo-2', title: 'Undo' },
  { cmd: 'redo', icon: 'redo-2', title: 'Redo' },
];

export const INLINE_CONTROLS: TbBtn[] = [
  { cmd: 'bold', icon: 'bold', title: 'Bold' },
  { cmd: 'italic', icon: 'italic', title: 'Italic' },
  { cmd: 'underline', icon: 'underline', title: 'Underline' },
  { cmd: 'strikeThrough', icon: 'strikethrough', title: 'Strikethrough' },
  { cmd: 'subscript', icon: 'subscript', title: 'Subscript' },
  { cmd: 'superscript', icon: 'superscript', title: 'Superscript' },
];

export const ALIGN_CONTROLS: TbBtn[] = [
  { cmd: 'justifyLeft', icon: 'align-left', title: 'Align left' },
  { cmd: 'justifyCenter', icon: 'align-center', title: 'Align center' },
  { cmd: 'justifyRight', icon: 'align-right', title: 'Align right' },
  { cmd: 'justifyFull', icon: 'align-justify', title: 'Justify' },
  { cmd: 'indent', icon: 'indent-increase', title: 'Indent' },
  { cmd: 'outdent', icon: 'indent-decrease', title: 'Outdent' },
];

export const LIST_CONTROLS: TbBtn[] = [
  { cmd: 'insertUnorderedList', icon: 'list', title: 'Bullet list' },
  { cmd: 'insertOrderedList', icon: 'list-ordered', title: 'Numbered list' },
];

export const BLOCK_STYLES: TbOpt[] = [
  { value: '', label: 'Standard' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'h4', label: 'Heading 4' },
  { value: 'pre', label: 'Code' },
  { value: 'blockquote', label: 'Quote' },
];

export const FONT_FAMILIES: TbOpt[] = [
  { value: 'Ubuntu', label: 'Ubuntu' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Times New Roman', label: 'Times New Roman' },
];

export const FONT_SIZES: TbOpt[] = [
  { value: '8px', label: '8' },
  { value: '9px', label: '9' },
  { value: '10px', label: '10' },
  { value: '11px', label: '11' },
  { value: '12px', label: '12' },
  { value: '14px', label: '14' },
  { value: '16px', label: '16' },
  { value: '18px', label: '18' },
  { value: '20px', label: '20' },
  { value: '24px', label: '24' },
  { value: '28px', label: '28' },
  { value: '36px', label: '36' },
  { value: '48px', label: '48' },
  { value: '72px', label: '72' },
];

// ─── Utility Functions ───────────────────────────────────────────────────────

function unwrapFontSize(node: Node): void {
  node.childNodes.forEach(child => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      el.style.fontSize = '';
      if (el.tagName === 'FONT') el.removeAttribute('size');
      if (el.getAttribute('style') === '') el.removeAttribute('style');
      unwrapFontSize(el);
    }
  });
}

function buildAnchorSpan(size: string): HTMLSpanElement {
  const anchor = document.createElement('span');
  anchor.style.fontSize = size;
  anchor.textContent = '\u200B';
  return anchor;
}

function placeCursorInAnchor(anchor: HTMLSpanElement, sel: Selection): void {
  const r = document.createRange();
  r.setStart(anchor.firstChild!, 1);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

export function applyFontSizeAtSelection(editor: HTMLElement, size: string): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);

  if (!range.collapsed) {
    const fragment = range.extractContents();
    unwrapFontSize(fragment);
    const wrapper = document.createElement('span');
    wrapper.style.fontSize = size;
    wrapper.appendChild(fragment);
    range.insertNode(wrapper);
    range.selectNodeContents(wrapper);
    sel.removeAllRanges();
    sel.addRange(range);
    editor.focus();
    return;
  }

  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    const textNode = range.startContainer as Text;
    const parentEl = textNode.parentElement;
    if (parentEl?.classList.contains('ph-chip')) {
      const anchor = buildAnchorSpan(size);
      parentEl.insertAdjacentElement('afterend', anchor);
      placeCursorInAnchor(anchor, sel);
      editor.focus();
      return;
    }
    const textAfter = textNode.splitText(range.startOffset);
    const anchor = buildAnchorSpan(size);
    textNode.parentNode!.insertBefore(anchor, textAfter);
    placeCursorInAnchor(anchor, sel);
    editor.focus();
    return;
  }

  const anchor = buildAnchorSpan(size);
  range.insertNode(anchor);
  placeCursorInAnchor(anchor, sel);
  editor.focus();
}

export function createEditorImage(src: string): HTMLImageElement {
  const img = document.createElement('img');
  img.src = src;
  img.style.maxWidth = '100%';
  img.style.width = '300px';
  img.style.height = 'auto';
  img.style.cursor = 'pointer';
  img.style.display = 'inline-block';
  img.style.verticalAlign = 'middle';
  img.setAttribute('data-ee-img', 'true');
  img.draggable = false;
  return img;
}

export function createResizableImageWrapper(
  img: HTMLImageElement,
  onResizeEnd: () => void
): HTMLSpanElement {
  const wrap = document.createElement('span');
  wrap.contentEditable = 'false';
  wrap.style.cssText = 'display:inline-block;position:relative;line-height:0;user-select:none;';

  const tooltip = document.createElement('span');
  tooltip.style.cssText =
    'position:absolute;top:-22px;left:0;background:#333;color:#fff;font-size:11px;padding:1px 5px;border-radius:3px;display:none;white-space:nowrap;pointer-events:none;';

  const handle = document.createElement('span');
  handle.style.cssText =
    'position:absolute;right:-5px;bottom:-5px;width:12px;height:12px;background:var(--secondary);border:2px solid #fff;border-radius:2px;cursor:se-resize;z-index:10;box-shadow:0 1px 3px rgba(0,0,0,.4);';

  let startX = 0;
  let startW = 0;

  handle.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startX = e.clientX;
    startW = img.offsetWidth;
    tooltip.style.display = 'block';
    tooltip.textContent = `${startW}px`;

    const onMove = (mv: MouseEvent) => {
      const newW = Math.max(40, startW + (mv.clientX - startX));
      img.style.width = `${newW}px`;
      img.style.height = 'auto';
      tooltip.textContent = `${Math.round(newW)}px`;
    };
    const onUp = () => {
      tooltip.style.display = 'none';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      onResizeEnd();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  wrap.appendChild(tooltip);
  wrap.appendChild(img);
  wrap.appendChild(handle);
  return wrap;
}

export function insertNodeAtEditorCursor(
  editor: HTMLElement,
  node: Node,
  placeholders: RichTextPlaceholder[] = []
): void {
  const selection = window.getSelection();
  if (selection && selection.rangeCount) {
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      if (!range.collapsed && placeholders.length) {
        const chips = Array.from(editor.querySelectorAll('.ph-chip'));
        const blocked = chips.some(chip => {
          const el = chip as HTMLElement;
          return (
            isRequiredPlaceholder(el.dataset['ph']!, placeholders) &&
            range.intersectsNode(chip)
          );
        });
        if (blocked) return;
      }
      range.deleteContents();
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      editor.appendChild(node);
    }
  } else {
    editor.appendChild(node);
  }
  editor.focus();
}

// Sentinel-based protect/restore for chip parsing
const S_PRE = '\x00PRT';
const S_SUF = 'PRT\x00';
function makeSentinel(i: number) { return `${S_PRE}${i}${S_SUF}`; }

function protect(html: string): { html: string; store: string[] } {
  const store: string[] = [];
  const stash = (match: string) => { const t = makeSentinel(store.length); store.push(match); return t; };
  html = html.replace(/<!DOCTYPE[^>]*>/gi, stash);
  html = html.replace(/<head[\s\S]*?<\/head>/gi, stash);
  html = html.replace(/<style[\s\S]*?<\/style>/gi, stash);
  html = html.replace(/<script[\s\S]*?<\/script>/gi, stash);
  html = html.replace(/\{\{[\w]+\|safe\}\}/g, stash);
  html = html.replace(/<[a-zA-Z][^>]*>/g, stash);
  html = html.replace(/<\/[a-zA-Z][^>]*>/g, stash);
  html = html.replace(/<!--[\s\S]*?-->/g, stash);
  return { html, store };
}

function restore(html: string, store: string[]): string {
  for (let i = store.length - 1; i >= 0; i--) {
    html = html.replace(makeSentinel(i), () => store[i]);
  }
  return html;
}

export function parseHtmlToChips(html: string): string {
  if (!html?.trim()) return html;
  const { html: safe, store } = protect(html);
  const chipped = safe.replace(/\{\{([\w]+)\}\}/g, (_full, key: string) =>
    `<span class="ph-chip" contenteditable="false" data-ph="${key}">{{${key}}}</span>`
  );
  return restore(chipped, store);
}

export function createPlaceholderChip(key: string, token?: string): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.className = 'ph-chip';
  chip.contentEditable = 'false';
  chip.dataset['ph'] = key;
  chip.textContent = `{{${token ?? key}}}`;
  return chip;
}

export function getRawEditorHtml(editor: HTMLElement): string {
  const clone = editor.cloneNode(true) as HTMLElement;
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) textNodes.push(n as Text);
  textNodes.forEach(tn => {
    if (tn.textContent?.includes('\u200B'))
      tn.textContent = tn.textContent.replace(/\u200B/g, '');
  });
  clone.querySelectorAll('span').forEach(span => {
    if (!span.classList.contains('ph-chip') && span.children.length === 0 && (span.textContent ?? '') === '')
      span.remove();
  });
  clone.querySelectorAll('.ph-chip').forEach(chip => {
    const raw = chip.textContent ?? `{{${(chip as HTMLElement).dataset['ph']}}}`;
    chip.replaceWith(document.createTextNode(raw));
  });
  clone.querySelectorAll('span[contenteditable="false"]').forEach(wrap => {
    const img = wrap.querySelector('img[data-ee-img]');
    if (img) wrap.replaceWith(img.cloneNode(true));
  });
  return clone.innerHTML;
}

export function getPresentPlaceholderKeys(editor: HTMLElement): string[] {
  return Array.from(editor.querySelectorAll('.ph-chip')).map(c => (c as HTMLElement).dataset['ph']!);
}

export function getMissingRequiredPlaceholders(editor: HTMLElement, placeholders: RichTextPlaceholder[]): string[] {
  const present = getPresentPlaceholderKeys(editor);
  return placeholders.filter(p => p.required && !present.includes(p.key)).map(p => p.key);
}

export function isRequiredPlaceholder(key: string, placeholders: RichTextPlaceholder[]): boolean {
  return placeholders.some(p => p.key === key && p.required);
}

export function flashChip(chip: HTMLElement): void {
  chip.style.outline = '2px solid var(--error-color)';
  chip.style.background = 'rgba(var(--error-rgb), 0.1)';
  setTimeout(() => { chip.style.outline = ''; chip.style.background = ''; }, 600);
}