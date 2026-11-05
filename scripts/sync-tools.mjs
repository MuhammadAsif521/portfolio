/**
 * Copies the shared tool/service data files into the backend, which builds sitemap.xml, llms.txt and
 * llms-full.txt from verbatim copies. Run after editing any of them: `npm run sync:tools`.
 */
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';

const from = 'projects/shared/src/lib';
const to = '../portfolio-node/src/data';

mkdirSync(`${to}/batches`, { recursive: true });
for (const file of ['tools/tools.manifest.ts', 'tools/http-status.data.ts', 'services-pages/services.data.ts']) {
  copyFileSync(`${from}/${file}`, `${to}/${file.split('/').pop()}`);
}
const batches = readdirSync(`${from}/tools/batches`).filter((name) => name.endsWith('.tools.ts'));
for (const name of batches) copyFileSync(`${from}/tools/batches/${name}`, `${to}/batches/${name}`);
console.log(`synced 3 data files and ${batches.length} tool batches to ${to}`);
