import { describe, expect, it } from 'vitest';
import { SERVICES_HUB, SERVICE_PAGES } from '@shared/services-pages/services.data';
import { TOOLS } from '@shared/tools/tools.manifest';
import { WEBSITE_ICONS } from '../../core/icons';
import { SERVICES_CONTENT } from '../../content/services.content';

/** Published case-study slugs (portfolio-node seed). A service may only cite real case studies. */
const CASE_STUDIES = new Set([
  'aa-bridal-studio',
  'wavy-cables',
  'khan-meat-pointe',
  'chatmessenger',
  'student-management-system',
  'mycityhelp',
  'social-share',
]);

const words = (...texts: string[]) => texts.join(' ').split(/\s+/).filter(Boolean).length;
const pascal = (name: string) => name.replace(/(^|-)(\w)/g, (_m, _d, c: string) => c.toUpperCase());

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
    expect(new Set(SERVICE_PAGES.map((s) => s.slug)).size).toBe(SERVICE_PAGES.length);
    expect(SERVICES_HUB.description.length).toBeLessThanOrEqual(155);
    expect(SERVICES_HUB.title.length).toBeLessThanOrEqual(60);
  });

  it('links only to real case studies and tools', () => {
    const tools = new Set(TOOLS.map((t) => t.slug));
    for (const s of SERVICE_PAGES) {
      expect(s.caseStudies.length, s.slug).toBeGreaterThanOrEqual(1);
      for (const c of s.caseStudies) expect(CASE_STUDIES.has(c.slug), `${s.slug} -> ${c.slug}`).toBe(true);
      for (const t of s.tools) expect(tools.has(t), `${s.slug} -> ${t}`).toBe(true);
    }
  });

  it('every service has a one-line card summary and an icon the website ships', () => {
    for (const s of SERVICE_PAGES) {
      expect(s.summary.length, s.slug).toBeGreaterThan(0);
      expect(s.summary.length, s.slug).toBeLessThanOrEqual(70);
      expect(WEBSITE_ICONS[pascal(s.icon)], `${s.slug} icon ${s.icon}`).toBeTruthy();
    }
  });

  it('every service page has exactly one card, with a summary and 2-4 points', () => {
    const pages = SERVICE_PAGES.map((s) => s.slug);
    expect(SERVICES_CONTENT.items.map((i) => i.page)).toEqual(pages);
    for (const item of SERVICES_CONTENT.items) {
      expect(item.title.length, item.page).toBeGreaterThan(0);
      expect(item.summary.length, item.page).toBeGreaterThan(0);
      expect(item.points.length, item.page).toBeGreaterThanOrEqual(2);
      expect(item.points.length, item.page).toBeLessThanOrEqual(4);
      expect(WEBSITE_ICONS[pascal(item.icon)], `${item.page} icon ${item.icon}`).toBeTruthy();
    }
    expect(JSON.stringify(SERVICES_CONTENT)).not.toMatch(/new\s*brit|connecticut/i);
  });

  it('the home page features 3 or 4 existing services', () => {
    const slugs = new Set(SERVICE_PAGES.map((s) => s.slug));
    expect(SERVICES_CONTENT.featured.length).toBeGreaterThanOrEqual(3);
    expect(SERVICES_CONTENT.featured.length).toBeLessThanOrEqual(4);
    for (const page of SERVICES_CONTENT.featured) expect(slugs.has(page), page).toBe(true);
    expect(new Set(SERVICES_CONTENT.featured).size).toBe(SERVICES_CONTENT.featured.length);
  });
});
