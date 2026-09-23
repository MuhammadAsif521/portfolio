import {
  AfterViewInit,
  Component,
  effect,
  ElementRef,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { SafeHtmlPipe } from '@shared/pipes/safeHTML.pipe';
import { ThemeService } from '@shared/services/theme.service';

@Component({
  selector: 'html-loader',
  template: `<iframe #frame class="html-loader-frame" scrolling="no"
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              referrerpolicy="no-referrer"></iframe>`,
  styles: [`
    :host { display: block; }
    .html-loader-frame {
    display: block;
    width: 100%;
    border: 0;
    background: transparent !important;
    background-color: transparent !important;
    overflow: hidden;
    color-scheme: normal;
  }
  `],
})
export class SafeHTMLLoaderComponent implements AfterViewInit, OnChanges, OnDestroy {
  private safeHtmlPipe = inject(SafeHtmlPipe);
  private themeService = inject(ThemeService);
  @Input() html: any = '';
  @ViewChild('frame') frame!: ElementRef<HTMLIFrameElement>;

  private viewReady = false;
  private resizeObserver?: ResizeObserver;
  private readonly onLoad = () => this.autoHeight();

  private readonly reRenderOnThemeChange = effect(() => {
    this.themeService.theme();
    if (this.viewReady) this.render();
  });

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.frame.nativeElement.addEventListener('load', this.onLoad);
    this.render();
  }

  ngOnChanges(): void {
    if (this.viewReady) this.render();
  }

  ngOnDestroy(): void {
    this.frame?.nativeElement.removeEventListener('load', this.onLoad);
    this.resizeObserver?.disconnect();
  }

  private render(): void {
    const iframe = this.frame.nativeElement;

    const sanitizedHtml =
      this.safeHtmlPipe.transform(this.html || '');

    iframe.srcdoc = this.normalize(sanitizedHtml);
  }

  private normalize(html: any): string {
    const customPropertyNames = new Set<string>();
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin stylesheet; can't read its rules
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSStyleRule)) continue;
        for (let i = 0; i < rule.style.length; i++) {
          const prop = rule.style[i];
          if (prop.startsWith('--')) customPropertyNames.add(prop);
        }
      }
    }

    const rootStyles = getComputedStyle(document.documentElement);
    const cssVars: string[] = [];
    customPropertyNames.forEach(prop => {
      const value = rootStyles.getPropertyValue(prop).trim();
      if (value) cssVars.push(`${prop}: ${value};`);
    });

    const varsBlock = `<style>:root { ${cssVars.join(' ')} }</style>`;

    const isFullDoc = /<!doctype/i.test(html) || /<html[\s>]/i.test(html);

    if (isFullDoc) {
      const resetBlock = '<style>html, body { background: transparent !important; }</style>';
      return html.replace(/<\/head>/, `${varsBlock}${resetBlock}</head>`);
    }

    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          ${varsBlock}
          <style>
            html, body { margin: 0; background: transparent; overflow: hidden; }
            body { color: var(--form-control-text); font-family: var(--font-body); }
          </style>
        </head>
        <body>${html}</body>
      </html>`;
  }

  /** Iframes don't auto-size — measure content and grow to fit. */
  private autoHeight(): void {
    const iframe = this.frame.nativeElement;
    const doc = iframe.contentDocument;
    if (!doc?.body) return;

    const set = () => {
      iframe.style.height =
        Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight) + 'px';
    };
    set();

    this.resizeObserver?.disconnect();
    if ('ResizeObserver' in window) {
      // Deferring the actual height write to the next frame keeps the
      // observer's own callback from synchronously triggering another
      // layout pass on itself — the classic cause of a benign-but-noisy
      // "ResizeObserver loop completed with undelivered notifications" error.
      this.resizeObserver = new ResizeObserver(() => requestAnimationFrame(set));
      this.resizeObserver.observe(doc.body);
    }
    // Re-measure once images finish loading (they change layout height).
    doc.querySelectorAll('img').forEach(img => {
      if (!(img as HTMLImageElement).complete) {
        img.addEventListener('load', set, { once: true });
        img.addEventListener('error', set, { once: true });
      }
    });
  }
}