import type { LegalContext } from '../legal.content';
import { escapeHtml as e } from '../legal-html';

/*
 * Built-in Cookie Policy, shown while Site Settings → cookiePolicy is empty.
 *
 * TEMPLATE, NOT LEGAL ADVICE: review before launch. The table lists what the code really sets today:
 *  - public_session_token  portfolio-node config/constants.ts + services/publicSession.service.ts
 *                          (httpOnly, SameSite=Lax, Secure in production; maxAge = token lifetime,
 *                          PUBLIC_SESSION_TTL_MIN default 20, chain capped by PUBLIC_SESSION_MAX_HOURS default 12)
 *  - public-session-expires-at  shared/services/public-session.service.ts (localStorage)
 *  - theme-preference      shared/services/theme.service.ts + website index.html (localStorage; legacy
 *                          `theme` / `theme-explicit` keys are migrated and removed)
 *  - reCAPTCHA             loaded lazily by shared/services/recaptcha.service.ts; Google's own cookie and
 *                          storage names can change, so they are described as "may set".
 * Not listed because the website doesn't use them: the shared ConsentService (`bo_cookie_consent`) /
 * cookie-consent banner and AnalyticsService (GA/GTM) are not mounted in projects/website. If either is
 * wired up, add their entries here (and a consent banner MUST gate analytics). `pf_session` is the
 * admin's own login cookie and is mentioned only as a note.
 *
 * The table uses explicit ARIA roles so it keeps its table semantics when CSS stacks it on small screens.
 */

interface StorageRow {
  name: string;
  type: string;
  provider: string;
  purpose: string;
  duration: string;
}

const ROWS: readonly StorageRow[] = [
  {
    name: 'public_session_token',
    type: 'HTTP cookie (httpOnly, secure)',
    provider: 'First party (this site&rsquo;s API)',
    purpose:
      'Strictly necessary. Proves your browser passed the reCAPTCHA check, so the site&rsquo;s API and contact form accept its requests. Holds a signed token, not your data.',
    duration: 'About 20 minutes, renewed while you browse; 12 hours at most',
  },
  {
    name: 'public-session-expires-at',
    type: 'Local storage',
    provider: 'First party',
    purpose:
      'Strictly necessary. Stores only the expiry time of the session above, so a returning visit can reuse it instead of running reCAPTCHA again.',
    duration: 'Until the session expires or is rejected, or you clear site data',
  },
  {
    name: 'theme-preference',
    type: 'Local storage',
    provider: 'First party',
    purpose: 'Functional. Remembers the light, dark or system theme you picked. Set only when you choose a theme.',
    duration: 'Until you clear site data',
  },
  {
    name: '_GRECAPTCHA (cookie), _grecaptcha (local storage)',
    type: 'Cookie and local storage',
    provider: 'Third party (Google reCAPTCHA)',
    purpose:
      'Strictly necessary for spam protection. Set by Google&rsquo;s reCAPTCHA script to tell people and bots apart. Names and details are controlled by Google.',
    duration: 'Set by Google (the cookie typically lasts up to 6 months)',
  },
];

const HEADERS = ['Name', 'Type', 'Provider', 'Purpose', 'Duration'] as const;

function table(): string {
  const head = HEADERS.map((label) => `<th role="columnheader" scope="col">${label}</th>`).join('');
  const body = ROWS.map((row) => {
    const cells = [`<code>${row.name}</code>`, row.type, row.provider, row.purpose, row.duration];
    return (
      '<tr role="row">' +
      cells
        .map(
          (cell, i) =>
            `<td role="cell"><span class="legal-table__label" aria-hidden="true">${HEADERS[i]}</span>${cell}</td>`,
        )
        .join('') +
      '</tr>'
    );
  }).join('');
  return `<table class="legal-table" role="table"><thead role="rowgroup"><tr role="row">${head}</tr></thead><tbody role="rowgroup">${body}</tbody></table>`;
}

export function cookiePolicyDefault(ctx: LegalContext): string {
  const email = e(ctx.email);
  const site = e(ctx.siteUrl);

  return `
<p>This policy explains the cookies and similar browser storage used by <a href="${site}/">${site}</a>. It
should be read together with the <a href="/privacy-policy">Privacy Policy</a>.</p>

<h2>What cookies and local storage are</h2>
<p><strong>Cookies</strong> are small text files a website stores in your browser and receives back on later
requests. <strong>Local storage</strong> is a similar browser feature that keeps small pieces of data on your
device; it is read by the site's own scripts and is not sent to a server automatically. In this policy,
"cookies" covers both.</p>

<h2>The short version</h2>
<ul>
  <li>No advertising cookies and no analytics or tracking cookies.</li>
  <li>The cookies used are either <strong>strictly necessary</strong> (security and spam protection) or remember a
  <strong>choice you made</strong> (your theme).</li>
  <li>Google reCAPTCHA, a third-party service, may set its own cookies to protect the site from bots.</li>
</ul>

<h2>Cookies and storage this site uses</h2>
${table()}
<p>If you are the site's administrator, signing in to the admin area also sets a <code>pf_session</code> login
cookie. Visitors to the public site never receive it.</p>

<h2>Google reCAPTCHA</h2>
<p>The site uses Google reCAPTCHA v3 to protect its API and contact form from spam and abuse. Google's script is
loaded the first time your browser needs to talk to the site's API, for example when you open another page or
send a message. It may set cookies and collect information about your device and how you use the page. This is
covered by the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy
Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms of
Service</a>. Google explains its cookies in
<a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener noreferrer">How Google uses
cookies</a>.</p>

<h2>Consent and your choices</h2>
<p>Because every cookie listed above is either strictly necessary or stores a choice you made yourself, the site
does not show a consent banner. If I ever add analytics or other optional cookies, they will stay off until you
agree to them through a consent banner, and you will be able to withdraw that consent at any time.</p>
<p>You can still remove or block everything listed here:</p>
<ul>
  <li>To remove your saved theme choice, clear this site's data in your browser. Choosing "System" with the theme
  button makes the site follow your device setting again.</li>
  <li>Clearing this site's cookies and site data removes the session and preference entries. They are recreated
  only when needed.</li>
  <li>Blocking cookies or third-party scripts for this site will stop reCAPTCHA from working. The pages will still
  load, but the contact form may not send. You can always email me directly instead.</li>
</ul>

<h2>Managing cookies in your browser</h2>
<p>Most browsers let you view, delete and block cookies and site data in their settings. These guides explain how:</p>
<ul>
  <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Google Chrome</a></li>
  <li><a href="https://support.mozilla.org/kb/clear-cookies-and-site-data-firefox" target="_blank" rel="noopener noreferrer">Mozilla Firefox</a></li>
  <li><a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer">Safari (Mac)</a></li>
  <li><a href="https://support.microsoft.com/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer">Microsoft Edge</a></li>
</ul>

<h2>Changes to this policy</h2>
<p>I will update this policy whenever the cookies the site uses change. The "Last updated" date at the top shows
when it last changed.</p>

<h2>Contact</h2>
<p>Questions about cookies on this site? Email <a href="mailto:${email}">${email}</a>.</p>
`;
}
