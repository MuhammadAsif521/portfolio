// Tailwind config for the public website build only (picked up by ./postcss.config.json). Same theme as the
// workspace config; the difference is `content`, which leaves out cusadmin so the website's global
// stylesheet carries only the utilities the website and the shared library actually use. cusadmin keeps
// using the workspace-root config.
const base = require('../../tailwind.config.js');

module.exports = {
    ...base,
    // Globs are relative to the workspace root (the directory `ng build` runs from).
    content: ['./projects/website/src/**/*.{html,ts}', './projects/shared/src/**/*.{html,ts}'],
};
