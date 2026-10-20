#!/usr/bin/env node
// Seals the access-gated ringdown track for publication (ADR 0007).
//
// Run after `pnpm build` with the private repository cloned at private/:
//   node scripts/seal-ringdown.mjs
//
// For every built page under dist/ringdown/<slug>/ it encrypts the <article> with a fresh
// random content key (AES-256-GCM) and wraps that key once per access code (PBKDF2-SHA256).
// The access codes live only in private/access/codes.json; each reader gets their own.
// Output, safe to commit because it is ciphertext and compiled components only:
//   public/ringdown-sealed/manifest.json   titles and summaries (the public teaser)
//   public/ringdown-sealed/keys.json       the content key, wrapped per code
//   public/ringdown-sealed/<slug>.json     each article, encrypted
//   public/ringdown-assets/                the scripts, styles and fonts those articles load
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { webcrypto as crypto } from 'node:crypto';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const DIST = join(ROOT, 'dist');
const BASE = '/GRWU/';
const CODES = join(ROOT, 'private', 'access', 'codes.json');
const ARTICLES = join(ROOT, 'private', 'track', 'articles');
const OUT = join(ROOT, 'public', 'ringdown-sealed');
const ASSETS_OUT = join(ROOT, 'public', 'ringdown-assets');
export const ITERATIONS = 150_000;
const FONT = /\.(woff2?|ttf|otf|eot)$/;

const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const enc = new TextEncoder();

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** Title, summary and order from an article's frontmatter (flat YAML scalars only). */
function frontmatter(slug) {
  const text = readFileSync(join(ARTICLES, slug, 'index.mdx'), 'utf8');
  const block = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const get = (key) => {
    const value = block.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))?.[1]?.trim();
    return value?.replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
  };
  return {
    slug,
    title: get('title'),
    headline: get('headline'),
    summary: get('summary'),
    order: Number(get('order')),
    minutes: Number(get('minutes')) || undefined,
    status: get('status') ?? 'draft',
    updated: get('updated'),
  };
}

/** Every asset a set of entry URLs needs: static and dynamic JS imports, CSS url()s. */
function closure(entries) {
  const seen = new Set();
  const queue = [...entries];
  while (queue.length) {
    const name = queue.pop();
    if (seen.has(name)) continue;
    const file = join(DIST, 'assets', name);
    if (!existsSync(file)) fail(`missing asset ${name}`);
    seen.add(name);
    const text = readFileSync(file, 'utf8');
    if (name.endsWith('.js')) {
      for (const m of text.matchAll(/(?:from|import)\s*\(?\s*["'`]\.\/([^"'`]+)["'`]/g))
        queue.push(m[1]);
    } else if (name.endsWith('.css')) {
      // Fonts are shared with the public articles (same content hash), so they stay in assets/.
      for (const m of text.matchAll(/url\(\s*["']?(?:\.\/|\/GRWU\/assets\/)([^"')?#]+)/g)) {
        if (!FONT.test(m[1])) queue.push(m[1]);
      }
    }
  }
  return seen;
}

async function aesEncrypt(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { iv: b64(iv), data: b64(new Uint8Array(data)) };
}

async function wrapFor(code, rawKey) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, [
    'deriveKey',
  ]);
  const kek = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  return { salt: b64(salt), ...(await aesEncrypt(kek, rawKey)) };
}

async function main() {
  if (!existsSync(CODES))
    fail(`No access codes at ${CODES}. Run scripts/ringdown-codes.mjs first.`);
  const pagesDir = join(DIST, 'ringdown');
  if (!existsSync(pagesDir))
    fail('No dist/ringdown/. Build with the private repository present first.');
  const slugs = readdirSync(pagesDir).filter((s) => existsSync(join(pagesDir, s, 'index.html')));
  if (!slugs.length) fail('No ringdown pages were built.');

  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
  const rewrite = (html) => html.replaceAll(`${BASE}assets/`, `${BASE}ringdown-assets/`);

  rmSync(OUT, { recursive: true, force: true });
  rmSync(ASSETS_OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  mkdirSync(ASSETS_OUT, { recursive: true });

  const needed = new Set();
  const inlineCss = new Map();
  const manifest = [];
  for (const slug of slugs) {
    const html = readFileSync(join(pagesDir, slug, 'index.html'), 'utf8');
    const start = html.indexOf('<article');
    const end = html.indexOf('</article>');
    if (start < 0 || end < 0) fail(`${slug}: no <article> in the built page`);
    const article = html.slice(start, end + '</article>'.length);
    if (article.includes('<grwu-sealed')) {
      fail(
        `${slug}: dist/ holds the sealed shells. Run \`pnpm build\` without RINGDOWN_SEALED first.`,
      );
    }
    const styles = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
    // Astro inlines small stylesheets as <style> in the head. The sealed shell has only its
    // own, so the article's travel as a stylesheet of their own next to its other assets.
    const outside = html.slice(0, start) + html.slice(end + '</article>'.length);
    const inline = [...outside.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
      .map((m) => m[1])
      .join('\n');
    if (inline) {
      const digest = Buffer.from(
        await crypto.subtle.digest('SHA-256', enc.encode(inline)),
      ).toString('hex');
      const name = `${slug}.inline.${digest.slice(0, 10)}.css`;
      inlineCss.set(name, inline);
      styles.push(`${BASE}ringdown-assets/${name}`);
    }
    const modules = [...html.matchAll(/<script type="module" src="([^"]+)"/g)].map((m) => m[1]);
    for (const url of [
      ...styles,
      ...modules,
      ...article.matchAll(/(?:component|renderer)-url="([^"]+)"/g),
    ].map((v) => (typeof v === 'string' ? v : v[1]))) {
      if (url.startsWith(`${BASE}assets/`)) needed.add(url.slice(`${BASE}assets/`.length));
    }
    for (const m of article.matchAll(/(?:src|href)="\/GRWU\/assets\/([^"]+)"/g)) needed.add(m[1]);
    const payload = JSON.stringify({
      article: rewrite(article),
      styles: styles.map(rewrite),
      modules: modules.map(rewrite),
    });
    writeFileSync(
      join(OUT, `${slug}.json`),
      JSON.stringify(await aesEncrypt(key, enc.encode(payload))),
    );
    manifest.push(frontmatter(slug));
  }

  for (const name of closure(needed)) {
    const from = join(DIST, 'assets', name);
    const to = join(ASSETS_OUT, name);
    mkdirSync(dirname(to), { recursive: true });
    if (name.endsWith('.css'))
      writeFileSync(
        to,
        readFileSync(from, 'utf8').replace(/\/GRWU\/assets\/([^"')?#]+)/g, (url, file) =>
          FONT.test(file) ? url : `${BASE}ringdown-assets/${file}`,
        ),
      );
    else copyFileSync(from, to);
  }

  for (const [name, css] of inlineCss) writeFileSync(join(ASSETS_OUT, name), css);

  const codes = JSON.parse(readFileSync(CODES, 'utf8'));
  const keys = { iterations: ITERATIONS, entries: {} };
  for (const { id, code, revoked } of codes) {
    if (revoked) continue;
    keys.entries[id] = await wrapFor(code, rawKey);
  }
  manifest.sort((a, b) => a.order - b.order);
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(join(OUT, 'keys.json'), JSON.stringify(keys) + '\n');
  console.log(
    `sealed ${slugs.length} articles, ${needed.size} entry assets, ` +
      `${Object.keys(keys.entries).length} access codes`,
  );
}

await main();
