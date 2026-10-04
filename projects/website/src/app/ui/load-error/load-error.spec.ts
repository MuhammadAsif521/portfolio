import { TestBed } from '@angular/core/testing';
import { provideWebsiteIcons } from '../../core/icons';
import { LoadError } from './load-error';

describe('LoadError', () => {
  async function render(inputs: Record<string, unknown>) {
    TestBed.configureTestingModule({ providers: [provideWebsiteIcons()] });
    const fixture = TestBed.createComponent(LoadError);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    const retries: number[] = [];
    fixture.componentInstance.retry.subscribe(() => retries.push(1));
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement, retries };
  }

  it('announces the problem and offers a real "Try again" button', async () => {
    const { el, retries } = await render({ heading: 'Could not load the blog', text: 'Offline.' });
    const alert = el.querySelector('[role="alert"]')!;
    expect(alert.querySelector('.load-error__title')?.textContent).toBe('Could not load the blog');
    expect(alert.querySelector('.load-error__text')?.textContent).toBe('Offline.');
    const button = alert.querySelector<HTMLButtonElement>('button')!;
    expect(button.type).toBe('button');
    expect(button.textContent?.trim()).toBe('Try again');
    expect(alert.querySelector('i-lucide')?.getAttribute('aria-hidden')).toBe('true');
    button.click();
    expect(retries.length).toBe(1);
  });

  it('while retrying: stays focusable (aria-disabled, not disabled), says so, and ignores clicks', async () => {
    const { el, retries } = await render({ heading: 'x', retrying: true });
    const button = el.querySelector<HTMLButtonElement>('button')!;
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.textContent?.trim()).toBe('Retrying…');
    expect(el.querySelector('[role="alert"]')?.getAttribute('aria-busy')).toBe('true');
    button.click();
    expect(retries.length).toBe(0);
  });

  it('can be the page heading (h1) when the main content failed', async () => {
    const { el } = await render({ heading: 'Could not load this post', pageHeading: true });
    expect(el.querySelector('h1')?.textContent).toBe('Could not load this post');
    expect(el.querySelector('.load-error__text')?.textContent).toContain('connection');
  });
});
