import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { PostCard } from './post-card';

describe('PostCard', () => {
  it('is one real link to the post (stretched over the card), named by the post title', async () => {
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
    });
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    const links = el.querySelectorAll('a');
    expect(links.length).toBe(1); // one tab stop per card
    expect(links[0]?.getAttribute('href')).toBe('/blog/hello-signals');
    expect(links[0]?.textContent?.trim()).toBe('Hello signals');
    expect(links[0]?.classList).toContain('post-card__link'); // its ::after covers the card
    expect(el.querySelector('.post-card__arrow')?.getAttribute('aria-hidden')).toBe('true');
  });
});
