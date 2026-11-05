import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { debounceTime, merge } from 'rxjs';
import { ToolButton } from '../../../../../ui/tool-kit/tool-button';
import { ToolEmpty } from '../../../../../ui/tool-kit/tool-empty';
import { ToolInput, ToolSelect, ToolTextarea, ToolToggle } from '../../../../../ui/tool-kit/tool-fields';
import { toolCopied, toolUsage } from '../../../../../ui/tool-kit/tool-form';
import { ToolNote } from '../../../../../ui/tool-kit/tool-note';
import { ToolOutput } from '../../../../../ui/tool-kit/tool-output';
import { ToolPanel } from '../../../../../ui/tool-kit/tool-panel';
import { ToolLayout } from '../../../tool-layout/tool-layout';
import { downloadText } from '../dev-utils';
import {
  EMPTY_META_FORM,
  SAMPLE_META_FORM,
  TITLE_FONT_PX,
  TITLE_PX_LIMIT,
  breadcrumbUrl,
  buildMetaTags,
  descriptionMeter,
  hostOf,
  isAbsoluteHttpUrl,
  titleMeter,
  truncateToWidth,
  validateMeta,
  type Meter,
  type MetaForm,
} from './meta-logic';

const OG_TYPES = ['website', 'article', 'product', 'profile', 'book', 'video.other', 'music.song'].map((t) => ({ id: t, name: t }));
const TWITTER_CARDS = [
  { id: 'summary_large_image', name: 'Large image card' },
  { id: 'summary', name: 'Small summary card' },
  { id: 'off', name: 'No Twitter / X tags' },
];
const IMAGE_PREVIEWS = [
  { id: 'default', name: 'Not set (Google decides)' },
  { id: 'large', name: 'large' },
  { id: 'standard', name: 'standard' },
  { id: 'none', name: 'none' },
];

const text = (value = '') => new FormControl(value, { nonNullable: true });
const flag = (value: boolean) => new FormControl(value, { nonNullable: true });

/** /tools/meta-tag-generator: a form that writes the head tags (title, description, robots, Open Graph, Twitter) with previews. */
@Component({
  selector: 'app-meta-tag-generator',
  imports: [ToolLayout, ToolPanel, ToolInput, ToolTextarea, ToolSelect, ToolToggle, ToolOutput, ToolNote, ToolEmpty, ToolButton],
  styleUrls: ['../../../tool-ui.scss', './meta-tag-generator.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tool-layout slug="meta-tag-generator">
      <div class="tool-split">
        <div class="tool-stack">
          <app-tool-panel title="Page">
            <ng-container ngProjectAs="[panelActions]">
              <app-tool-button size="small" icon="wand-sparkles" label="Load example" (pressed)="loadExample()" />
              <app-tool-button size="small" icon="eraser" label="Clear" (pressed)="clear()" />
            </ng-container>
            <app-tool-input fieldId="mt-title" label="Title" placeholder="Primary keyword | Brand" [control]="c.title" [mono]="false" />
            <div class="mt-meter" role="group" aria-label="Title length">
              <div class="mt-meter__bar"><span class="mt-meter__fill" [class]="'mt-meter__fill--' + titleInfo().state" [style.width.%]="titleFill()"></span></div>
              <p class="mt-meter__text" role="status">{{ titleInfo().chars }} characters, about {{ titleInfo().pixels }} px wide (estimate of {{ pxLimit }} px). {{ titleInfo().label }}.</p>
            </div>
            <app-tool-textarea fieldId="mt-description" label="Meta description" placeholder="One or two sentences that say what the page offers." [control]="c.description" [rows]="3" [wrap]="true" [mono]="false" />
            <div class="mt-meter" role="group" aria-label="Description length">
              <div class="mt-meter__bar"><span class="mt-meter__fill" [class]="'mt-meter__fill--' + descriptionInfo().state" [style.width.%]="descriptionFill()"></span></div>
              <p class="mt-meter__text" role="status">{{ descriptionInfo().chars }} characters. {{ descriptionInfo().label }}.</p>
            </div>
            <app-tool-input fieldId="mt-canonical" label="Canonical URL" placeholder="https://example.com/page" hint="Absolute URL of the preferred version of this page" [control]="c.canonical" [invalid]="!!form().canonical && !canonicalOk()" />
          </app-tool-panel>

          <app-tool-panel title="Indexing and display">
            <div class="tool-controls">
              <app-tool-toggle fieldId="mt-index" label="Allow indexing" hint="Off writes noindex" [control]="c.index" />
              <app-tool-toggle fieldId="mt-follow" label="Allow following links" hint="Off writes nofollow" [control]="c.follow" />
            </div>
            <div class="tool-controls">
              <app-tool-input fieldId="mt-snippet" label="max-snippet (optional)" placeholder="-1" inputMode="numeric" hint="Characters allowed in a text snippet. -1 means no limit, 0 means none" [control]="c.maxSnippet" />
              <app-tool-select fieldId="mt-imgprev" label="max-image-preview" [control]="c.maxImagePreview" [options]="imagePreviews" />
            </div>
            <div class="tool-controls">
              <app-tool-toggle fieldId="mt-charset" label="Charset tag" hint="meta charset utf-8" [control]="c.charset" />
              <app-tool-toggle fieldId="mt-viewport" label="Viewport tag" hint="Needed for mobile layouts" [control]="c.viewport" />
            </div>
          </app-tool-panel>

          <app-tool-panel title="Social sharing">
            <app-tool-toggle fieldId="mt-og" label="Open Graph tags" hint="Used by Facebook, LinkedIn, Slack, WhatsApp and most link previews" [control]="c.ogEnabled" />
            <div class="tool-controls">
              <app-tool-input fieldId="mt-og-title" label="Social title (optional)" hint="Defaults to the page title" [control]="c.ogTitle" [mono]="false" />
              <app-tool-select fieldId="mt-og-type" label="og:type" [control]="c.ogType" [options]="ogTypes" />
            </div>
            <app-tool-textarea fieldId="mt-og-desc" label="Social description (optional)" hint="Defaults to the meta description" [control]="c.ogDescription" [rows]="2" [wrap]="true" [mono]="false" />
            <div class="tool-controls">
              <app-tool-input fieldId="mt-og-site" label="Site name" [control]="c.ogSiteName" [mono]="false" />
              <app-tool-input fieldId="mt-og-locale" label="Locale" placeholder="en_US" [control]="c.ogLocale" />
            </div>
            <app-tool-input fieldId="mt-og-image" label="Image URL" placeholder="https://example.com/social-1200x630.jpg" hint="Absolute URL. 1200 x 630 pixels works for most platforms" [control]="c.ogImage" [invalid]="!!form().ogImage && !imageOk()" />
            <app-tool-input fieldId="mt-og-alt" label="Image alt text" [control]="c.ogImageAlt" [mono]="false" />
            <div class="tool-controls">
              <app-tool-select fieldId="mt-tw-card" label="Twitter / X card" [control]="c.twitterCard" [options]="twitterCards" />
              <app-tool-input fieldId="mt-tw-site" label="Site @handle" placeholder="@yourbrand" [control]="c.twitterSite" />
              <app-tool-input fieldId="mt-tw-creator" label="Author @handle" placeholder="@author" [control]="c.twitterCreator" />
            </div>
          </app-tool-panel>

          <app-tool-panel title="Browser and icons">
            <div class="tool-controls">
              <app-tool-input fieldId="mt-theme" label="Theme colour" placeholder="#1d4ed8" hint="Tints the browser bar on some mobile browsers" [control]="c.themeColor" />
              <app-tool-input fieldId="mt-theme-dark" label="Dark theme colour (optional)" placeholder="#0b1220" [control]="c.themeColorDark" />
            </div>
            <div class="tool-controls">
              <app-tool-input fieldId="mt-ico" label="Favicon (.ico)" placeholder="/favicon.ico" [control]="c.faviconIco" />
              <app-tool-input fieldId="mt-svg" label="Favicon (.svg)" placeholder="/favicon.svg" [control]="c.faviconSvg" />
              <app-tool-input fieldId="mt-apple" label="Apple touch icon" placeholder="/apple-touch-icon.png" hint="180 x 180 pixels" [control]="c.appleTouchIcon" />
              <app-tool-input fieldId="mt-manifest" label="Web app manifest" placeholder="/site.webmanifest" [control]="c.manifest" />
            </div>
          </app-tool-panel>
        </div>

        <div class="tool-stack">
          <app-tool-panel title="Your tags">
            @if (output()) {
              <app-tool-output label="HTML for the head" [meta]="lineCount() + ' lines'" [value]="output()" copyLabel="Copy tags" (copied)="trackCopy()" />
              <div class="tool-actions">
                <app-tool-button size="small" icon="download" label="Download .html" (pressed)="download()" />
              </div>
            } @else {
              <app-tool-empty icon="tags">Fill in the form and the tags appear here. Turn the viewport and charset tags on or off at any time.</app-tool-empty>
            }
            @for (issue of issues(); track issue.message) {
              <app-tool-note [kind]="issue.level === 'error' ? 'error' : issue.level === 'warning' ? 'warn' : 'info'">{{ issue.message }}</app-tool-note>
            }
          </app-tool-panel>

          <app-tool-panel title="Previews">
            <div class="mt-previews">
              <div>
                <h4 class="tool-group">Search result (illustration)</h4>
                <div class="mt-serp">
                  <p class="mt-serp__site">{{ serp().site }}</p>
                  <h5 class="mt-serp__title">{{ serp().title }}</h5>
                  <p class="mt-serp__desc">{{ serp().description }}</p>
                </div>
                <p class="tool-meta">Widths are estimated with Arial metrics. Google rewrites titles and snippets when it thinks another text describes the page better, and uses its own fonts and layout.</p>
              </div>
              <div>
                <h4 class="tool-group">Social card (Open Graph{{ form().twitterCard === 'summary' ? ', small card' : '' }})</h4>
                <div class="mt-card" [class.mt-card--summary]="form().twitterCard === 'summary'">
                  <div class="mt-card__media">
                    @if (previewImage(); as src) {
                      <img [src]="src" [alt]="form().ogImageAlt || 'Social image preview'" referrerpolicy="no-referrer" loading="lazy" (error)="imageFailed.set(true)" (load)="imageFailed.set(false)" />
                    } @else {
                      <span>{{ imageHint() }}</span>
                    }
                  </div>
                  <div class="mt-card__body">
                    <span class="mt-card__host">{{ host() }}</span>
                    <h5 class="mt-card__title">{{ card().title }}</h5>
                    <p class="mt-card__desc">{{ card().description }}</p>
                  </div>
                </div>
                @if (imageFailed()) {
                  <app-tool-note kind="warn">The image could not be loaded from that address. Platforms will not show it either. Check the URL and that it is public.</app-tool-note>
                }
                <p class="tool-meta">
                  The image appears only after you type an address. Your browser then requests it from that server, the only request this page ever makes for you; nothing else is fetched or sent.
                </p>
              </div>
            </div>
          </app-tool-panel>
        </div>
      </div>
    </app-tool-layout>
  `,
})
export class MetaTagGeneratorTool {
  private readonly markUsed = toolUsage('meta-tag-generator');
  protected readonly trackCopy = toolCopied('meta-tag-generator');
  private readonly trackDownload = toolCopied('meta-tag-generator', { method: 'download' });
  private readonly destroyRef = inject(DestroyRef);

  protected readonly ogTypes = OG_TYPES;
  protected readonly twitterCards = TWITTER_CARDS;
  protected readonly imagePreviews = IMAGE_PREVIEWS;
  protected readonly pxLimit = TITLE_PX_LIMIT;

  protected readonly c = {
    title: text(),
    description: text(),
    canonical: text(),
    index: flag(true),
    follow: flag(true),
    maxSnippet: text(),
    maxImagePreview: text('default'),
    charset: flag(true),
    viewport: flag(true),
    themeColor: text(),
    themeColorDark: text(),
    ogEnabled: flag(true),
    ogTitle: text(),
    ogDescription: text(),
    ogType: text('website'),
    ogSiteName: text(),
    ogLocale: text(),
    ogImage: text(),
    ogImageAlt: text(),
    twitterCard: text('summary_large_image'),
    twitterSite: text(),
    twitterCreator: text(),
    faviconIco: text(),
    faviconSvg: text(),
    appleTouchIcon: text(),
    manifest: text(),
  };

  private readonly tick = signal(0);
  protected readonly imageFailed = signal(false);
  private readonly debouncedImage = signal('');

  protected readonly form = computed<MetaForm>(() => {
    this.tick();
    const c = this.c;
    return {
      title: c.title.value,
      description: c.description.value,
      canonical: c.canonical.value,
      index: c.index.value,
      follow: c.follow.value,
      maxSnippet: c.maxSnippet.value,
      maxImagePreview: (c.maxImagePreview.value === 'default' ? '' : c.maxImagePreview.value) as MetaForm['maxImagePreview'],
      charset: c.charset.value,
      viewport: c.viewport.value,
      themeColor: c.themeColor.value,
      themeColorDark: c.themeColorDark.value,
      ogEnabled: c.ogEnabled.value,
      ogTitle: c.ogTitle.value,
      ogDescription: c.ogDescription.value,
      ogType: c.ogType.value,
      ogSiteName: c.ogSiteName.value,
      ogLocale: c.ogLocale.value,
      ogImage: c.ogImage.value,
      ogImageAlt: c.ogImageAlt.value,
      twitterCard: (c.twitterCard.value === 'off' ? '' : c.twitterCard.value) as MetaForm['twitterCard'],
      twitterSite: c.twitterSite.value,
      twitterCreator: c.twitterCreator.value,
      faviconIco: c.faviconIco.value,
      faviconSvg: c.faviconSvg.value,
      appleTouchIcon: c.appleTouchIcon.value,
      manifest: c.manifest.value,
    };
  });

  protected readonly output = computed(() => {
    const f = this.form();
    const anyContent = f.title.trim() || f.description.trim() || f.canonical.trim() || f.ogImage.trim() || f.themeColor.trim() || f.faviconIco.trim() || f.faviconSvg.trim();
    return anyContent ? buildMetaTags(f) : '';
  });
  protected readonly lineCount = computed(() => this.output().split('\n').length);
  protected readonly issues = computed(() => (this.output() ? validateMeta(this.form()) : []));
  protected readonly canonicalOk = computed(() => isAbsoluteHttpUrl(this.form().canonical));
  protected readonly imageOk = computed(() => isAbsoluteHttpUrl(this.form().ogImage));

  protected readonly titleInfo = computed<Meter>(() => titleMeter(this.form().title));
  protected readonly descriptionInfo = computed<Meter>(() => descriptionMeter(this.form().description));
  protected readonly titleFill = computed(() => Math.min(100, ((this.titleInfo().pixels ?? 0) / TITLE_PX_LIMIT) * 100));
  protected readonly descriptionFill = computed(() => Math.min(100, (this.descriptionInfo().chars / 160) * 100));

  protected readonly serp = computed(() => {
    const f = this.form();
    const title = truncateToWidth(f.title.trim() || 'Your page title appears here', TITLE_PX_LIMIT, TITLE_FONT_PX).text;
    const raw = f.description.trim() || 'Your meta description appears here. Google may show different text taken from the page.';
    const description = [...raw].length > 160 ? `${[...raw].slice(0, 157).join('').trimEnd()}…` : raw;
    return { title, description, site: breadcrumbUrl(f.canonical) };
  });
  protected readonly card = computed(() => {
    const f = this.form();
    return {
      title: f.ogTitle.trim() || f.title.trim() || 'Your page title',
      description: f.ogDescription.trim() || f.description.trim() || 'Your description appears here.',
    };
  });
  protected readonly host = computed(() => (hostOf(this.form().canonical) || 'example.com').toUpperCase());
  protected readonly previewImage = computed(() => (isAbsoluteHttpUrl(this.debouncedImage()) ? this.debouncedImage().trim() : ''));
  protected readonly imageHint = computed(() => (this.form().ogImage.trim() ? 'Loading preview...' : 'No image set'));

  constructor() {
    const all = Object.values(this.c).map((ctl) => ctl.valueChanges);
    merge(...all)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.tick.update((n) => n + 1);
        if (this.c.title.value || this.c.description.value) this.markUsed();
      });
    this.c.ogImage.valueChanges.pipe(debounceTime(700), takeUntilDestroyed(this.destroyRef)).subscribe((v) => {
      this.imageFailed.set(false);
      this.debouncedImage.set(v);
    });
  }

  protected loadExample(): void {
    this.apply(SAMPLE_META_FORM);
  }

  protected clear(): void {
    this.apply(EMPTY_META_FORM);
  }

  private apply(f: MetaForm): void {
    const c = this.c;
    c.title.setValue(f.title);
    c.description.setValue(f.description);
    c.canonical.setValue(f.canonical);
    c.index.setValue(f.index);
    c.follow.setValue(f.follow);
    c.maxSnippet.setValue(f.maxSnippet);
    c.maxImagePreview.setValue(f.maxImagePreview || 'default');
    c.charset.setValue(f.charset);
    c.viewport.setValue(f.viewport);
    c.themeColor.setValue(f.themeColor);
    c.themeColorDark.setValue(f.themeColorDark);
    c.ogEnabled.setValue(f.ogEnabled);
    c.ogTitle.setValue(f.ogTitle);
    c.ogDescription.setValue(f.ogDescription);
    c.ogType.setValue(f.ogType);
    c.ogSiteName.setValue(f.ogSiteName);
    c.ogLocale.setValue(f.ogLocale);
    c.ogImage.setValue(f.ogImage);
    c.ogImageAlt.setValue(f.ogImageAlt);
    c.twitterCard.setValue(f.twitterCard || 'off');
    c.twitterSite.setValue(f.twitterSite);
    c.twitterCreator.setValue(f.twitterCreator);
    c.faviconIco.setValue(f.faviconIco);
    c.faviconSvg.setValue(f.faviconSvg);
    c.appleTouchIcon.setValue(f.appleTouchIcon);
    c.manifest.setValue(f.manifest);
  }

  protected download(): void {
    downloadText('meta-tags.html', `${this.output()}\n`, 'text/html');
    this.trackDownload();
  }
}
