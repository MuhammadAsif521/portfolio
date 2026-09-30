import { DatePipe, isPlatformBrowser } from '@angular/common';
import { Component, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { LoadingButtonComponent } from '@shared/components/loading-button/loading-button';
import { PageLoaderComponent } from '@shared/components/page-loader/page-loader.component';
import {
  DynamicReactiveFormComponent,
  FormFieldConfig,
} from '@shared/components/reactive-form-components/dynamic-reactive-form/dynamic-reactive-form.component';
import type { ResumeFile, SiteSettings } from '@shared/interfaces/auth.interface';
import type { Project } from '@shared/interfaces/public-api.interface';
import { ToastService } from '@shared/services/toast.service';
import { getError } from '@shared/utils/get-error.util';
import { buildFormGroup } from '@cusadmin/pages/resources/build-form-group';
import { splitList, toPayload } from '@cusadmin/pages/resources/_shared/resource-io';
import { ResourceService } from '@cusadmin/services/resource.service';

// ── portfolio-node contract (validators/resume.validator.ts, models/resumeProfile.model.ts) ─────────

const PROFILE_PATH = 'resume/profile';
const PREVIEW_PATH = 'resume/preview';
const GENERATE_PATH = 'resume/generate';

/** Scalars a PATCH may clear with null (everything not in the validator's notNullable list). */
const NULLABLE = ['headline', 'location', 'website', 'linkedin', 'github', 'summary', 'accentColor'] as const;

const LIMITS = { skills: 10, skillItems: 25, skillItemLength: 40, education: 6, certifications: 15, languages: 8, featuredProjects: 6 } as const;

type LanguageLevel = 'native' | 'fluent' | 'professional' | 'basic';
type PaperSize = 'A4' | 'LETTER';

interface SkillGroup {
  category: string;
  items: string[];
}
interface Education {
  institution: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}
interface Certification {
  name: string;
  issuer?: string;
  date?: string;
  url?: string;
}
interface Language {
  name: string;
  level: LanguageLevel;
}

/** GET /admin/resume/profile. Contact lines come from settings, jobs from Experience (showOnResume). */
export interface ResumeProfile {
  _id: string;
  fullName: string;
  headline?: string;
  location?: string;
  website?: string;
  linkedin?: string;
  github?: string;
  summary?: string;
  skills: SkillGroup[];
  education: Education[];
  certifications: Certification[];
  languages: Language[];
  featuredProjectIds: string[];
  accentColor?: string;
  paperSize: PaperSize;
  updatedAt?: string;
}

/** POST /admin/resume/generate (201). */
interface GeneratedResume extends ResumeFile {
  size: number;
}

const HTTPS_PATTERN = '^https://\\S+$';
const HEX_PATTERN = '^#[0-9A-Fa-f]{6}$';
const HALF = 'col-span-12 md:col-span-6';
const THIRD = 'col-span-12 md:col-span-4';

const LEVEL_OPTIONS = (['native', 'fluent', 'professional', 'basic'] as const).map((id) => ({
  id,
  name: id.charAt(0).toUpperCase() + id.slice(1),
}));

/** ISO date from the API → value for <input type="date">. */
const toDateInput = (v: unknown): string => (typeof v === 'string' && v ? v.slice(0, 10) : '');

/** Array items: trim, drop blank optionals (a blank https `url` would 422), keep the strict shape. */
const cleanItems = (items: unknown): Record<string, unknown>[] =>
  (Array.isArray(items) ? (items as Record<string, unknown>[]) : [])
    .map((item) => toPayload(item, 'create'))
    .filter((item) => Object.keys(item).length > 0);

/** Resume profile editor + live PDF preview + publish (portfolio-node /admin/resume/*). */
@Component({
  selector: 'app-resume',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink, DynamicReactiveFormComponent, LoadingButtonComponent, PageLoaderComponent],
  templateUrl: './resume.page.html',
})
export class ResumePage implements OnInit, OnDestroy {
  private readonly svc = inject(ResourceService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  formConfig: FormFieldConfig[] = [
    { name: 'basicsHeading', label: 'Basics', type: 'heading' },
    { name: 'fullName', label: 'Full name', type: 'text', required: true, maxLength: 100, colClass: HALF },
    { name: 'headline', label: 'Headline', type: 'text', maxLength: 150, placeholder: 'Senior Frontend Engineer', colClass: HALF },
    { name: 'location', label: 'Location', type: 'text', maxLength: 120, placeholder: 'Lahore, Pakistan', colClass: HALF },
    { name: 'website', label: 'Website', type: 'url', maxLength: 500, pattern: HTTPS_PATTERN, placeholder: 'https://', colClass: HALF },
    { name: 'linkedin', label: 'LinkedIn', type: 'url', maxLength: 500, pattern: HTTPS_PATTERN, placeholder: 'https://linkedin.com/in/…', colClass: HALF },
    { name: 'github', label: 'GitHub', type: 'url', maxLength: 500, pattern: HTTPS_PATTERN, placeholder: 'https://github.com/…', colClass: HALF },
    { name: 'summary', label: 'Summary', type: 'textarea', rows: 5, maxLength: 1200, colClass: 'col-span-12' },

    {
      name: 'skills',
      label: 'Skill groups',
      type: 'array',
      colClass: 'col-span-12',
      arrayConfig: {
        maxItems: LIMITS.skills,
        itemFields: [
          { name: 'category', label: 'Category', type: 'text', required: true, maxLength: 60, placeholder: 'Frontend', colClass: 'col-span-12' },
          {
            name: 'items',
            label: `Skills (comma or new line, max ${LIMITS.skillItems}, ${LIMITS.skillItemLength} chars each)`,
            type: 'textarea',
            rows: 3,
            placeholder: 'Angular, TypeScript, RxJS',
            colClass: 'col-span-12',
          },
        ],
      },
    },
    {
      name: 'education',
      label: 'Education',
      type: 'array',
      colClass: 'col-span-12',
      arrayConfig: {
        maxItems: LIMITS.education,
        itemFields: [
          { name: 'institution', label: 'Institution', type: 'text', required: true, maxLength: 150, colClass: 'col-span-12' },
          { name: 'degree', label: 'Degree', type: 'text', maxLength: 120, placeholder: 'BS', colClass: HALF },
          { name: 'field', label: 'Field of study', type: 'text', maxLength: 120, placeholder: 'Computer Science', colClass: HALF },
          { name: 'startDate', label: 'Start date', type: 'date', colClass: HALF },
          { name: 'endDate', label: 'End date', type: 'date', colClass: HALF },
          { name: 'notes', label: 'Notes', type: 'textarea', rows: 2, maxLength: 300, colClass: 'col-span-12' },
        ],
      },
    },
    {
      name: 'certifications',
      label: 'Certifications',
      type: 'array',
      colClass: 'col-span-12',
      arrayConfig: {
        maxItems: LIMITS.certifications,
        itemFields: [
          { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 150, colClass: HALF },
          { name: 'issuer', label: 'Issuer', type: 'text', maxLength: 120, colClass: HALF },
          { name: 'date', label: 'Date', type: 'date', colClass: HALF },
          { name: 'url', label: 'Credential URL', type: 'url', maxLength: 500, pattern: HTTPS_PATTERN, placeholder: 'https://', colClass: HALF },
        ],
      },
    },
    {
      name: 'languages',
      label: 'Languages',
      type: 'array',
      colClass: 'col-span-12',
      arrayConfig: {
        maxItems: LIMITS.languages,
        itemFields: [
          { name: 'name', label: 'Language', type: 'text', required: true, maxLength: 40, colClass: HALF },
          { name: 'level', label: 'Level', type: 'dropdown', required: true, options: LEVEL_OPTIONS, defaultValue: 'professional', colClass: HALF },
        ],
      },
    },

    { name: 'layoutHeading', label: 'Projects & layout', type: 'heading' },
    {
      name: 'featuredProjectIds',
      label: `Featured projects (max ${LIMITS.featuredProjects})`,
      type: 'multiselect',
      searchable: true,
      options: [],
      defaultValue: [],
      colClass: 'col-span-12',
    },
    { name: 'accentColor', label: 'Accent colour', type: 'color', pattern: HEX_PATTERN, placeholder: '#RRGGBB', colClass: THIRD },
    {
      name: 'paperSize',
      label: 'Paper size',
      type: 'dropdown',
      required: true,
      defaultValue: 'A4',
      options: [
        { id: 'A4', name: 'A4' },
        { id: 'LETTER', name: 'US Letter' },
      ],
      colClass: THIRD,
    },
  ];

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly previewing = signal(false);
  readonly generating = signal(false);
  readonly previewUrl = signal<SafeResourceUrl | null>(null);
  readonly published = signal<ResumeFile | null>(null);
  readonly updatedAt = signal<string | null>(null);
  form!: FormGroup;

  private objectUrl: string | null = null;

  ngOnInit(): void {
    forkJoin({
      profile: this.svc.getOne<ResumeProfile>(PROFILE_PATH),
      // Optional extras: the page still works if either fails.
      settings: this.svc.getOne<SiteSettings>('settings').pipe(catchError(() => of(null))),
      projects: this.svc.list<Project>('projects', { limit: 50, sort: 'order' }).pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ profile, settings, projects }) => {
        if (projects) {
          this.formConfig = this.formConfig.map((f) =>
            f.name === 'featuredProjectIds' ? { ...f, options: projects.items.map((p) => ({ id: p._id, name: p.title })) } : f,
          );
        }
        this.published.set(settings?.data.resume ?? null);
        this.patch(profile.data);
        this.loading.set(false);
        this.refreshPreview();
      },
      error: (e: unknown) => {
        this.toast.error(getError(e, 'Failed to load the resume profile'));
        this.form = buildFormGroup(this.formConfig, {});
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.revokePreview();
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Please fix the highlighted fields');
      return;
    }
    const body = this.toBody();
    if (typeof body === 'string') {
      this.toast.error(body);
      return;
    }
    this.saving.set(true);
    this.svc.update<ResumeProfile>(PROFILE_PATH, null, body).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(res.message || 'Resume profile updated');
        this.patch(res.data);
        this.refreshPreview();
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.toast.error(getError(e, 'Save failed'));
      },
    });
  }

  /** GET preview renders the *saved* profile (plus Experience/Projects/Settings) as a PDF. */
  refreshPreview(): void {
    if (!this.isBrowser || this.previewing()) return;
    this.previewing.set(true);
    this.svc.getBlob(PREVIEW_PATH).subscribe({
      next: (blob) => {
        this.revokePreview();
        this.objectUrl = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: 'application/pdf' }));
        this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
        this.previewing.set(false);
      },
      error: (e: unknown) => {
        this.previewing.set(false);
        void this.svc.blobError(e).then((err) => this.toast.error(getError(err, 'Preview failed')));
      },
    });
  }

  generate(): void {
    this.generating.set(true);
    this.svc.post<GeneratedResume>(GENERATE_PATH, { publish: true }).subscribe({
      next: (res) => {
        this.generating.set(false);
        this.published.set({ key: res.data.key, url: res.data.url, generatedAt: res.data.generatedAt });
        this.toast.success(res.message || 'Resume generated');
      },
      error: (e: unknown) => {
        this.generating.set(false);
        this.toast.error(getError(e, 'Generating the PDF failed'));
      },
    });
  }

  private patch(profile: ResumeProfile): void {
    this.updatedAt.set(profile.updatedAt ?? null);
    this.form = buildFormGroup(this.formConfig, {
      ...profile,
      skills: (profile.skills ?? []).map((s) => ({ category: s.category, items: s.items.join(', ') })),
      education: (profile.education ?? []).map((e) => ({ ...e, startDate: toDateInput(e.startDate), endDate: toDateInput(e.endDate) })),
      certifications: (profile.certifications ?? []).map((c) => ({ ...c, date: toDateInput(c.date) })),
      languages: profile.languages ?? [],
      featuredProjectIds: profile.featuredProjectIds ?? [],
    });
  }

  /** Form value → PATCH body; returns an error message when a list limit the form can't express is hit. */
  private toBody(): Record<string, unknown> | string {
    const raw = this.form.getRawValue() as Record<string, unknown>;

    const skills = cleanItems(raw['skills']).map((s) => ({ category: s['category'], items: splitList(s['items']) }));
    const tooMany = skills.find((s) => s.items.length > LIMITS.skillItems);
    if (tooMany) return `"${String(tooMany.category)}" has more than ${LIMITS.skillItems} skills`;
    const tooLong = skills.flatMap((s) => s.items).find((i) => i.length > LIMITS.skillItemLength);
    if (tooLong) return `Skill "${tooLong}" is longer than ${LIMITS.skillItemLength} characters`;

    const education = cleanItems(raw['education']);
    const bad = education.find((e) => e['startDate'] && e['endDate'] && String(e['endDate']) < String(e['startDate']));
    if (bad) return `Education at ${String(bad['institution'])}: end date is before the start date`;

    const featuredProjectIds = Array.isArray(raw['featuredProjectIds']) ? (raw['featuredProjectIds'] as string[]) : [];
    if (featuredProjectIds.length > LIMITS.featuredProjects) return `Pick at most ${LIMITS.featuredProjects} featured projects`;

    const accent = typeof raw['accentColor'] === 'string' ? raw['accentColor'].trim().toUpperCase() : raw['accentColor'];
    const scalars = toPayload(
      {
        fullName: raw['fullName'],
        headline: raw['headline'],
        location: raw['location'],
        website: raw['website'],
        linkedin: raw['linkedin'],
        github: raw['github'],
        summary: raw['summary'],
        accentColor: accent,
        paperSize: raw['paperSize'],
      },
      'update',
      { nullable: NULLABLE },
    );

    // Lists are notNullable: always send them (an empty [] clears the section).
    return {
      ...scalars,
      skills,
      education,
      certifications: cleanItems(raw['certifications']),
      languages: cleanItems(raw['languages']),
      featuredProjectIds,
    };
  }

  private revokePreview(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }
}
