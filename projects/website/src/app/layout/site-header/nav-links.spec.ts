import { describe, expect, it } from 'vitest';
import { NAV_ALL, activeNavKey } from './nav-links';

describe('nav links', () => {
  it('lists the items in order, with Services as a route and no "What I Do"', () => {
    expect(NAV_ALL.map((l) => l.label)).toEqual(['Home', 'Services', 'Experience', 'About', 'Projects', 'Blog', 'Tools', 'Contact']);
    expect(NAV_ALL.find((l) => l.label === 'Services')?.route).toBe('/services');
    expect(NAV_ALL.some((l) => l.label === 'What I Do')).toBe(false);
  });

  it('activeNavKey: the open route wins, the home page follows the section in view', () => {
    expect(activeNavKey('/services', 'home')).toBe('route:/services');
    expect(activeNavKey('/services/mean-stack-development', 'home')).toBe('route:/services');
    expect(activeNavKey('/blog/a-post?x=1', 'home')).toBe('route:/blog');
    expect(activeNavKey('/tools/jwt-decoder', 'home')).toBe('route:/tools');
    expect(activeNavKey('/faq', 'home')).toBe('');
    expect(activeNavKey('/', 'about')).toBe('section:about');
    expect(activeNavKey('/#contact', 'contact')).toBe('section:contact');
  });

  it('on the home page the Services section lights up the Services link', () => {
    expect(activeNavKey('/', 'services')).toBe('route:/services');
  });
});
