// Checks the external links the site cites: every article's `sources` and `credits`, the track
// registry's credits, CREDITS.md and LICENSE-CONTENT.md. Run by hand (`pnpm links`), not in
// `pnpm check`: it needs the network and publishers' sites come and go.
//
// 404 and 410 fail. 401, 403 and 429 are reported as unverifiable (many publishers refuse
// scripted requests) but do not fail. Uses curl so it follows the machine's proxy settings.
import { execFile } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = new URL('..', import.meta.url).pathname;
const urls = new Map(); // url -> where it was found

function collect(file, text) {
  for (const [url] of text.matchAll(/https?:\/\/[^\s)'"<>\]]+/g)) {
    const clean = url.replace(/[.,;]+$/, '');
    if (!urls.has(clean)) urls.set(clean, file);
  }
}

const articles = join(root, 'src/content/articles');
for (const slug of readdirSync(articles)) {
  const source = readFileSync(join(articles, slug, 'index.mdx'), 'utf8');
  const front = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  collect(`articles/${slug}`, front);
}
for (const file of ['src/lib/tracks.ts', 'CREDITS.md', 'LICENSE-CONTENT.md']) {
  collect(file, readFileSync(join(root, file), 'utf8'));
}

async function status(url) {
  const args = [
    '-s',
    '-o',
    '/dev/null',
    '-L',
    '--max-time',
    '20',
    '-A',
    'Mozilla/5.0 (GRWU link check)',
    '-w',
    '%{http_code}',
  ];
  try {
    const head = (await run('curl', [...args, '-I', url])).stdout.trim();
    if (head.startsWith('2')) return Number(head);
    return Number((await run('curl', [...args, url])).stdout.trim());
  } catch {
    return 0;
  }
}

const results = [];
const queue = [...urls.keys()];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const url = queue.shift();
      results.push({ url, code: await status(url), from: urls.get(url) });
    }
  }),
);

const broken = results.filter((r) => r.code === 404 || r.code === 410);
const unverifiable = results.filter((r) => !(r.code >= 200 && r.code < 400) && !broken.includes(r));
console.log(
  `links: ${results.length} checked, ${broken.length} broken, ${unverifiable.length} unverifiable`,
);
for (const r of unverifiable) console.log(`  ?  ${r.code || 'no answer'}  ${r.url}  (${r.from})`);
for (const r of broken) console.log(`  ✗  ${r.code}  ${r.url}  (${r.from})`);
process.exit(broken.length ? 1 : 0);
