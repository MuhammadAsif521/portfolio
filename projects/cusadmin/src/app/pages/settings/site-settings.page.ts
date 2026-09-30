import { Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import { TabsComponent } from '@shared/components/custom-tabs/custom-tabs';
import { LoadingButtonComponent } from '@shared/components/loading-button/loading-button';
import { PageLoaderComponent } from '@shared/components/page-loader/page-loader.component';
import {
  DynamicReactiveFormComponent,
  FormFieldConfig,
} from '@shared/components/reactive-form-components/dynamic-reactive-form/dynamic-reactive-form.component';
import type { SiteSettings, SocialLink } from '@shared/interfaces/auth.interface';
import type { NavTab } from '@shared/interfaces/tabs.interface';
import { ToastService } from '@shared/services/toast.service';
import { getError } from '@shared/utils/get-error.util';
import { buildFormGroup } from '@cusadmin/pages/resources/build-form-group';
import { toPayload, uploadImageFields } from '@cusadmin/pages/resources/_shared/resource-io';
import { ResourceService } from '@cusadmin/services/resource.service';

const PATH = 'settings';

/**
 * Keys portfolio-node's updateSettingsBody lets a PATCH clear with null: every key except the
 * notNullable ones (siteName, siteMode, socialLinks). activeThemeId, resume and singletonKey are not in
 * the strict schema at all (422 "Unknown field"), so they never get a form control.
 */
const NULLABLE = [
  'siteSlogan',
  'description',
  'domain',
  'siteLogo',
  'ogImage',
  'contactEmail',
  'phoneNumber',
  'address',
  'city',
  'state',
  'zipCode',
  'country',
  'privacyPolicy',
  'termsAndConditions',
  'cookiePolicy',
  'metaTitle',
  'metaDescription',
  'metaKeywords',
  'googleAnalyticsId',
  'googleTagManagerId',
  'googleSiteVerification',
] as const;

const RICHTEXT = ['privacyPolicy', 'termsAndConditions', 'cookiePolicy'] as const;

/** portfolio-node SITE_MODES. */
const SITE_MODE_OPTIONS = [
  { name: 'System (follow the OS)', id: 'system' },
  { name: 'Light', id: 'light' },
  { name: 'Dark', id: 'dark' },
];

interface SettingsTab {
  tab: NavTab;
  fields: FormFieldConfig[];
}

const half = 'col-span-12 md:col-span-6';
const third = 'col-span-12 md:col-span-4';

/** An editor left with only empty markup (`<p><br></p>`) counts as blank, so it clears the field. */
function blankHtml(value: unknown): string {
  const html = String(value ?? '');
  const text = html
    .replace(/<(img|iframe|video|hr)\b/gi, 'x')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, '')
    .trim();
  return text ? html : '';
}

/**
 * Site settings singleton (GET / PATCH /admin/settings), conb-sites-admin site-settings pattern: one
 * FormGroup split across tabs; every tab stays rendered (hidden) so one Save sends everything.
 */
@Component({
  selector: 'app-site-settings',
  standalone: true,
  imports: [ReactiveFormsModule, DynamicReactiveFormComponent, LoadingButtonComponent, PageLoaderComponent, TabsComponent],
  templateUrl: './site-settings.page.html',
})
export class SiteSettingsPage implements OnInit {
  private readonly svc = inject(ResourceService);
  private readonly toast = inject(ToastService);

  readonly sections: SettingsTab[] = [
    {
      tab: { label: 'General', value: 'general' },
      fields: [
        { name: 'siteName', label: 'Site name', type: 'text', required: true, maxLength: 100, colClass: half },
        { name: 'siteSlogan', label: 'Slogan', type: 'text', maxLength: 150, colClass: half },
        { name: 'description', label: 'Description', type: 'textarea', rows: 3, maxLength: 500, colClass: 'col-span-12' },
        {
          name: 'domain',
          label: 'Domain',
          type: 'url',
          placeholder: 'https://asifdev.com',
          pattern: '^https://[^/\\s?#]+/?$',
          maxLength: 500,
          colClass: half,
        },
        { name: 'siteMode', label: 'Default appearance', type: 'dropdown', options: SITE_MODE_OPTIONS, defaultValue: 'system', required: true, colClass: half },
        { name: 'siteLogo', label: 'Site logo', type: 'file', accept: 'image/*', colClass: half },
      ],
    },
    {
      tab: { label: 'Contact', value: 'contact' },
      fields: [
        { name: 'contactEmail', label: 'Contact email', type: 'email', maxLength: 254, colClass: half },
        {
          name: 'phoneNumber',
          label: 'Phone number',
          type: 'text',
          placeholder: '+1 555 123 4567',
          pattern: '^\\+?[0-9\\s\\-()]{7,20}$',
          colClass: half,
        },
        { name: 'address', label: 'Address', type: 'text', maxLength: 120, colClass: 'col-span-12' },
        { name: 'city', label: 'City', type: 'text', maxLength: 120, colClass: 'col-span-12 md:col-span-3' },
        { name: 'state', label: 'State', type: 'text', maxLength: 120, colClass: 'col-span-12 md:col-span-3' },
        { name: 'zipCode', label: 'Zip code', type: 'text', maxLength: 120, colClass: 'col-span-12 md:col-span-3' },
        { name: 'country', label: 'Country', type: 'text', maxLength: 120, colClass: 'col-span-12 md:col-span-3' },
      ],
    },
    {
      tab: { label: 'Social', value: 'social' },
      fields: [
        {
          name: 'socialLinks',
          label: 'Social link',
          type: 'array',
          colClass: 'col-span-12',
          arrayConfig: {
            maxItems: 15,
            itemFields: [
              { name: 'label', label: 'Label', type: 'text', placeholder: 'GitHub', required: true, maxLength: 40, colClass: third },
              {
                name: 'value',
                label: 'URL',
                type: 'url',
                placeholder: 'https://',
                required: true,
                maxLength: 500,
                pattern: '^https?://.+',
                colClass: 'col-span-12 md:col-span-8',
              },
            ],
          },
        },
      ],
    },
    {
      tab: { label: 'SEO & Analytics', value: 'seo' },
      fields: [
        { name: 'metaTitle', label: 'Meta title', type: 'text', maxLength: 70, colClass: half },
        { name: 'metaKeywords', label: 'Meta keywords', type: 'text', maxLength: 255, colClass: half },
        { name: 'metaDescription', label: 'Meta description', type: 'textarea', rows: 3, maxLength: 180, colClass: 'col-span-12' },
        { name: 'ogImage', label: 'Default social share image (1200 x 630)', type: 'file', accept: 'image/*', colClass: half },
        { name: 'googleAnalyticsId', label: 'Google Analytics ID', type: 'text', placeholder: 'G-XXXXXXX', pattern: '^G-[A-Z0-9]+$', colClass: third },
        { name: 'googleTagManagerId', label: 'Google Tag Manager ID', type: 'text', placeholder: 'GTM-XXXXXX', pattern: '^GTM-[A-Z0-9]+$', colClass: third },
        { name: 'googleSiteVerification', label: 'Google site verification', type: 'text', maxLength: 100, colClass: third },
      ],
    },
    {
      tab: { label: 'Legal', value: 'legal' },
      fields: [
        { name: 'privacyPolicy', label: 'Privacy policy', type: 'richtext', colClass: 'col-span-12' },
        { name: 'termsAndConditions', label: 'Terms & conditions', type: 'richtext', colClass: 'col-span-12' },
        { name: 'cookiePolicy', label: 'Cookie policy', type: 'richtext', colClass: 'col-span-12' },
      ],
    },
  ];

  readonly tabs: NavTab[] = this.sections.map((s) => s.tab);
  private readonly fields: FormFieldConfig[] = this.sections.flatMap((s) => s.fields);

  readonly activeTab = signal('general');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadFailed = signal(false);
  form: FormGroup | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.svc.getOne<SiteSettings>(PATH).subscribe({
      next: (res) => {
        this.form = buildFormGroup(this.fields, this.toFormValue(res.data));
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.loading.set(false);
        this.loadFailed.set(true);
        this.toast.error(getError(e, 'Failed to load settings'));
      },
    });
  }

  onTabChange(value: string): void {
    this.activeTab.set(value);
  }

  save(): void {
    const form = this.form;
    if (!form) return;
    if (form.invalid) {
      form.markAllAsTouched();
      // Jump to the first tab with an error, since the other tabs are hidden.
      const bad = this.sections.find((s) => s.fields.some((f) => form.get(f.name)?.invalid));
      if (bad) this.activeTab.set(bad.tab.value);
      this.toast.error('Please fix the highlighted fields');
      return;
    }
    this.saving.set(true);
    const raw = form.getRawValue() as Record<string, unknown>;
    const siteName = String(raw['siteName'] ?? '').trim();

    uploadImageFields(
      this.svc,
      [
        { name: 'siteLogo', folder: 'settings', alt: `${siteName} logo`.trim() },
        { name: 'ogImage', folder: 'settings', alt: siteName },
      ],
      raw,
    )
      .pipe(
        switchMap((value) => {
          for (const key of RICHTEXT) value[key] = blankHtml(value[key]);
          const body = toPayload(
            { ...value, domain: String(value['domain'] ?? '').trim().replace(/\/+$/, '') },
            'update',
            { nullable: NULLABLE },
          );
          // socialLinks is notNullable and toPayload drops empty lists: always send the (trimmed) list,
          // so removing every link sticks.
          body['socialLinks'] = this.cleanLinks(value['socialLinks']);
          return this.svc.update<SiteSettings>(PATH, null, body);
        }),
      )
      .subscribe({
        next: (res) => {
          this.patchForm(res.data);
          this.saving.set(false);
          this.toast.success(res.message || 'Settings updated');
        },
        error: (e: unknown) => {
          this.saving.set(false);
          this.toast.error(getError(e, 'Save failed'));
        },
      });
  }

  /** Every configured key, with blanks for missing ones so a re-patch also clears unset fields. */
  private toFormValue(data: Partial<SiteSettings> | null | undefined): Record<string, unknown> {
    const src = (data ?? {}) as unknown as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const f of this.fields) {
      const v = src[f.name];
      if (f.type === 'array') out[f.name] = Array.isArray(v) ? v : [];
      else if (f.type === 'file') out[f.name] = v ?? null;
      else out[f.name] = v ?? f.defaultValue ?? '';
    }
    return out;
  }

  /** Re-patch in place (the dynamic form components keep their control references). */
  private patchForm(data: SiteSettings): void {
    const form = this.form;
    if (!form) return;
    const value = this.toFormValue(data);
    const { socialLinks, ...rest } = value;
    form.patchValue(rest);

    const arr = form.get('socialLinks') as FormArray<FormGroup>;
    const itemFields = this.fields.find((f) => f.name === 'socialLinks')?.arrayConfig?.itemFields ?? [];
    arr.clear();
    for (const link of socialLinks as SocialLink[]) arr.push(buildFormGroup(itemFields, link));

    form.markAsPristine();
    form.markAsUntouched();
  }

  private cleanLinks(value: unknown): SocialLink[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((l: Partial<SocialLink> | null) => ({
        label: String(l?.label ?? '').trim(),
        value: String(l?.value ?? '').trim(),
      }))
      .filter((l) => l.label || l.value);
  }
}
