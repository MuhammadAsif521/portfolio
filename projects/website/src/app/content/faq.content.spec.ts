import { describe, expect, it } from 'vitest';
import { SERVICE_PAGES } from '@shared/services-pages/services.data';
import { FAQ_CONTENT } from './faq.content';

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const answerText = (item: (typeof FAQ_CONTENT.items)[number]) => item.answer.map((p) => p.text).join('');

describe('FAQ content', () => {
  it('asks real questions and answers first in 40-90 words', () => {
    for (const item of FAQ_CONTENT.items) {
      expect(item.question.endsWith('?'), item.question).toBe(true);
      const n = words(answerText(item));
      expect(n, item.question).toBeGreaterThanOrEqual(40);
      expect(n, item.question).toBeLessThanOrEqual(90);
    }
    expect(new Set(FAQ_CONTENT.items.map((i) => i.question)).size).toBe(FAQ_CONTENT.items.length);
  });

  it('keeps the owner-removed city name out and quotes no prices', () => {
    const all = FAQ_CONTENT.items.map((i) => i.question + ' ' + answerText(i)).join(' ');
    expect(all).not.toMatch(/new\s*brit/i);
    expect(all).not.toMatch(/[$£€]\s?\d|\d\s?(USD|PKR|EUR|GBP)\b/i);
  });

  it('links only to service pages that exist, case studies and the tools hub', () => {
    const slugs = new Set(SERVICE_PAGES.map((s) => s.slug));
    const links = FAQ_CONTENT.items.flatMap((i) => i.answer.map((p) => p.link).filter((l): l is string => !!l));
    for (const link of links) {
      if (link.startsWith('/services/')) expect(slugs.has(link.slice('/services/'.length)), link).toBe(true);
      else expect(link, link).toMatch(/^\/(services|projects\/[a-z-]+|tools|)$/);
    }
    // Every service is reachable from the FAQ.
    for (const s of SERVICE_PAGES) expect(links, s.slug).toContain('/services/' + s.slug);
  });
});
