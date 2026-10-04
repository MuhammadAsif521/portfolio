import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { CustomFileInputComponent } from './custom-file-input.component';

async function thumbnail(patchedImages: unknown) {
  TestBed.configureTestingModule({ providers: [{ provide: MatDialog, useValue: {} }] });
  const fixture = TestBed.createComponent(CustomFileInputComponent);
  fixture.componentRef.setInput('multiple', false);
  fixture.componentRef.setInput('patchedImages', patchedImages);
  fixture.detectChanges();
  await fixture.whenStable();
  return (fixture.nativeElement as HTMLElement).querySelector<HTMLImageElement>('.fc-file-thumb img')!;
}

describe('CustomFileInputComponent thumbnail', () => {
  it('lets a stored image with variants load its smallest copy in the 2.5rem thumbnail', async () => {
    const srcset = 'https://cdn.test/a-w480.webp 480w, https://cdn.test/a.webp 1600w';
    const img = await thumbnail({ key: 'projects/2026/10/a.webp', url: 'https://cdn.test/a.webp', alt: 'A', srcset });
    expect(img.getAttribute('src')).toBe('https://cdn.test/a.webp');
    expect(img.getAttribute('srcset')).toBe(srcset);
    expect(img.getAttribute('sizes')).toBe('2.5rem');
  });

  it('uses the plain url for images without variants', async () => {
    const img = await thumbnail({ key: 'projects/2026/09/b.webp', url: 'https://cdn.test/b.webp', alt: 'B' });
    expect(img.getAttribute('src')).toBe('https://cdn.test/b.webp');
    expect(img.hasAttribute('srcset')).toBe(false);
    expect(img.hasAttribute('sizes')).toBe(false);
  });
});
