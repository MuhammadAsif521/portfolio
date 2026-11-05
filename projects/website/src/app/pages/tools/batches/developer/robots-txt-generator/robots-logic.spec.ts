import { describe, expect, it } from 'vitest';
import {
  CRAWLERS,
  ROBOTS_PRESETS,
  buildRobots,
  evaluateRobots,
  lintGroups,
  normalizePath,
  parseRobots,
  parseRuleLines,
  patternMatches,
  ruleLines,
  toTestPath,
  type RobotsVerdict,
} from './robots-logic';

/** Evaluates and unwraps (the tests never expect an input error). */
const verdict = (robots: string, ua: string, target: string): RobotsVerdict => {
  const r = evaluateRobots(parseRobots(robots), ua, target);
  if ('error' in r) throw new Error(r.error);
  return r;
};

describe('patternMatches: the path-matching table from Google\'s documentation', () => {
  const yes: [string, string][] = [
    ['/', '/'],
    ['/', '/anything/deep?x=1'],
    ['/*', '/page'],
    ['/$', '/'],
    ['/fish', '/fish'],
    ['/fish', '/fish.html'],
    ['/fish', '/fish/salmon.html'],
    ['/fish', '/fishheads'],
    ['/fish', '/fishheads/yummy.html'],
    ['/fish', '/fish.php?id=anything'],
    ['/fish*', '/fish.html'],
    ['/fish/', '/fish/'],
    ['/fish/', '/fish/?id=anything'],
    ['/fish/', '/fish/salmon.htm'],
    ['/*.php', '/index.php'],
    ['/*.php', '/folder/filename.php'],
    ['/*.php', '/folder/filename.php?parameters'],
    ['/*.php', '/folder/any.php.file.html'],
    ['/*.php', '/filename.php/'],
    ['/*.php$', '/filename.php'],
    ['/*.php$', '/folder/filename.php'],
    ['/fish*.php', '/fish.php'],
    ['/fish*.php', '/fishheads/catfish.php?parameters'],
  ];
  const no: [string, string][] = [
    ['/$', '/page'],
    ['/$', '/a/b'],
    ['/fish', '/Fish.asp'],
    ['/fish', '/catfish'],
    ['/fish', '/?id=fish'],
    ['/fish', '/desert/fish'],
    ['/fish/', '/fish'],
    ['/fish/', '/fish.html'],
    ['/fish/', '/animals/fish/'],
    ['/fish/', '/Fish/Salmon.asp'],
    ['/*.php', '/'],
    ['/*.php', '/windows.PHP'],
    ['/*.php$', '/filename.php?parameters'],
    ['/*.php$', '/filename.php/'],
    ['/*.php$', '/filename.php5'],
    ['/*.php$', '/windows.PHP'],
    ['/fish*.php', '/Fish.PHP'],
  ];

  it.each(yes)('%s matches %s', (pattern, path) => expect(patternMatches(pattern, path)).toBe(true));
  it.each(no)('%s does not match %s', (pattern, path) => expect(patternMatches(pattern, path)).toBe(false));

  it('treats a $ in the middle literally and handles many wildcards without hanging', () => {
    expect(patternMatches('/a$b', '/a$b')).toBe(true);
    expect(patternMatches('/a$b', '/ab')).toBe(false);
    const hostile = '/' + 'a*'.repeat(200) + 'b';
    expect(patternMatches(hostile, '/' + 'a'.repeat(2000))).toBe(false);
  });
});

describe('precedence (Google: longest rule wins, allow wins a tie)', () => {
  it('allow: /p beats disallow: / for /page because it is longer', () => {
    expect(verdict('User-agent: *\nDisallow: /\nAllow: /p', 'Googlebot', '/page')).toMatchObject({ allowed: true });
  });

  it('allow wins when both rules are equally long', () => {
    const v = verdict('User-agent: *\nDisallow: /folder\nAllow: /folder', 'Googlebot', '/folder/page');
    expect(v.allowed).toBe(true);
    expect(v.reason).toContain('Allow wins a tie');
  });

  it('disallow: /*.htm beats allow: /page for /page.htm because it is longer', () => {
    expect(verdict('User-agent: *\nAllow: /page\nDisallow: /*.htm', 'Googlebot', '/page.htm').allowed).toBe(false);
  });

  it('allow: /$ beats disallow: / for the root only', () => {
    const robots = 'User-agent: *\nDisallow: /\nAllow: /$';
    expect(verdict(robots, 'Googlebot', '/').allowed).toBe(true);
    expect(verdict(robots, 'Googlebot', '/page').allowed).toBe(false);
  });

  it('an empty Disallow blocks nothing', () => {
    expect(verdict('User-agent: *\nDisallow:', 'Googlebot', '/anything').allowed).toBe(true);
  });

  it('reports the deciding rule and the line it came from', () => {
    const v = verdict('# c\nUser-agent: *\nDisallow: /private/', 'Googlebot', 'https://example.com/private/x?y=1');
    expect(v.allowed).toBe(false);
    expect(v.rule).toMatchObject({ type: 'disallow', path: '/private/', line: 3 });
    expect(v.path).toBe('/private/x?y=1');
  });
});

describe('group selection', () => {
  const robots = [
    'User-agent: *',
    'Disallow: /all',
    '',
    'User-agent: Googlebot',
    'Disallow: /google',
    '',
    'User-agent: Googlebot-News',
    'Disallow: /news',
    '',
    'User-agent: BadBot',
    'User-agent: WorseBot',
    'Disallow: /',
  ].join('\n');

  it('uses only the most specific group and does not merge with *', () => {
    expect(verdict(robots, 'Googlebot', '/all').allowed).toBe(true);
    expect(verdict(robots, 'Googlebot', '/google').allowed).toBe(false);
    expect(verdict(robots, 'SomeOtherBot', '/all').allowed).toBe(false);
    expect(verdict(robots, 'SomeOtherBot', '/google').allowed).toBe(true);
  });

  it('matches user-agent names case-insensitively and ignores version text', () => {
    expect(verdict(robots, 'GOOGLEBOT/2.1', '/google').allowed).toBe(false);
    expect(verdict(robots, 'googlebot', '/google').allowed).toBe(false);
  });

  it('shares one group across consecutive User-agent lines', () => {
    expect(verdict(robots, 'WorseBot', '/x').allowed).toBe(false);
    expect(verdict(robots, 'BadBot', '/x').allowed).toBe(false);
  });

  it('Googlebot-Image falls back to the Googlebot group, Googlebot-News uses its own', () => {
    expect(verdict(robots, 'Googlebot-Image', '/google').allowed).toBe(false);
    expect(verdict(robots, 'Googlebot-News', '/news').allowed).toBe(false);
    expect(verdict(robots, 'Googlebot-News', '/google').allowed).toBe(true);
  });

  it('merges several groups that name the same crawler', () => {
    const merged = 'User-agent: Bot\nDisallow: /a\n\nUser-agent: Bot\nDisallow: /b';
    expect(verdict(merged, 'Bot', '/a').allowed).toBe(false);
    expect(verdict(merged, 'Bot', '/b').allowed).toBe(false);
    expect(verdict(merged, 'Bot', '/c').allowed).toBe(true);
  });

  it('allows everything when no group applies, and always allows /robots.txt', () => {
    expect(verdict('User-agent: Bot\nDisallow: /', 'Other', '/x').allowed).toBe(true);
    expect(verdict('User-agent: *\nDisallow: /', 'Bot', '/robots.txt').allowed).toBe(true);
  });
});

describe('path handling', () => {
  it('compares percent-encoded and raw UTF-8 forms as equal', () => {
    expect(normalizePath('/ü')).toBe('/%C3%BC');
    expect(normalizePath('/%c3%bc')).toBe('/%C3%BC');
    expect(verdict('User-agent: *\nDisallow: /%c3%bc', 'Bot', '/ü').allowed).toBe(false);
    expect(verdict('User-agent: *\nDisallow: /ü', 'Bot', 'https://x.com/%C3%BC').allowed).toBe(false);
  });

  it('paths are case-sensitive', () => {
    expect(verdict('User-agent: *\nDisallow: /Private', 'Bot', '/private').allowed).toBe(true);
  });

  it('reduces URLs to path and query and strips fragments from bare paths', () => {
    expect(toTestPath('https://example.com:8080/a/b?x=1#frag')).toEqual({ ok: true, path: '/a/b?x=1' });
    expect(toTestPath('/a#frag')).toEqual({ ok: true, path: '/a' });
    expect(toTestPath('https://example.com')).toEqual({ ok: true, path: '/' });
    expect(toTestPath('')).toMatchObject({ ok: false });
    expect(toTestPath('page.html')).toMatchObject({ ok: false });
    expect(toTestPath('https://')).toMatchObject({ ok: false });
  });

  it('returns an error object for bad input', () => {
    expect(evaluateRobots(parseRobots('User-agent: *\nDisallow: /'), 'Bot', 'nope')).toHaveProperty('error');
  });
});

describe('parseRobots', () => {
  it('reads groups, comments, sitemaps and CRLF files', () => {
    const p = parseRobots('# hi\r\nUSER-AGENT: *  # everyone\r\nDisallow: /tmp/\r\nSitemap: https://example.com/sitemap.xml\r\n');
    expect(p.groups).toEqual([{ agents: ['*'], rules: [{ type: 'disallow', path: '/tmp/', line: 3 }] }]);
    expect(p.sitemaps).toEqual(['https://example.com/sitemap.xml']);
    expect(p.issues).toEqual([]);
  });

  it('starts a new group when a User-agent follows rules', () => {
    const p = parseRobots('User-agent: a\nDisallow: /x\nUser-agent: b\nDisallow: /y');
    expect(p.groups.map((g) => g.agents)).toEqual([['a'], ['b']]);
  });

  it('flags rules before any User-agent, bad paths, bad sitemaps and lines without a colon', () => {
    const p = parseRobots('Disallow: /early\nUser-agent: *\nDisallow: private\nSitemap: /relative.xml\nnonsense line');
    const messages = p.issues.map((i) => i.message).join('\n');
    expect(messages).toMatch(/before any User-agent/);
    expect(messages).toMatch(/should start with \/ or \*/);
    expect(messages).toMatch(/full URL/);
    expect(messages).toMatch(/no "field: value" colon/);
    expect(p.issues.find((i) => i.message.includes('before any'))?.level).toBe('error');
  });

  it('says that Google ignores Crawl-delay and noindex', () => {
    const p = parseRobots('User-agent: *\nCrawl-delay: 10\nNoindex: /x');
    const messages = p.issues.map((i) => i.message).join('\n');
    expect(messages).toMatch(/Google ignores Crawl-delay/);
    expect(messages).toMatch(/does not support "noindex"/);
    expect(p.groups[0].crawlDelay).toBe('10');
  });

  it('warns when the file is over 500 KiB', () => {
    const big = 'User-agent: *\n' + 'Disallow: /aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n'.repeat(13_000);
    const p = parseRobots(big);
    expect(p.bytes).toBeGreaterThan(500 * 1024);
    expect(p.issues.some((i) => i.message.includes('500 KiB'))).toBe(true);
  });

  it('handles a BOM and an empty file', () => {
    expect(parseRobots('﻿User-agent: *\nDisallow: /a').groups).toHaveLength(1);
    expect(parseRobots('')).toMatchObject({ groups: [], sitemaps: [], issues: [] });
  });
});

describe('buildRobots', () => {
  it('writes groups, rules and sitemaps', () => {
    const text = buildRobots(
      [
        { agents: ['*'], rules: [{ type: 'disallow', path: '/admin/' }, { type: 'allow', path: '/admin/public/' }] },
        { agents: ['GPTBot', 'ClaudeBot'], rules: [{ type: 'disallow', path: '/' }], crawlDelay: '5' },
      ],
      ['https://example.com/sitemap.xml'],
    );
    expect(text).toBe(
      [
        'User-agent: *',
        'Disallow: /admin/',
        'Allow: /admin/public/',
        '',
        'User-agent: GPTBot',
        'User-agent: ClaudeBot',
        'Disallow: /',
        'Crawl-delay: 5',
        '',
        'Sitemap: https://example.com/sitemap.xml',
        '',
      ].join('\n'),
    );
  });

  it('writes an empty Disallow for a group without rules, skips empty groups and returns "" for nothing', () => {
    expect(buildRobots([{ agents: ['*'], rules: [] }], [])).toBe('User-agent: *\nDisallow:\n');
    expect(buildRobots([{ agents: [' '], rules: [] }], [' '])).toBe('');
  });

  it('round-trips through parseRobots', () => {
    const text = buildRobots([{ agents: ['*'], rules: [{ type: 'disallow', path: '/a' }] }], ['https://x.com/s.xml']);
    const p = parseRobots(text);
    expect(p.groups[0].rules.map((r) => r.path)).toEqual(['/a']);
    expect(p.sitemaps).toEqual(['https://x.com/s.xml']);
    expect(p.issues).toEqual([]);
  });

  it('parses and prints rule lines', () => {
    const rules = parseRuleLines('Disallow: /a\nallow:/b\n# comment\n/c\n\n');
    expect(rules).toEqual([
      { type: 'disallow', path: '/a' },
      { type: 'allow', path: '/b' },
      { type: 'disallow', path: '/c' },
    ]);
    expect(ruleLines(rules)).toBe('Disallow: /a\nAllow: /b\nDisallow: /c');
  });
});

describe('lintGroups and presets', () => {
  it('warns when * is blocked entirely, and about bad paths', () => {
    const w = lintGroups([{ agents: ['*'], rules: [{ type: 'disallow', path: '/' }] }]);
    expect(w[0].message).toMatch(/blocks every compliant crawler/);
    const bad = lintGroups([{ agents: ['a'], rules: [{ type: 'disallow', path: 'admin' }] }]);
    expect(bad.some((i) => i.message.includes('should start with'))).toBe(true);
    expect(lintGroups([{ agents: [], rules: [] }])[0].level).toBe('error');
  });

  it('does not warn when a Disallow: / group has an Allow exception', () => {
    expect(lintGroups([{ agents: ['*'], rules: [{ type: 'disallow', path: '/' }, { type: 'allow', path: '/$' }] }])).toEqual([]);
  });

  it('every preset builds a valid file and the AI presets name the documented tokens', () => {
    for (const preset of ROBOTS_PRESETS) {
      const text = buildRobots(preset.groups, []);
      expect(parseRobots(text).issues, preset.id).toEqual([]);
    }
    const training = buildRobots(ROBOTS_PRESETS.find((p) => p.id === 'no-ai-training')!.groups, []);
    for (const token of ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot']) expect(training).toContain(`User-agent: ${token}`);
    expect(training).not.toContain('PerplexityBot');
    const all = buildRobots(ROBOTS_PRESETS.find((p) => p.id === 'no-ai-at-all')!.groups, []);
    for (const token of ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User']) expect(all).toContain(`User-agent: ${token}`);
  });

  it('the crawler list has unique tokens', () => {
    expect(new Set(CRAWLERS.map((c) => c.token)).size).toBe(CRAWLERS.length);
  });
});
