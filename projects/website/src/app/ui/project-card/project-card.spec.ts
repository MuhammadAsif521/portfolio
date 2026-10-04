import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PROJECT_CARD_SIZES } from '../../core/image-sizes';
import { ProjectCard } from './project-card';

const SRCSET =
  'https://cdn.test/p-w480.webp 480w, https://cdn.test/p-w960.webp 960w, https://cdn.test/p.webp 1600w';

async function render(coverImage: Record<string, unknown> | undefined, eager = false) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(ProjectCard);
  fixture.componentRef.setInput('project', {
    _id: 'p1',
    slug: 'wavy-cables',
    title: 'Wavy Cables',
    summary: 'Store',
    techStack: [],
    featured: false,
    ...(coverImage ? { coverImage } : {}),
  });
  fixture.componentRef.setInput('eager', eager);
  await fixture.whenStable();
  return (fixture.nativeElement as HTMLElement).querySelector<HTMLImageElement>('img.project-card__image');
}

describe('ProjectCard image', () => {
  it('uses the srcset from the API with the carousel sizes, lazily, at the cover aspect ratio', async () => {
    const img = (await render({
      key: 'projects/2026/10/p.webp',
      url: 'https://cdn.test/p.webp',
      alt: 'Wavy Cables storefront',
      width: 1600,
      height: 900,
      variants: [480, 960],
      srcset: SRCSET,
    }))!;
    expect(img.getAttribute('srcset')).toBe(SRCSET);
    expect(img.getAttribute('sizes')).toBe(PROJECT_CARD_SIZES);
    expect(img.getAttribute('src')).toBe('https://cdn.test/p.webp');
    expect(img.getAttribute('alt')).toBe('Wavy Cables storefront');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
    expect(img.getAttribute('fetchpriority')).toBeNull(); // below the hero: never high priority
    expect([img.getAttribute('width'), img.getAttribute('height')]).toEqual(['1600', '900']);
  });

  it('loads the first slide eagerly', async () => {
    const img = (await render({ key: 'k', url: 'https://cdn.test/p.webp', alt: '', srcset: SRCSET }, true))!;
    expect(img.hasAttribute('loading')).toBe(false);
  });

  it('falls back to src only (no srcset/sizes) for old images, with 1600×900 when dimensions are unknown', async () => {
    const img = (await render({ key: 'projects/2026/09/old.webp', url: 'https://cdn.test/old.webp', alt: 'Old' }))!;
    expect(img.getAttribute('src')).toBe('https://cdn.test/old.webp');
    expect(img.hasAttribute('srcset')).toBe(false);
    expect(img.hasAttribute('sizes')).toBe(false);
    expect([img.getAttribute('width'), img.getAttribute('height')]).toEqual(['1600', '900']);
  });

  it('renders a placeholder instead of an image when there is no cover', async () => {
    expect(await render(undefined)).toBeNull();
  });
});
