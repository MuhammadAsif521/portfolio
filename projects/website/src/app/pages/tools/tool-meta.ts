import type { ToolCategory } from '@shared/tools/tools.manifest';

/** Presentation data for the tools (icon on cards and headers, one-line summary). Copy and SEO stay in the manifest. */
export interface ToolPresentation {
  /** Lucide icon name; must be listed in core/icons.ts. */
  icon: string;
  /** One short line for cards. */
  tagline: string;
}

export const TOOL_PRESENTATION: Record<string, ToolPresentation> = {
  'objectid-to-date': { icon: 'calendar-clock', tagline: 'Read the creation time hidden inside any _id.' },
  'jwt-decoder': { icon: 'key-round', tagline: "Inspect a token's header, payload and expiry." },
  'json-to-typescript': { icon: 'file-code', tagline: 'Turn a JSON sample into typed interfaces.' },
  'json-to-mongoose-schema': { icon: 'database', tagline: 'Infer a Mongoose schema and model from JSON.' },
  'cron-expression-explainer': { icon: 'clock', tagline: 'Plain-English meaning and the next five runs.' },
  'http-status-codes': { icon: 'globe', tagline: 'What each status code means and how to fix it.' },
  'video-to-audio': { icon: 'audio-lines', tagline: 'Pull the audio track out of a video as WAV.' },
  'regex-tester': { icon: 'regex', tagline: 'Test patterns live with groups and replace.' },
  'epoch-converter': { icon: 'hourglass', tagline: 'Unix seconds and milliseconds to readable dates.' },
  'base64-encoder': { icon: 'binary', tagline: 'Encode and decode text and files, URL-safe too.' },
  'uuid-generator': { icon: 'fingerprint-pattern', tagline: 'Generate v4 or v7 UUIDs and inspect any UUID.' },
  'json-formatter': { icon: 'braces', tagline: 'Format, minify and validate JSON with exact errors.' },
};

const FALLBACK: ToolPresentation = { icon: 'code', tagline: '' };

export const toolPresentation = (slug: string): ToolPresentation => TOOL_PRESENTATION[slug] ?? FALLBACK;

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  mongodb: 'MongoDB',
  typescript: 'TypeScript',
  web: 'Web',
  seo: 'SEO',
  utility: 'Utility',
};
