# Portfolio (asifdev.com)

The front end of the Muhammad Asif portfolio: a server-rendered **website**, a client-side **cusadmin** panel that manages its content, and a **shared** library. Angular 22 (standalone components, signals, NgRx), Tailwind CSS 3 and Vitest. The API is a separate repository, [`portfolio-node`](../portfolio-node).

## What is in the workspace

| Project    | What it is                                                           | Dev port |
| ---------- | -------------------------------------------------------------------- | -------- |
| `website`  | Public site with Angular SSR: home, case studies, blog, services, FAQ, free developer tools | 4200 |
| `cusadmin` | Admin panel (client-side only): projects, posts, settings, resume, tool switches | 4300 |
| `shared`   | Library used by both: API services, interfaces, form components, SEO and analytics services, the tools manifest | n/a |

### Website routes

`/` · `/projects/:slug` (case study with architecture diagram) · `/blog`, `/blog/:slug` · `/services`, `/services/:slug` · `/faq` · `/tools` and one page per tool · legal pages · `/404`. Unknown URLs return a real 404 and rewrite the address bar to `/404`.

### Free developer tools

Twelve client-side tools (JSON formatter, JWT decoder, regex tester, cron explainer, ObjectId to date, epoch converter, Base64, UUID, JSON to TypeScript, JSON to Mongoose schema, HTTP status codes, video to audio). They are listed in one file, [`projects/shared/src/lib/tools/tools.manifest.ts`](projects/shared/src/lib/tools/tools.manifest.ts), which drives the hub, the routes, the page copy and the backend sitemap. Each tool can be switched on or off in cusadmin; a switched-off tool returns 404 and leaves the sitemap.

## Quick start

```bash
npm ci
cp .env.example .env     # SSR settings, see below
npm run start:website    # http://localhost:4200
npm run start:cusadmin   # http://localhost:4300
```

Both apps expect the API ([`portfolio-node`](../portfolio-node), default `http://localhost:3000/api/v1`) to be running.

| Command                   | What it does                                                                 |
| ------------------------- | ---------------------------------------------------------------------------- |
| `npm start`               | Runs website and cusadmin together                                           |
| `npm test`                | Unit tests for every project (Vitest)                                        |
| `npm run build`           | Production build of website, then cusadmin                                   |
| `npm run serve:ssr:website` | Runs the built SSR server (`dist/website/server/server.mjs`)               |
| `npm run build:vercel`    | Builds both apps and assembles the Vercel output (cusadmin served at `/cusadmin/`) |
| `npm run sync:tools`      | Copies the shared data files into `../portfolio-node/src/data` (see below)   |

## SSR environment

`.env` (git-ignored) is read by the SSR server only. [`.env.example`](.env.example) documents it.

| Variable          | Purpose                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| `SSR_API_KEY`     | Must equal `SSR_API_KEY` in `portfolio-node/.env`; lets server-rendered pages call the public API |
| `API_INTERNAL_URL`| Where the SSR server reaches the API (local `http://localhost:3000/api/v1`) |
| `ALLOWED_HOSTS`   | Host names the SSR server answers for (default `asifdev.com,www.asifdev.com`) |

## Shared data that the backend also reads

Three files are the single source of truth for both repositories:

- `projects/shared/src/lib/tools/tools.manifest.ts`
- `projects/shared/src/lib/tools/http-status.data.ts`
- `projects/shared/src/lib/services-pages/services.data.ts`

The backend builds `sitemap.xml`, `llms.txt` and `llms-full.txt` from verbatim copies. After editing any of them run `npm run sync:tools`, then deploy the backend.

## Tests worth knowing

- **Content tests** fail the build if a tool or service page drops below 300 words, loses its FAQs, has an over-long title or description, or links to a page that does not exist.
- **SEO and GEO tests** cover the About passage, FAQ markup, canonical and noindex rules, real status codes and the 404 behaviour.
- The website suite runs without the API: pages are tested against stubs.

## Deployment

The website is served by Vercel: static files from `dist/website/browser`, everything else through [`api/render.mjs`](api/render.mjs) (the Angular SSR handler, which also proxies `/sitemap.xml`, `/robots.txt` and `/llms.txt` to the API). `vercel.json` sets the cache headers. Set `SSR_API_KEY`, `API_INTERNAL_URL` and `ALLOWED_HOSTS` in the Vercel project.

## Brand

The logo is an "A" monogram (chevron with a dot) on an orange tile. Favicons, the Apple touch icon, the web-app manifest icons and the default share image are in `projects/shared/src/lib/assets`. The header logo itself comes from Site Settings (cusadmin), seeded by `npm run seed:brand` in `portfolio-node`.
