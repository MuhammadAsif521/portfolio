import { describe, expect, it } from 'vitest';
import { SERVICE_PAGES } from '@shared/services-pages/services.data';
import { TOOLS } from '@shared/tools/tools.manifest';
import { SERVICES_CONTENT } from '../../content/services.content';

/** Published case-study slugs (portfolio-node seed). A service may only cite real case studies. */
const CASE_STUDIES = new Set([
  'city-of-new-britain-digital-ecosystem',
  'aa-bridal-studio',
  'wavy-cables',
  'khan-meat-pointe',
  'chatmessenger',
  'student-management-system',
  'mycityhelp',
]);

const words = (...texts: string[]) => texts.join(' ').split(/\s+/).filter(Boolean).length;

describe('service pages content', () => {
  it('each page is substantial, unique and within title/description limits', () => {
    const intros = new Set<string>();
    for (const s of SERVICE_PAGES) {
      const total = words(...s.intro, ...s.included, ...s.process.map((p) => p.detail), ...s.faq.flatMap((f) => [f.q, f.a]));
      expect(total, s.slug).toBeGreaterThanOrEqual(300);
      expect(s.title.length, s.slug).toBeLessThanOrEqual(60);
      expect(s.description.length, s.slug).toBeLessThanOrEqual(155);
      expect(s.faq.length, s.slug).toBeGreaterThanOrEqual(4);
      intros.add(s.intro[0]);
    }
    expect(intros.size).toBe(SERVICE_PAGES.length);
  });

  it('links only to real case studies and tools', () => {
    const tools = new Set(TOOLS.map((t) => t.slug));
    for (const s of SERVICE_PAGES) {
      for (const c of s.caseStudies) expect(CASE_STUDIES.has(c.slug), `${s.slug} -> ${c.slug}`).toBe(true);
      for (const t of s.tools) expect(tools.has(t), `${s.slug} -> ${t}`).toBe(true);
    }
  });

  it('home service cards point at existing service pages', () => {
    const slugs = new Set(SERVICE_PAGES.map((s) => s.slug));
    const linked = SERVICES_CONTENT.items.map((item) => ('page' in item ? item.page : undefined)).filter(Boolean);
    expect(linked.length).toBe(SERVICE_PAGES.length);
    for (const page of linked) expect(slugs.has(page as string)).toBe(true);
  });
});
