import type { ToolPresentation } from '../../tool-meta';

/** Card icon (a key of DEVELOPER_ICONS, or an icon already registered) and one-line tagline per tool slug. */
export const DEVELOPER_PRESENTATION: Record<string, ToolPresentation> = {
  'hash-generator': { icon: 'hash', tagline: 'MD5, SHA-256, SHA-512 and HMAC of text or files.' },
  'password-generator': { icon: 'key-round', tagline: 'Random passwords and passphrases, with entropy.' },
  'qr-code-generator': { icon: 'qr-code', tagline: 'QR codes for links, WiFi, contacts and more.' },
  'url-encoder-decoder': { icon: 'link', tagline: 'Encode, decode and take apart any URL.' },
  'sql-formatter': { icon: 'database', tagline: 'Format or minify SQL for eight dialects.' },
  'color-converter': { icon: 'palette', tagline: 'HEX, RGB, HSL, OKLCH and WCAG contrast.' },
  'json-viewer': { icon: 'braces', tagline: 'Explore big JSON as a searchable tree.' },
  'meta-tag-generator': { icon: 'tags', tagline: 'Build title, Open Graph and robots tags.' },
  'robots-txt-generator': { icon: 'bot', tagline: 'Build and test robots.txt, AI crawlers included.' },
};
