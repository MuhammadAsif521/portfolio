import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { POST_CARD_SIZES } from '../../core/image-sizes';
import { PostCard } from './post-card';

async function render(overrides: Record<string, unknown> = {}) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideMockStore({
        initialState: {
          site: { settings: { siteName: 'Muhammad Asif' }, status: 'loaded', error: null },
          ui: { activeSection: 'home', menuOpen: false },
        },
      }),
    ],
  });
  const fixture = TestBed.createComponent(PostCard);
  fixture.componentRef.setInput('post', {
    _id: 'p1',
    slug: 'hello-signals',
    title: 'Hello signals',
    excerpt: 'Intro',
    tags: ['angular'],
    publishedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  });
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('PostCard', () => {
  it('is one real link to the post (stretched over the card), named by the post title', async () => {
    const el = await render();

    const links = el.querySelectorAll('a');
    expect(links.length).toBe(1); // one tab stop per card
    expect(links[0]?.getAttribute('href')).toBe('/blog/hello-signals');
    expect(links[0]?.textContent?.trim()).toBe('Hello signals');
    expect(links[0]?.classList).toContain('post-card__link'); // its ::after covers the card
    expect(el.querySelector('.post-card__arrow')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('uses the srcset from the API with the grid sizes, lazily', async () => {
    const srcset =
      'https://cdn.test/b-w480.webp 480w, https://cdn.test/b-w960.webp 960w, https://cdn.test/b.webp 1600w';
    const el = await render({
      coverImage: {
        key: 'blog/2026/10/b.webp',
        url: 'https://cdn.test/b.webp',
        alt: 'Cover',
        width: 1600,
        height: 900,
        variants: [480, 960],
        srcset,
      },
    });
    const img = el.querySelector<HTMLImageElement>('img.post-card__image')!;
    expect(img.getAttribute('srcset')).toBe(srcset);
    expect(img.getAttribute('sizes')).toBe(POST_CARD_SIZES);
    expect(img.getAttribute('src')).toBe('https://cdn.test/b.webp');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
    expect([img.getAttribute('width'), img.getAttribute('height')]).toEqual(['1600', '900']);
  });

  it('falls back to src only for images stored before variants existed', async () => {
    const el = await render({ coverImage: { key: 'blog/2026/09/old.webp', url: 'https://cdn.test/old.webp', alt: '' } });
    const img = el.querySelector<HTMLImageElement>('img.post-card__image')!;
    expect(img.getAttribute('src')).toBe('https://cdn.test/old.webp');
    expect(img.hasAttribute('srcset')).toBe(false);
    expect(img.hasAttribute('sizes')).toBe(false);
    expect([img.getAttribute('width'), img.getAttribute('height')]).toEqual(['1600', '900']);
  });
});
