/**
 * Lucide's per-icon ES modules (lucide/dist/esm/icons/<name>.mjs), imported one by one in app/core/icons.ts.
 * Importing from the 'lucide' entry instead would bundle every icon: the shared IconComponent also imports
 * that entry dynamically (its fallback), which makes esbuild keep the whole module.
 */
declare module 'lucide/dist/esm/icons/*.mjs' {
  const icon: [tag: string, attrs: Record<string, string>][];
  export default icon;
}
