import type { LegalContext } from '../legal.content';
import { escapeHtml as e } from '../legal-html';

/*
 * Built-in Terms & Conditions, shown while Site Settings → termsAndConditions is empty.
 *
 * TEMPLATE, NOT LEGAL ADVICE: review before launch. Governing law uses Site Settings `country`
 * (falls back to Pakistan, the owner's country in the seed data and footer defaults) — confirm the
 * jurisdiction and courts clause with a lawyer, and add a code licence if you want readers to reuse
 * blog code samples under specific terms.
 */
export function termsDefault(ctx: LegalContext): string {
  const name = e(ctx.siteName);
  const email = e(ctx.email);
  const site = e(ctx.siteUrl);
  const country = e(ctx.country);

  return `
<p>These terms apply to your use of <a href="${site}/">${site}</a> (the "site"), the personal portfolio of
${name} ("I", "me"). By using the site you agree to them. If you do not agree, please do not use the site.</p>

<h2>Using this site</h2>
<p>You are welcome to browse the site, read the blog and get in touch through the contact form. When you do,
please do not:</p>
<ul>
  <li>try to break, overload or gain unauthorised access to the site, its API or its admin area;</li>
  <li>get around its security or spam protection, including Google reCAPTCHA and rate limits;</li>
  <li>scrape or download content in a way that puts a heavy load on the site;</li>
  <li>use the contact form to send spam, unlawful content or anything you do not have the right to send.</li>
</ul>
<p>I may block access or remove messages that break these rules.</p>

<h2>Intellectual property</h2>
<p>Unless stated otherwise, all content on this site &ndash; text, blog posts, code samples, designs, images and
my CV &ndash; is owned by me and <strong>all rights are reserved</strong>. You may link to any page and quote short
extracts with a clear credit and a link back. If a blog post or project page states its own licence (for example
an open-source licence for a code sample), that licence applies to that content.</p>
<p>Project case studies may show work done for clients. Client names, logos and trademarks belong to their
owners and appear only to describe that work; showing them does not imply endorsement.</p>

<h2>Project and client work</h2>
<p>The site describes my services, but nothing on it is an offer to provide them. Any project, freelance or
consulting work is governed by a <strong>separate written agreement</strong> (such as a proposal, contract or
platform order) agreed with each client. If that agreement conflicts with these terms, the agreement wins.
Estimates or replies sent in response to the contact form are not binding until such an agreement is in place.</p>

<h2>No warranty</h2>
<p>I write the content on this site carefully, but it is provided <strong>"as is"</strong> for general
information. Blog posts, tutorials and code samples reflect my experience at the time of writing and may be
incomplete or out of date. They are not professional advice for your specific situation. Test any code before
using it in production. I do not guarantee that the site will always be available, secure or free of errors.</p>

<h2>Limitation of liability</h2>
<p>To the fullest extent permitted by law, I am not liable for any indirect, incidental or consequential loss,
or for any loss of data, profit or business, arising from your use of the site or its content, including code
samples. Nothing in these terms limits or excludes liability that cannot be limited or excluded by law, such as
liability for fraud or for death or personal injury caused by negligence.</p>

<h2>External links</h2>
<p>The site links to other websites, such as project demos, social profiles and documentation. I do not control
those sites and am not responsible for their content, availability or privacy practices.</p>

<h2>Privacy</h2>
<p>How I handle personal data is explained in the <a href="/privacy-policy">Privacy Policy</a> and the
<a href="/cookie-policy">Cookie Policy</a>.</p>

<h2>Changes to these terms</h2>
<p>I may update these terms from time to time. The "Last updated" date at the top shows when they last changed.
Continuing to use the site after a change means you accept the updated terms.</p>

<h2>Governing law</h2>
<p>These terms are governed by the laws of ${country}, and the courts of ${country} have jurisdiction over any
dispute about them. If you are a consumer, this does not take away any mandatory protection you have under the
law of the country where you live.</p>

<h2>Contact</h2>
<p>Questions about these terms? Email <a href="mailto:${email}">${email}</a>.</p>
`;
}
