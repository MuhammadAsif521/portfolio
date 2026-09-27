import type { FormFieldConfig } from '@shared/components/reactive-form-components/dynamic-reactive-form/dynamic-reactive-form.component';

/** draft | published (projects, blog). */
export const STATUS_OPTIONS = [
  { name: 'Draft', id: 'draft' },
  { name: 'Published', id: 'published' },
];

/** portfolio-node seoInput robots enum. */
export const ROBOTS_OPTIONS = [
  { name: 'Index, follow', id: 'index, follow' },
  { name: 'No index, follow', id: 'noindex, follow' },
  { name: 'Index, no follow', id: 'index, nofollow' },
  { name: 'No index, no follow', id: 'noindex, nofollow' },
];

/**
 * Per-page SEO overrides (nested `seo` object; limits from portfolio-node's seoInput). Empty fields are
 * left out of the payload, so they fall back to the page's own title and summary.
 */
export const SEO_FIELDS: FormFieldConfig = {
  name: 'seo',
  label: 'SEO (optional overrides)',
  type: 'group',
  colClass: 'col-span-12',
  fields: [
    { name: 'metaTitle', label: 'Meta title', type: 'text', maxLength: 70, colClass: 'col-span-12 md:col-span-6' },
    { name: 'robots', label: 'Robots', type: 'dropdown', options: ROBOTS_OPTIONS, colClass: 'col-span-12 md:col-span-6' },
    { name: 'metaDescription', label: 'Meta description', type: 'textarea', rows: 2, maxLength: 180, colClass: 'col-span-12' },
    { name: 'metaKeywords', label: 'Meta keywords', type: 'text', maxLength: 255, colClass: 'col-span-12' },
  ],
};
