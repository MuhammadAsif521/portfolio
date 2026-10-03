/**
 * Vercel serverless entry for the website (asifdev.com).
 * Static files are served by Vercel from dist/website/browser before this function is reached (see vercel.json);
 * everything else goes through Angular SSR's Express handler, which also proxies /sitemap.xml, /robots.txt and
 * /llms.txt to portfolio-node. Env: SSR_API_KEY, API_INTERNAL_URL, ALLOWED_HOSTS.
 */
import { reqHandler } from '../dist/website/server/server.mjs';

export default reqHandler;
