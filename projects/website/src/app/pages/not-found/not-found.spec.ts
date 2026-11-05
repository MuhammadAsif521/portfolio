import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { NotFoundPage } from './not-found';

describe('NotFoundPage', () => {
  it('shows the requested path, then /404 in the address bar (no navigation)', async () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideLocationMocks()] });
    const location = TestBed.inject(Location);
    location.go('/duhe');

    const fixture = TestBed.createComponent(NotFoundPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('/duhe');
    expect(location.path()).toBe('/duhe');

    vi.runAllTimers();
    expect(location.path()).toBe('/404');
    vi.useRealTimers();
  });

  it('does not rewrite /404 itself', () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideLocationMocks()] });
    const location = TestBed.inject(Location);
    location.go('/404');
    const fixture = TestBed.createComponent(NotFoundPage);
    fixture.detectChanges();
    vi.runAllTimers();
    expect(location.path()).toBe('/404');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Nothing lives at');
    vi.useRealTimers();
  });
});
