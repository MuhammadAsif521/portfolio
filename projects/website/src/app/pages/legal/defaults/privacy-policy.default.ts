import type { LegalContext } from '../legal.content';
import { escapeHtml as e } from '../legal-html';

/*
 * Built-in Privacy Policy, shown while Site Settings → privacyPolicy is empty.
 *
 * TEMPLATE, NOT LEGAL ADVICE: written from what the code does today (portfolio-node contact.public and
 * session controllers, ContactMessage model, PublicSessionService, ThemeService, RecaptchaService).
 * Review it (ideally with a lawyer) before launch, and re-check it whenever data handling changes —
 * e.g. analytics being wired up, a new form field, a new email/hosting provider, or a retention job.
 * The retention periods below are commitments the owner must actually keep; no automatic deletion
 * job exists in portfolio-node yet.
 */
export function privacyPolicyDefault(ctx: LegalContext): string {
  const name = e(ctx.siteName);
  const email = e(ctx.email);
  const site = e(ctx.siteUrl);
  const country = e(ctx.country);

  return `
<p>This policy explains how I, ${name}, handle personal data when you visit <a href="${site}/">${site}</a>
(the "site") or contact me through it. I have tried to keep it short and in plain English.</p>

<h2>Who I am</h2>
<p>${name} is a freelance software developer (Angular and Node.js) based in ${country}. This is my personal
portfolio site. For the purposes of data protection law (such as the EU and UK GDPR), I am the
<strong>controller</strong> of the personal data described here. You can reach me at
<a href="mailto:${email}">${email}</a>.</p>

<h2>What data I collect</h2>
<h3>When you contact me</h3>
<p>The contact form asks for your <strong>name</strong>, <strong>email address</strong>, an optional
<strong>subject</strong> and your <strong>message</strong>. The short "drop your email" boxes collect only your
email address. Along with each message, the site automatically records:</p>
<ul>
  <li>your browser's <strong>user agent</strong> (browser and operating system version);</li>
  <li>a <strong>salted, one-way hash of your IP address</strong> &ndash; not the IP address itself &ndash; used to spot
  repeated abuse;</li>
  <li>the <strong>reCAPTCHA score</strong> Google returned for your visit (a number between 0 and 1 estimating how
  likely the visitor is a human);</li>
  <li>which form you used and when you sent it.</li>
</ul>

<h3>Spam and abuse protection (Google reCAPTCHA)</h3>
<p>The site uses <strong>Google reCAPTCHA v3</strong> to keep bots away from the contact form and the site's API.
It runs invisibly in the background and is loaded the first time your browser needs to talk to the API (for
example when you open another page or send a message). reCAPTCHA collects hardware and software information,
such as device and browser data, your IP address and how you interact with the page, and sends it to Google
for analysis. Google's use of this data is governed by the
<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a> and
<a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Google Terms of Service</a>.</p>
<p>After a successful check, the site issues a short-lived session token tied to a hash of your browser's user
agent and IP address, so reCAPTCHA does not have to run again on every request.</p>

<h3>Technical data</h3>
<p>Like any website, the servers that run this site receive your IP address and standard request details
(page requested, browser type, time) because they are needed to deliver pages to you. Your IP address is held
briefly in memory to rate-limit requests. My application logs record the request method, page, status and
response time, not your IP address. My hosting provider may keep its own short-lived access and security logs.</p>

<h3>Preferences stored on your device</h3>
<p>If you choose a light or dark theme, that choice is saved in your browser's local storage, not sent to me.
See the <a href="/cookie-policy">Cookie Policy</a> for the full list of cookies and storage the site uses.</p>

<h3>Analytics</h3>
<p>This site does not currently use analytics or advertising tools. If I add analytics in the future, it will
only run after you have given consent, and I will update this policy and the Cookie Policy first.</p>

<h2>How I use your data and why</h2>
<ul>
  <li><strong>To reply to your message</strong> and discuss any project you ask about. Legal basis: taking steps at
  your request before entering into a contract, and my legitimate interest in answering enquiries
  (GDPR Art. 6(1)(b) and (f)).</li>
  <li><strong>To protect the site from spam, bots and abuse</strong> (reCAPTCHA, session tokens, rate limiting, the
  hashed IP). Legal basis: my legitimate interest in keeping the site and my inbox secure (Art. 6(1)(f)).</li>
  <li><strong>To remember your theme choice.</strong> This stays in your browser and is set only when you pick a
  theme yourself.</li>
</ul>
<p>I do not sell your data, use it for advertising, add you to a mailing list or make decisions about you
based solely on automated processing. The reCAPTCHA score is only used to filter spam.</p>

<h2>How long I keep it</h2>
<ul>
  <li><strong>Contact messages</strong> (including the hashed IP, user agent and score): for as long as I need them
  to handle your enquiry and any work that follows, and no longer than 24 months after our last contact unless
  we have an ongoing working relationship or the law requires longer. You can ask me to delete your message at
  any time.</li>
  <li><strong>Session tokens</strong>: about 20 minutes, renewed while you browse, and never longer than 12 hours.</li>
  <li><strong>Rate-limit counters</strong>: a few minutes, in memory only.</li>
  <li><strong>Theme preference</strong>: until you clear your browser's site data.</li>
</ul>

<h2>Who I share it with</h2>
<p>I share personal data only with service providers that help me run the site, and only as far as they need it:</p>
<ul>
  <li><strong>Hosting and database providers</strong>, which run the site's servers and store contact messages.</li>
  <li><strong>A transactional email provider</strong> (such as Resend or Brevo), which delivers the notification email
  containing your message to my inbox.</li>
  <li><strong>Google</strong>, for reCAPTCHA as described above.</li>
  <li><strong>Cloudflare</strong> (R2 storage), which serves the site's images and my CV. Your browser downloads these
  files directly from Cloudflare, which receives your IP address and standard request details. No form data is
  stored there.</li>
</ul>
<p>I may also disclose data if the law requires it, or to protect my rights, the site or other people. I do not
share your data with anyone else.</p>

<h2>International transfers</h2>
<p>I am based in ${country}, and my service providers may process data in other countries, including the United
States and the European Union. Where data protection law requires it, these transfers rely on appropriate
safeguards such as the European Commission's Standard Contractual Clauses or an adequacy decision.</p>

<h2>Your rights</h2>
<p>Depending on where you live, you may have the right to:</p>
<ul>
  <li><strong>access</strong> the personal data I hold about you and get a copy of it;</li>
  <li>have inaccurate data <strong>corrected</strong> (rectification);</li>
  <li>have your data <strong>deleted</strong> (erasure);</li>
  <li><strong>restrict</strong> or <strong>object to</strong> how I use it, including processing based on legitimate interests;</li>
  <li>receive your data in a portable format;</li>
  <li><strong>complain to a supervisory authority</strong>, for example the data protection authority in the EU/EEA
  country where you live or the Information Commissioner's Office (ICO) in the UK.</li>
</ul>
<p>To use any of these rights, email <a href="mailto:${email}">${email}</a>. I will reply within one month. I may
need to ask you to confirm the email address you used, so that I only release data to the right person.</p>

<h2>Security</h2>
<p>The site is served over HTTPS. IP addresses are stored only as salted hashes, session tokens are signed and
short-lived, and only I can access the admin area where messages are kept. No system is perfectly secure, but I
take reasonable technical and organisational measures to protect your data.</p>

<h2>Children</h2>
<p>This site is aimed at businesses and professionals. It is not directed at children under 16, and I do not
knowingly collect their personal data. If you believe a child has sent me personal data, please contact me and I
will delete it.</p>

<h2>Changes to this policy</h2>
<p>I may update this policy when the site or the law changes. The "Last updated" date at the top shows when it
last changed. Significant changes will be highlighted on this page.</p>

<h2>Contact</h2>
<p>Questions or requests about your personal data? Email <a href="mailto:${email}">${email}</a>.</p>
`;
}
