import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, ElementRef, afterRenderEffect, inject, input } from '@angular/core';
// One module per icon (see src/lucide-icons.d.ts): the 'lucide' entry would pull in the whole set.
import Check from 'lucide/dist/esm/icons/check.mjs';
import Copy from 'lucide/dist/esm/icons/copy.mjs';

type IconNode = [tag: string, attrs: Record<string, string>][];
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Display names for `language-xxx` classes; anything unlisted is shown with its first letter capitalised. */
const LANGUAGE_NAMES: Record<string, string> = {
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  js: 'JavaScript',
  javascript: 'JavaScript',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  jsx: 'JSX',
  json: 'JSON',
  jsonc: 'JSON',
  bash: 'Bash',
  sh: 'Shell',
  shell: 'Shell',
  zsh: 'Zsh',
  console: 'Console',
  powershell: 'PowerShell',
  ps1: 'PowerShell',
  html: 'HTML',
  xml: 'XML',
  svg: 'SVG',
  css: 'CSS',
  scss: 'SCSS',
  sass: 'Sass',
  less: 'Less',
  sql: 'SQL',
  graphql: 'GraphQL',
  gql: 'GraphQL',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  ini: 'INI',
  env: 'ENV',
  md: 'Markdown',
  markdown: 'Markdown',
  py: 'Python',
  python: 'Python',
  rb: 'Ruby',
  ruby: 'Ruby',
  go: 'Go',
  rs: 'Rust',
  rust: 'Rust',
  java: 'Java',
  kt: 'Kotlin',
  kotlin: 'Kotlin',
  cs: 'C#',
  csharp: 'C#',
  cpp: 'C++',
  c: 'C',
  php: 'PHP',
  swift: 'Swift',
  dart: 'Dart',
  dockerfile: 'Dockerfile',
  docker: 'Dockerfile',
  nginx: 'Nginx',
  http: 'HTTP',
  diff: 'Diff',
  plaintext: 'Plain text',
  text: 'Plain text',
  txt: 'Plain text',
};

const LANGUAGE_CLASS = /^(?:language|lang)-(.+)$/i;
const COPIED_MS = 2000;

/** Language label for a code block, from `language-xxx` (or `lang-xxx`) on the <code> or the <pre>. */
export function codeLanguage(pre: Element): string {
  for (const el of [pre.querySelector('code'), pre]) {
    for (const cls of Array.from(el?.classList ?? [])) {
      const match = LANGUAGE_CLASS.exec(cls);
      if (!match) continue;
      const key = match[1].toLowerCase();
      return LANGUAGE_NAMES[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
    }
  }
  return 'Code';
}

/**
 * Turns every <pre> in rich HTML (blog posts, case studies, legal pages) into a code card: a header
 * bar with the language and a copy button above the block.
 *
 *   <div class="prose" [innerHTML]="html" [appCodeBlocks]="html"></div>
 *
 * The HTML comes from the API, so the bar is built with DOM APIs after it is inserted. Browser only:
 * render hooks don't run during SSR, so the server markup (and what hydration expects) is untouched;
 * the [innerHTML] content isn't hydrated node by node, so wrapping its <pre>s afterwards is safe.
 * Passing the content to the directive re-runs it whenever the HTML changes (post → post navigation).
 */
@Directive({ selector: '[appCodeBlocks]' })
export class CodeBlocksDirective {
  /** The rendered HTML (any value): a change re-scans the host for new <pre> blocks. */
  readonly appCodeBlocks = input<unknown>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  constructor() {
    afterRenderEffect({
      write: () => {
        this.appCodeBlocks();
        this.enhance();
      },
    });
    inject(DestroyRef).onDestroy(() => this.timers.forEach(clearTimeout));
  }

  private enhance(): void {
    const pres = this.host.nativeElement.querySelectorAll('pre');
    pres.forEach((pre) => {
      if (pre.parentElement?.classList.contains('code-block')) return;
      this.wrap(pre);
    });
  }

  private wrap(pre: HTMLPreElement): void {
    const doc = this.document;
    const language = codeLanguage(pre);

    const figure = doc.createElement('figure');
    figure.className = 'code-block';

    const bar = doc.createElement('div');
    bar.className = 'code-block__bar';

    const label = doc.createElement('span');
    label.className = 'code-block__lang';
    label.textContent = language;

    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'code-block__copy';
    button.setAttribute('aria-label', 'Copy code');
    const buttonText = doc.createElement('span');
    buttonText.className = 'code-block__copy-text';
    buttonText.textContent = 'Copy';
    button.append(this.icon(Copy), buttonText);

    // Announces the result; the button's own label stays "Copy code".
    const status = doc.createElement('span');
    status.className = 'code-block__status';
    status.setAttribute('role', 'status');

    bar.append(label, button);
    pre.replaceWith(figure);
    figure.append(bar, pre, status);
    if (!pre.hasAttribute('tabindex')) pre.tabIndex = 0; // long blocks can still be scrolled by keyboard

    let reset: ReturnType<typeof setTimeout> | undefined;
    button.addEventListener('click', async () => {
      const code = (pre.querySelector('code') ?? pre).textContent ?? '';
      const ok = await this.copy(code);
      if (reset) {
        clearTimeout(reset);
        this.timers.delete(reset);
      }
      button.replaceChildren(this.icon(ok ? Check : Copy), buttonText);
      buttonText.textContent = ok ? 'Copied' : 'Copy failed';
      button.classList.toggle('is-copied', ok);
      status.textContent = ok ? 'Code copied to clipboard' : 'Could not copy the code';
      reset = setTimeout(() => {
        this.timers.delete(reset!);
        button.replaceChildren(this.icon(Copy), buttonText);
        buttonText.textContent = 'Copy';
        button.classList.remove('is-copied');
        status.textContent = '';
      }, COPIED_MS);
      this.timers.add(reset);
    });
  }

  /** A 16px Lucide icon (stroke in currentColor), hidden from assistive tech. */
  private icon(node: IconNode): SVGElement {
    const doc = this.document;
    const svg = doc.createElementNS(SVG_NS, 'svg');
    const attrs: Record<string, string> = {
      class: 'code-block__icon',
      width: '16',
      height: '16',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    };
    for (const [key, value] of Object.entries(attrs)) svg.setAttribute(key, value);
    for (const [tag, childAttrs] of node) {
      const child = doc.createElementNS(SVG_NS, tag);
      for (const [key, value] of Object.entries(childAttrs)) child.setAttribute(key, String(value));
      svg.append(child);
    }
    return svg;
  }

  /** Async Clipboard API, falling back to a hidden textarea + execCommand (non-secure contexts, old browsers). */
  private async copy(text: string): Promise<boolean> {
    const clipboard = this.document.defaultView?.navigator.clipboard;
    if (clipboard?.writeText) {
      try {
        await clipboard.writeText(text);
        return true;
      } catch {
        // fall through to the legacy path
      }
    }
    const doc = this.document;
    const area = doc.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    area.style.pointerEvents = 'none';
    doc.body.append(area);
    const active = doc.activeElement as HTMLElement | null;
    area.select();
    let ok = false;
    try {
      ok = doc.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    active?.focus?.();
    return ok;
  }
}
