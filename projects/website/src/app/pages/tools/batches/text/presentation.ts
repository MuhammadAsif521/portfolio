import type { ToolPresentation } from '../../tool-meta';

/** Card icon (a key of TEXT_ICONS, or an icon already registered) and one-line tagline per tool slug. */
export const TEXT_PRESENTATION: Record<string, ToolPresentation> = {
  'word-counter': { icon: 'whole-word', tagline: 'Words, characters, reading time and keywords.' },
  'case-converter': { icon: 'case-sensitive', tagline: 'Title, sentence, camelCase, snake_case and more.' },
  'text-diff-checker': { icon: 'diff', tagline: 'Compare two texts by line, word or character.' },
  'lorem-ipsum-generator': { icon: 'text-quote', tagline: 'Placeholder text by paragraph, word or byte.' },
  'slug-generator': { icon: 'link', tagline: 'Clean URL slugs from titles, accents and scripts.' },
  'text-cleaner': { icon: 'list-ordered', tagline: 'Sort, dedupe, trim, split, join and extract lines.' },
};
