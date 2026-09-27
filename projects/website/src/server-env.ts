import { existsSync } from 'node:fs';

/*
 * Server-only: loads ./.env (the workspace root locally, the working directory in the container) into
 * process.env before the SSR config reads SSR_API_KEY / API_INTERNAL_URL. Variables already set in the
 * real environment win. Never imported by browser code, so nothing here reaches the client bundle.
 */
if (existsSync('.env')) {
  try {
    process.loadEnvFile('.env');
  } catch (err) {
    console.warn('[ssr] Could not read .env:', err);
  }
}
