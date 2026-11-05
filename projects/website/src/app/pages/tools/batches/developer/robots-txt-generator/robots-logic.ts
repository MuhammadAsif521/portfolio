/**
 * robots.txt building, parsing, linting and URL testing.
 * Matching follows Google's documented rules ("How Google interprets the robots.txt specification"):
 * the most specific (longest) path wins, allow wins a tie, * matches any run of characters, $ anchors the end,
 * paths are case-sensitive, user-agent names are not, and field names are not.
 */

export type RuleType = 'allow' | 'disallow';

export interface RobotsRule {
  type: RuleType;
  path: string;
  /** 1-based source line when parsed from text. */
  line?: number;
}

export interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
  crawlDelay?: string;
}

export interface RobotsIssue {
  /** 1-based line, or 0 when it applies to the whole file. */
  line: number;
  level: 'error' | 'warning' | 'info';
  message: string;
}

export interface ParsedRobots {
  groups: RobotsGroup[];
  sitemaps: string[];
  issues: RobotsIssue[];
  bytes: number;
}

/** Google reads at most 500 KiB of a robots.txt file and ignores the rest. */
export const GOOGLE_MAX_BYTES = 500 * 1024;

const encoder = new TextEncoder();

// Parsing ----------------------------------------------------------------------------------------------------------

/** Rules Google ignores, with the reason worth telling the user. */
const UNSUPPORTED: Record<string, string> = {
  'crawl-delay': 'Google ignores Crawl-delay. Some other crawlers (for example Anthropic\'s ClaudeBot) read it.',
  noindex: 'Google does not support "noindex" in robots.txt. Use a robots meta tag or X-Robots-Tag header instead.',
  nofollow: 'Google does not support "nofollow" in robots.txt.',
  host: '"Host" is not a Google directive and is ignored.',
};

export function parseRobots(text: string): ParsedRobots {
  const issues: RobotsIssue[] = [];
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let collectingAgents = false;
  const lines = text.replace(/^﻿/, '').split(/\r\n|\r|\n/);

  lines.forEach((raw, index) => {
    const line = index + 1;
    const hash = raw.indexOf('#');
    const content = (hash === -1 ? raw : raw.slice(0, hash)).trim();
    if (!content) return;
    const colon = content.indexOf(':');
    if (colon === -1) {
      issues.push({ line, level: 'warning', message: `Line ignored: it has no "field: value" colon ("${content.slice(0, 40)}").` });
      return;
    }
    const field = content.slice(0, colon).trim().toLowerCase();
    const value = content.slice(colon + 1).trim();

    if (field === 'user-agent') {
      if (!value) {
        issues.push({ line, level: 'warning', message: 'User-agent has no value and is ignored.' });
        return;
      }
      if (!current || !collectingAgents) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value);
      collectingAgents = true;
      return;
    }

    if (field === 'sitemap') {
      if (!/^https?:\/\/\S+$/i.test(value)) issues.push({ line, level: 'warning', message: 'Sitemap must be a full URL starting with https:// or http://.' });
      else sitemaps.push(value);
      return;
    }

    if (field === 'allow' || field === 'disallow') {
      if (!current) {
        issues.push({ line, level: 'error', message: `${field === 'allow' ? 'Allow' : 'Disallow'} comes before any User-agent line, so no crawler follows it.` });
        return;
      }
      collectingAgents = false;
      if (value && !value.startsWith('/') && !value.startsWith('*')) {
        issues.push({ line, level: 'warning', message: `Path "${value.slice(0, 40)}" should start with / or *. As written it will not match any URL path.` });
      }
      if (/\s/.test(value)) issues.push({ line, level: 'warning', message: 'Path contains a space. Encode it as %20.' });
      current.rules.push({ type: field, path: value, line });
      return;
    }

    if (field === 'crawl-delay') {
      if (!current) {
        issues.push({ line, level: 'error', message: 'Crawl-delay comes before any User-agent line.' });
        return;
      }
      collectingAgents = false;
      if (!/^\d+(\.\d+)?$/.test(value)) issues.push({ line, level: 'warning', message: 'Crawl-delay should be a number of seconds.' });
      current.crawlDelay = value;
      issues.push({ line, level: 'info', message: UNSUPPORTED['crawl-delay'] });
      return;
    }

    issues.push({
      line,
      level: field in UNSUPPORTED ? 'warning' : 'info',
      message: UNSUPPORTED[field] ?? `Unknown field "${field}" is ignored by Google.`,
    });
  });

  const bytes = encoder.encode(text).length;
  if (bytes > GOOGLE_MAX_BYTES) {
    issues.push({ line: 0, level: 'warning', message: `The file is ${Math.round(bytes / 1024)} KiB. Google ignores everything after 500 KiB.` });
  }
  return { groups, sitemaps, issues, bytes };
}

/** Warnings about what the rules do, beyond syntax. */
export function lintGroups(groups: RobotsGroup[]): RobotsIssue[] {
  const out: RobotsIssue[] = [];
  for (const group of groups) {
    const names = group.agents.join(', ') || '(no user-agent)';
    if (!group.agents.length) out.push({ line: 0, level: 'error', message: 'A group needs at least one user-agent.' });
    const blocksAll = group.rules.some((r) => r.type === 'disallow' && (r.path === '/' || r.path === '/*'));
    const exempt = group.rules.some((r) => r.type === 'allow' && r.path !== '');
    if (blocksAll && group.agents.includes('*') && !exempt) {
      out.push({ line: 0, level: 'warning', message: 'User-agent: * with Disallow: / blocks every compliant crawler from the whole site, including Googlebot.' });
    } else if (blocksAll && !exempt) {
      out.push({ line: 0, level: 'info', message: `${names} is blocked from the whole site.` });
    }
    for (const rule of group.rules) {
      if (rule.path && !rule.path.startsWith('/') && !rule.path.startsWith('*')) {
        out.push({ line: 0, level: 'warning', message: `Path "${rule.path}" should start with / or *.` });
      }
      if (/\s/.test(rule.path)) out.push({ line: 0, level: 'warning', message: `Path "${rule.path}" contains a space. Encode it as %20.` });
    }
  }
  return out;
}

// Building ---------------------------------------------------------------------------------------------------------

export function buildRobots(groups: RobotsGroup[], sitemaps: string[]): string {
  const blocks: string[] = [];
  for (const group of groups) {
    const agents = group.agents.map((a) => a.trim()).filter(Boolean);
    if (!agents.length) continue;
    const lines = agents.map((a) => `User-agent: ${a}`);
    const rules = group.rules.filter((r) => r.path.trim() !== '' || r.type === 'disallow');
    if (!rules.length) lines.push('Disallow:');
    for (const rule of rules) lines.push(ruleLine(rule));
    if (group.crawlDelay?.trim()) lines.push(`Crawl-delay: ${group.crawlDelay.trim()}`);
    blocks.push(lines.join('\n'));
  }
  const maps = sitemaps.map((s) => s.trim()).filter(Boolean);
  if (maps.length) blocks.push(maps.map((s) => `Sitemap: ${s}`).join('\n'));
  return blocks.length ? `${blocks.join('\n\n')}\n` : '';
}

/** Parses "Allow: /x" / "Disallow: /y" lines (or bare paths after a type keyword) typed into a rules box. */
export function parseRuleLines(text: string): RobotsRule[] {
  const rules: RobotsRule[] = [];
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(allow|disallow)\s*:\s*(.*)$/i.exec(line);
    if (m) rules.push({ type: m[1].toLowerCase() as RuleType, path: m[2].trim() });
    else rules.push({ type: 'disallow', path: line });
  }
  return rules;
}

const ruleLine = (r: RobotsRule): string => `${r.type === 'allow' ? 'Allow' : 'Disallow'}:${r.path.trim() ? ` ${r.path.trim()}` : ''}`;

export const ruleLines = (rules: RobotsRule[]): string => rules.map(ruleLine).join('\n');

// Matching ---------------------------------------------------------------------------------------------------------

/** Percent-encodes non-ASCII characters as UTF-8 and upper-cases existing escapes, so equivalent forms compare equal. */
export function normalizePath(path: string): string {
  let out = '';
  for (const ch of path) {
    out += ch.charCodeAt(0) > 0x7f ? encodeURIComponent(ch) : ch;
  }
  return out.replace(/%[0-9a-f]{2}/gi, (m) => m.toUpperCase());
}

/**
 * True when `path` matches the robots pattern: a prefix match, where * matches any run of characters and a final $
 * anchors the end. Linear-time (no regular expressions), so hostile patterns cannot hang the page.
 */
export function patternMatches(pattern: string, path: string): boolean {
  let pat = pattern;
  const anchored = pat.endsWith('$');
  if (anchored) pat = pat.slice(0, -1);
  let p = 0;
  let t = 0;
  let star = -1;
  let mark = 0;
  while (t < path.length) {
    if (p < pat.length && pat[p] === '*') {
      star = p++;
      mark = t;
    } else if (p < pat.length && pat[p] === path[t]) {
      p++;
      t++;
    } else if (p === pat.length && !anchored) {
      return true; // pattern fully consumed: everything after it is the "prefix" part
    } else if (star !== -1) {
      p = star + 1;
      t = ++mark;
    } else {
      return false;
    }
  }
  while (p < pat.length && pat[p] === '*') p++;
  return p === pat.length;
}

/** Crawlers that follow the Googlebot group when they have no group of their own (Google's crawler documentation). */
const GROUP_FALLBACK: Record<string, string> = {
  'googlebot-image': 'googlebot',
  'googlebot-news': 'googlebot',
  'googlebot-video': 'googlebot',
};

export interface RobotsVerdict {
  allowed: boolean;
  /** The rule that decided it, or null when no rule matched / no group applies. */
  rule: RobotsRule | null;
  /** The user-agent value of the group that applied ("*" for the default group), or null. */
  group: string | null;
  /** Every rule that matched, longest first. */
  matched: RobotsRule[];
  reason: string;
  path: string;
}

/** The path and query Google would test: a full URL is reduced to path + query, a bare path is used as given. */
export function toTestPath(input: string): { ok: true; path: string } | { ok: false; error: string } {
  const text = input.trim();
  if (!text) return { ok: false, error: 'Enter a URL or a path.' };
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      return { ok: true, path: normalizePath(url.pathname + url.search) };
    } catch {
      return { ok: false, error: 'That is not a valid URL.' };
    }
  }
  if (!text.startsWith('/')) return { ok: false, error: 'Enter a full URL (https://example.com/page) or a path that starts with /.' };
  const hashAt = text.indexOf('#');
  return { ok: true, path: normalizePath(hashAt === -1 ? text : text.slice(0, hashAt)) };
}

/** Decides whether `userAgent` may fetch `target` under the parsed rules, using Google's precedence. */
export function evaluateRobots(parsed: ParsedRobots, userAgent: string, target: string): RobotsVerdict | { error: string } {
  const test = toTestPath(target);
  if (!test.ok) return { error: test.error };
  const path = test.path;
  const token = (/^[a-z0-9_-]+/i.exec(userAgent.trim())?.[0] ?? '*').toLowerCase();

  const groupsFor = (name: string) => parsed.groups.filter((g) => g.agents.some((a) => a.toLowerCase() === name));
  let selected = token === '*' ? [] : groupsFor(token);
  let label = token;
  const fallback = GROUP_FALLBACK[token];
  if (!selected.length && fallback) {
    selected = groupsFor(fallback);
    label = fallback;
  }
  if (!selected.length) {
    selected = groupsFor('*');
    label = '*';
  }

  if (path === '/robots.txt') {
    return { allowed: true, rule: null, group: selected.length ? label : null, matched: [], reason: 'robots.txt itself is always fetchable.', path };
  }
  if (!selected.length) {
    return { allowed: true, rule: null, group: null, matched: [], reason: 'No group applies to this crawler, so everything is allowed.', path };
  }

  const matched = selected
    .flatMap((g) => g.rules)
    .filter((r) => r.path !== '')
    .map((r) => ({ rule: r, pattern: normalizePath(r.path) }))
    .filter(({ pattern }) => patternMatches(pattern, path))
    .sort((a, b) => b.pattern.length - a.pattern.length || (a.rule.type === 'allow' ? -1 : 1) - (b.rule.type === 'allow' ? -1 : 1))
    .map((m) => m.rule);

  const best = matched[0] ?? null;
  if (!best) {
    return { allowed: true, rule: null, group: label, matched, reason: 'No rule in the applicable group matches this path, so it is allowed.', path };
  }
  const tie = matched.some((r) => r.type !== best.type && normalizePath(r.path).length === normalizePath(best.path).length);
  const verb = best.type === 'allow' ? 'Allow' : 'Disallow';
  return {
    allowed: best.type === 'allow',
    rule: best,
    group: label,
    matched,
    reason: `${verb}: ${best.path} is the longest matching rule${tie ? ' (equally long rules conflict, and Allow wins a tie)' : ''}.`,
    path,
  };
}

// Crawler list and presets ------------------------------------------------------------------------------------------

export type CrawlerKind = 'search' | 'ai-training' | 'ai-search' | 'ai-user' | 'other';

export interface Crawler {
  token: string;
  vendor: string;
  kind: CrawlerKind;
  /** What blocking it does, in one honest sentence. */
  note: string;
}

/** robots.txt tokens checked against each vendor's own documentation (see the tool's copy for sources). */
export const CRAWLERS: readonly Crawler[] = [
  { token: 'Googlebot', vendor: 'Google', kind: 'search', note: 'Google Search. Blocking it removes the site from crawling by Google Search.' },
  { token: 'Googlebot-Image', vendor: 'Google', kind: 'search', note: 'Google Images and image features.' },
  { token: 'Googlebot-News', vendor: 'Google', kind: 'search', note: 'Google News.' },
  { token: 'Googlebot-Video', vendor: 'Google', kind: 'search', note: 'Video features in Search.' },
  { token: 'Google-Extended', vendor: 'Google', kind: 'ai-training', note: 'Controls use of crawled content for Gemini training and grounding. It does not affect Search inclusion or ranking.' },
  { token: 'GoogleOther', vendor: 'Google', kind: 'other', note: 'A generic Google crawler used by product teams, for example for research.' },
  { token: 'Bingbot', vendor: 'Microsoft', kind: 'search', note: 'Bing Search.' },
  { token: 'GPTBot', vendor: 'OpenAI', kind: 'ai-training', note: 'Content that may be used to train OpenAI models.' },
  { token: 'OAI-SearchBot', vendor: 'OpenAI', kind: 'ai-search', note: 'ChatGPT search. Blocking it keeps the site out of ChatGPT search answers.' },
  { token: 'ChatGPT-User', vendor: 'OpenAI', kind: 'ai-user', note: 'Fetches pages when a ChatGPT user asks. OpenAI says robots.txt rules may not apply to user-initiated actions.' },
  { token: 'ClaudeBot', vendor: 'Anthropic', kind: 'ai-training', note: 'Content that may be used to train Claude models.' },
  { token: 'Claude-SearchBot', vendor: 'Anthropic', kind: 'ai-search', note: 'Improves the quality of search results in Claude.' },
  { token: 'Claude-User', vendor: 'Anthropic', kind: 'ai-user', note: 'Fetches pages when a Claude user asks a question that needs them.' },
  { token: 'PerplexityBot', vendor: 'Perplexity', kind: 'ai-search', note: 'Surfaces and links sites in Perplexity search results; Perplexity says it is not used for training.' },
  { token: 'Perplexity-User', vendor: 'Perplexity', kind: 'ai-user', note: 'User-initiated fetches. Perplexity says it generally ignores robots.txt.' },
  { token: 'Applebot-Extended', vendor: 'Apple', kind: 'ai-training', note: 'Opts content out of Apple generative AI training. It does not crawl and does not affect Search.' },
  { token: 'CCBot', vendor: 'Common Crawl', kind: 'ai-training', note: 'Common Crawl\'s open web archive, widely used as AI training data.' },
];

export interface RobotsPreset {
  id: string;
  name: string;
  description: string;
  groups: RobotsGroup[];
}

const tokensOf = (...kinds: CrawlerKind[]): string[] => CRAWLERS.filter((c) => kinds.includes(c.kind)).map((c) => c.token);

export const ROBOTS_PRESETS: readonly RobotsPreset[] = [
  {
    id: 'allow-all',
    name: 'Allow everything',
    description: 'Every crawler may fetch every URL. An empty Disallow means "nothing is blocked".',
    groups: [{ agents: ['*'], rules: [{ type: 'disallow', path: '' }] }],
  },
  {
    id: 'block-all',
    name: 'Block everything',
    description: 'For staging sites. Compliant crawlers stay out, but URLs can still be indexed if linked elsewhere.',
    groups: [{ agents: ['*'], rules: [{ type: 'disallow', path: '/' }] }],
  },
  {
    id: 'standard',
    name: 'Typical site',
    description: 'Everyone allowed, with admin, API and internal search kept out of crawling.',
    groups: [
      {
        agents: ['*'],
        rules: [
          { type: 'disallow', path: '/admin/' },
          { type: 'disallow', path: '/api/' },
          { type: 'disallow', path: '/*?s=' },
        ],
      },
    ],
  },
  {
    id: 'no-ai-training',
    name: 'Opt out of AI training',
    description: 'Search engines allowed. Training-focused crawlers (GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, CCBot) blocked.',
    groups: [
      { agents: ['*'], rules: [{ type: 'disallow', path: '' }] },
      { agents: tokensOf('ai-training'), rules: [{ type: 'disallow', path: '/' }] },
    ],
  },
  {
    id: 'no-ai-at-all',
    name: 'Block all AI crawlers',
    description: 'Also blocks AI search and user-fetch crawlers, so the site will not be cited in those products. User-initiated fetchers may ignore robots.txt.',
    groups: [
      { agents: ['*'], rules: [{ type: 'disallow', path: '' }] },
      { agents: tokensOf('ai-training', 'ai-search', 'ai-user'), rules: [{ type: 'disallow', path: '/' }] },
    ],
  },
];
