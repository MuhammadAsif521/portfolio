import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CodeBlocksDirective, codeLanguage } from './code-blocks.directive';

const POST_A =
  '<p>Intro</p><pre><code class="language-ts">const a = 1;\nconst b = 2;</code></pre>' +
  '<pre><code class="language-bash">npm i</code></pre><pre>plain</pre>';
const POST_B = '<pre><code class="language-css">.a { color: red; }</code></pre>';

@Component({
  imports: [CodeBlocksDirective],
  template: `<div class="prose" [innerHTML]="html()" [appCodeBlocks]="html()"></div>`,
})
class Host {
  readonly html = signal(POST_A);
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  TestBed.tick();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('codeLanguage', () => {
  it('maps language-xxx / lang-xxx classes to a display name, with "Code" as the fallback', () => {
    const pre = (html: string) => Object.assign(document.createElement('div'), { innerHTML: html }).firstElementChild!;
    expect(codeLanguage(pre('<pre><code class="language-ts"></code></pre>'))).toBe('TypeScript');
    expect(codeLanguage(pre('<pre><code class="hljs language-bash"></code></pre>'))).toBe('Bash');
    expect(codeLanguage(pre('<pre class="lang-json"><code></code></pre>'))).toBe('JSON');
    expect(codeLanguage(pre('<pre><code class="language-elixir"></code></pre>'))).toBe('Elixir');
    expect(codeLanguage(pre('<pre><code></code></pre>'))).toBe('Code');
  });
});

describe('CodeBlocksDirective', () => {
  afterEach(() => vi.useRealTimers());

  it('wraps every <pre> in a card with a language label and an accessible copy button', () => {
    const { el } = setup();
    const cards = el.querySelectorAll('figure.code-block');
    expect(cards.length).toBe(3);
    expect([...cards].map((c) => c.querySelector('.code-block__lang')?.textContent)).toEqual(['TypeScript', 'Bash', 'Code']);

    const button = cards[0].querySelector('button')!;
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Copy code');
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(cards[0].querySelector(':scope > pre > code')?.textContent).toBe('const a = 1;\nconst b = 2;');
    // The surrounding content stays in place.
    expect(el.querySelector('.prose > p')?.textContent).toBe('Intro');
  });

  it('does not wrap a block twice when change detection runs again', () => {
    const { fixture, el } = setup();
    fixture.detectChanges();
    TestBed.tick();
    expect(el.querySelectorAll('figure.code-block').length).toBe(3);
    expect(el.querySelectorAll('figure.code-block figure').length).toBe(0);
  });

  it('re-runs when the content changes (navigating to another post)', () => {
    const { fixture, el } = setup();
    fixture.componentInstance.html.set(POST_B);
    fixture.detectChanges();
    TestBed.tick();
    const cards = el.querySelectorAll('figure.code-block');
    expect(cards.length).toBe(1);
    expect(cards[0].querySelector('.code-block__lang')?.textContent).toBe('CSS');
  });

  it('copies the code with the Clipboard API and shows "Copied" for 2 s', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { el } = setup();
    vi.useFakeTimers();

    const card = el.querySelector('figure.code-block')!;
    const button = card.querySelector('button')!;
    button.click();
    await vi.advanceTimersByTimeAsync(0);

    expect(writeText).toHaveBeenCalledWith('const a = 1;\nconst b = 2;');
    expect(button.textContent).toBe('Copied');
    expect(button.classList).toContain('is-copied');
    expect(card.querySelector('[role="status"]')?.textContent).toBe('Code copied to clipboard');

    await vi.advanceTimersByTimeAsync(2000);
    expect(button.textContent).toBe('Copy');
    expect(button.classList).not.toContain('is-copied');
    expect(card.querySelector('[role="status"]')?.textContent).toBe('');
  });

  it('falls back to execCommand("copy") when the Clipboard API is unavailable or rejects', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
    const { el } = setup();

    const button = el.querySelectorAll('figure.code-block button')[1] as HTMLButtonElement;
    button.click();
    await flush();
    await flush();

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(button.textContent).toBe('Copied');
    expect(document.querySelector('body > textarea')).toBeNull();
  });
});
