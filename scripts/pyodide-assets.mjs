// Puts the Pyodide runtime the exercises use in public/pyodide/ (ADR 0010), self-hosted so the
// site, CI and every reader run the same, verified files.
//
// - The core (interpreter, standard library, lock file) comes from the pinned `pyodide` npm
//   package.
// - The scientific packages (numpy, scipy, matplotlib and their dependencies) come from the
//   matching official release on GitHub, and each file's SHA-256 is checked against the
//   package's own pyodide-lock.json.
// - Two pure-Python wheels for the step-through tracer come from PyPI, pinned by SHA-256.
//
// Downloads are cached in .cache/pyodide/; a second run is a quick check. Usage:
//   node scripts/pyodide-assets.mjs
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const npmDir = join(root, 'node_modules', 'pyodide');
const { version } = JSON.parse(readFileSync(join(npmDir, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(npmDir, 'pyodide-lock.json'), 'utf8'));
const out = join(root, 'public', 'pyodide');
const cache = join(root, '.cache', 'pyodide', version);

/** The packages exercises may load, with everything they depend on. */
export const WANTED = [
  'numpy',
  'scipy',
  'matplotlib',
  'micropip',
  'executing',
  'asttokens',
  'pygments',
  'six',
];
const CORE = [
  'pyodide.mjs',
  'pyodide.asm.mjs',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
];
const EXTRA = [
  {
    file: 'snoop-0.6.1-py3-none-any.whl',
    url: 'https://files.pythonhosted.org/packages/1e/55/294987b73579f9d6b09904c5757782891eb7bbc788d207bb5f2d0fc58f4e/snoop-0.6.1-py3-none-any.whl',
    sha256: 'fa6f3d7b8d01aa7bf09273547eb04b24c2d62e762d52dc43f0c7dc59f34bcc77',
  },
  {
    file: 'cheap_repr-0.5.2-py2.py3-none-any.whl',
    url: 'https://files.pythonhosted.org/packages/ec/52/fec0262af470a157a557e46be1d52ecdaf1695cefd80bb62bb6a07cc4ea9/cheap_repr-0.5.2-py2.py3-none-any.whl',
    sha256: '537ec1991bfee885c13c6d473afd110a408e039cde26882e95bf92761556ab6e',
  },
];

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const curl = (url, to) =>
  execFileSync('curl', ['-fsSL', '--retry', '3', '-o', to, url], { stdio: 'inherit' });

function closure(names) {
  const seen = new Set();
  const stack = [...names];
  while (stack.length) {
    const name = stack.pop();
    if (seen.has(name)) continue;
    const entry = lock.packages[name];
    if (!entry) throw new Error(`pyodide ${version} has no package "${name}"`);
    seen.add(name);
    stack.push(...entry.depends);
  }
  return [...seen].sort().map((name) => lock.packages[name]);
}

const packages = closure(WANTED);
mkdirSync(out, { recursive: true });
mkdirSync(cache, { recursive: true });

// Core files, straight from the npm package.
for (const file of CORE) copyFileSync(join(npmDir, file), join(out, file));

// Scientific packages, from the release tarball (downloaded once, extracted selectively).
const missing = packages.filter(
  (p) => !existsSync(join(cache, p.file_name)) || sha256(join(cache, p.file_name)) !== p.sha256,
);
if (missing.length) {
  const tarball = join(cache, `pyodide-${version}.tar.bz2`);
  if (!existsSync(tarball)) {
    console.log(`pyodide: downloading release ${version} (once, cached in .cache/pyodide)`);
    curl(
      `https://github.com/pyodide/pyodide/releases/download/${version}/pyodide-${version}.tar.bz2`,
      tarball,
    );
  }
  execFileSync('tar', [
    'xjf',
    tarball,
    '-C',
    cache,
    '--strip-components=1',
    ...missing.map((p) => `pyodide/${p.file_name}`),
  ]);
}
for (const p of packages) {
  const from = join(cache, p.file_name);
  if (sha256(from) !== p.sha256)
    throw new Error(`pyodide: ${p.file_name} does not match its SHA-256 in pyodide-lock.json`);
  copyFileSync(from, join(out, p.file_name));
}

// Pure-Python wheels from PyPI for the tracer.
mkdirSync(join(out, 'extra'), { recursive: true });
for (const w of EXTRA) {
  const cached = join(cache, w.file);
  if (!existsSync(cached) || sha256(cached) !== w.sha256) curl(w.url, cached);
  if (sha256(cached) !== w.sha256)
    throw new Error(`pyodide: ${w.file} does not match its pinned SHA-256`);
  copyFileSync(cached, join(out, 'extra', w.file));
}

writeFileSync(
  join(out, 'manifest.json'),
  JSON.stringify(
    {
      version,
      python: lock.info.python,
      packages: packages.map((p) => `${p.name} ${p.version}`),
      extra: EXTRA.map((w) => w.file),
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `pyodide ${version} (Python ${lock.info.python}): ${packages.length} packages verified in public/pyodide/`,
);
