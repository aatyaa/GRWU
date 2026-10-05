#!/usr/bin/env node
// Creates or extends the ringdown track's access codes (ADR 0007), in the private repository:
//   node scripts/ringdown-codes.mjs [count]      (default: 30 codes in total)
// Each code is for one reader. Codes are kept in private/access/codes.json and listed for the
// owner in private/access/ACCESS_CODES.md. Re-run scripts/seal-ringdown.mjs afterwards.
// To revoke a code, set "revoked": true on it and re-seal.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { webcrypto as crypto } from 'node:crypto';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const DIR = join(ROOT, 'private', 'access');
const FILE = join(DIR, 'codes.json');
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O, 1/I/L

function group() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

const total = Number(process.argv[2] ?? 30);
if (!existsSync(join(ROOT, 'private'))) {
  console.error('The private repository is not cloned at private/.');
  process.exit(1);
}
mkdirSync(DIR, { recursive: true });
const codes = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : [];
while (codes.length < total) {
  const id = String(codes.length + 1).padStart(2, '0');
  codes.push({ id, code: `RD-${id}-${group()}-${group()}-${group()}`, givenTo: '', date: '' });
}
writeFileSync(FILE, JSON.stringify(codes, null, 2) + '\n');

const rows = codes.map(
  (c) =>
    `| ${c.id} | \`${c.code}\` | ${c.givenTo || ''} | ${c.date || ''} | ${c.revoked ? 'revoked' : ''} |`,
);
writeFileSync(
  join(DIR, 'ACCESS_CODES.md'),
  `# أكواد الدخول لمسار الـ ringdown

كل كود لشخص واحد. لما توافق على طلب، ابعت للشخص كود لسه ماحدش أخده، واكتب اسمه
وإيميله وتاريخ النهارده في الجدول (هنا أو في \`codes.json\`)، عشان تعرف مين معاه أنهي كود.

لو عاوز تقفل كود: قول لـ Claude "الغي كود رقم كذا". هيعلّم عليه revoked ويعيد التشفير،
والكود ده مش هيفتح حاجة تاني.

الملف ده خاص: متحطوش في أي مكان عام.

| # | الكود | اتدى لـ | التاريخ | الحالة |
|---|---|---|---|---|
${rows.join('\n')}
`,
);
console.log(`${codes.length} access codes in ${FILE}`);
