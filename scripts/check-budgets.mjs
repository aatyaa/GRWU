#!/usr/bin/env node
// Fails the build when a page ships more JavaScript up front than its budget allows.
//
// "Up front" means everything the browser runs before any lazy island wakes up:
// inline scripts, module scripts, modulepreloads, and islands hydrated with
// client:load / client:only, plus the static imports of all of those. Islands using
// client:visible, client:idle or client:media are lazy and are not counted.
//
// Usage: node scripts/check-budgets.mjs [distDir]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;
/** Gzipped bytes of up-front JavaScript allowed per page (JS_BUDGET_KB overrides, for testing). */
const BUDGET = Number(process.env.JS_BUDGET_KB ?? 20) * KB;
/** The lab is a workbench, not reader-facing content. */
const EXEMPT = [/^lab\//];

const distDir = resolve(process.argv[2] ?? 'dist');
if (!existsSync(distDir)) {
  console.error(`No build found at ${distDir}. Run \`pnpm build\` first.`);
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const gz = (text) => gzipSync(text).length;

/** Maps a URL from the HTML (with the base path) to a file in dist, or null if external. */
function resolveAsset(url, htmlFile) {
  if (/^(https?:)?\/\//.test(url)) return null;
  const clean = url.split(/[?#]/)[0];
  if (clean.startsWith('/')) {
    // Strip the base path (e.g. /GRWU/ or /GRWU/pr-preview/pr-3/) by matching the tail.
    const parts = clean.split('/').filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const candidate = join(distDir, ...parts.slice(i));
      if (existsSync(candidate)) return candidate;
    }
    return null;
  }
  const candidate = resolve(dirname(htmlFile), clean);
  return existsSync(candidate) ? candidate : null;
}

const STATIC_IMPORT =
  /(?:^|[;\n}])\s*(?:import|export)\s*(?:[\w$*{}\s,]+?\s*from\s*)?["']([^"']+)["']/g;

/** Adds a JS file and everything it statically imports to `seen`. */
function collect(file, seen) {
  if (!file || seen.has(file)) return;
  seen.add(file);
  const code = readFileSync(file, 'utf8');
  for (const [, spec] of code.matchAll(STATIC_IMPORT)) {
    if (spec.startsWith('.')) collect(resolve(dirname(file), spec), seen);
    else if (spec.startsWith('/')) collect(resolveAsset(spec, file), seen);
  }
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`));
  return match ? (match[1] ?? match[2]).replaceAll('&amp;', '&') : null;
}

const pages = walk(distDir).filter((file) => file.endsWith('.html'));
const rows = [];
let failed = false;

for (const htmlFile of pages) {
  const page = relative(distDir, htmlFile).replaceAll('\\', '/');
  const html = readFileSync(htmlFile, 'utf8');
  const files = new Set();
  let inlineBytes = 0;

  for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const type = attr(attrs, 'type');
    if (type && type !== 'module' && type !== 'text/javascript') continue; // JSON, etc.
    const src = attr(attrs, 'src');
    if (src) collect(resolveAsset(src, htmlFile), files);
    else inlineBytes += gz(body);
  }

  for (const [tag] of html.matchAll(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/g)) {
    collect(resolveAsset(attr(tag, 'href') ?? '', htmlFile), files);
  }

  for (const [tag] of html.matchAll(/<astro-island\b[^>]*>/g)) {
    const client = attr(tag, 'client');
    if (client !== 'load' && client !== 'only') continue;
    collect(resolveAsset(attr(tag, 'component-url') ?? '', htmlFile), files);
    collect(resolveAsset(attr(tag, 'renderer-url') ?? '', htmlFile), files);
  }

  let bytes = inlineBytes;
  for (const file of files) bytes += gz(readFileSync(file));

  const exempt = EXEMPT.some((pattern) => pattern.test(page));
  const over = !exempt && bytes > BUDGET;
  failed ||= over;
  rows.push({
    page,
    kb: (bytes / KB).toFixed(1),
    status: exempt ? 'exempt' : over ? 'OVER' : 'ok',
  });
}

rows.sort((a, b) => a.page.localeCompare(b.page));
const width = Math.max(...rows.map((row) => row.page.length));
console.log(`Up-front JS per page (gzip), budget ${(BUDGET / KB).toFixed(0)} KB:`);
for (const row of rows) {
  console.log(`  ${row.page.padEnd(width)}  ${row.kb.padStart(6)} KB  ${row.status}`);
}

if (failed) {
  console.error('\nJS budget exceeded. Lazy-load the heavy parts (client:visible) or trim them.');
  process.exit(1);
}
