/**
 * The access gate of the ringdown track (ADR 0007), with its reading record (ADR 0011).
 *
 * <grwu-sealed data-slug="three-masses">: an article sealed by scripts/seal-ringdown.mjs.
 * With a valid access code it fetches the article's ciphertext, unwraps the content key with
 * the code (PBKDF2-SHA256, then AES-GCM), decrypts the article, loads its styles and scripts
 * and puts it in place of the gate. The code is remembered in this browser only.
 * Without data-slug the element only checks and remembers a code (the track's index page).
 *
 * Before a code's first use the reader accepts the terms in their own name, and that
 * acceptance is recorded once: posted to the form service (data-record-key), which emails the
 * author. Nothing opens until the record has gone through. Every opened chapter carries the
 * reader's name as a notice and a watermark, on screen and in print.
 *
 * State for tests and styling: data-state = locked | checking | terms | recording |
 * unrecorded | open | wrong.
 */
import {
  AUTHOR,
  TERMS,
  TERMS_VERSION,
  buildRecord,
  validAcceptance,
  watermarkText,
  type Acceptance,
  type RecordEvent,
} from '~/lib/access-record';

const STORE = 'grwu-ringdown-code';
const ACCEPTED = 'grwu-ringdown-accepted';
const BUILT_BASE = '/GRWU/';
const RECORD_URL = 'https://api.web3forms.com/submit';

interface Wrapped {
  salt: string;
  iv: string;
  data: string;
}
interface Keys {
  iterations: number;
  entries: Record<string, Wrapped>;
}
interface Payload {
  article: string;
  styles: string[];
  modules: string[];
}

const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const base = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;
const rebase = (text: string) => (base === BUILT_BASE ? text : text.replaceAll(BUILT_BASE, base));

function remembered(): string | null {
  try {
    return localStorage.getItem(STORE);
  } catch {
    return null;
  }
}

function remember(code: string | null): void {
  try {
    if (code) localStorage.setItem(STORE, code);
    else localStorage.removeItem(STORE);
  } catch {
    // Private windows may refuse storage; the reader then enters the code on each page.
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const text = localStorage.getItem(key);
    return text ? (JSON.parse(text) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Without storage the reader accepts the terms again on each page; nothing is lost.
  }
}

const codeId = (code: string) => code.match(/^RD-(\d{2})-/)?.[1] ?? '';

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Normalises what a reader types: case, spaces, and dashes they may have dropped. */
export function normalise(input: string): string {
  const compact = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  const m = compact.match(/^RD(\d{2})([0-9A-Z]{4})([0-9A-Z]{4})([0-9A-Z]{4})$/);
  return m ? `RD-${m[1]}-${m[2]}-${m[3]}-${m[4]}` : input.trim();
}

async function decrypt(
  key: CryptoKey,
  box: { iv: string; data: string },
): Promise<Uint8Array<ArrayBuffer>> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes(box.iv) },
    key,
    bytes(box.data),
  );
  return new Uint8Array(plain);
}

/** The content key, if the code is one of the live access codes. */
async function unlock(code: string): Promise<CryptoKey | null> {
  const id = code.match(/^RD-(\d{2})-/)?.[1];
  if (!id) return null;
  const keys = (await (await fetch(`${base}ringdown-sealed/keys.json`)).json()) as Keys;
  const entry = keys.entries[id];
  if (!entry) return null;
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(code),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const kek = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bytes(entry.salt), iterations: keys.iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  try {
    const raw = await decrypt(kek, entry);
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  } catch {
    return null;
  }
}

/** Scripts set through innerHTML do not run; replace each with a live copy, in order. */
function revive(root: Element): void {
  for (const dead of root.querySelectorAll('script')) {
    const live = document.createElement('script');
    for (const { name, value } of dead.attributes) live.setAttribute(name, value);
    live.textContent = dead.textContent;
    dead.replaceWith(live);
  }
}

class Sealed extends HTMLElement {
  /** A code that opened, waiting for the terms or for its record. */
  private pending: {
    code: string;
    key: CryptoKey;
    typed: boolean;
    fresh?: Acceptance;
  } | null = null;

  connectedCallback(): void {
    const form = this.querySelector<HTMLFormElement>('form[data-code]');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = form.querySelector('input');
      if (input) void this.open(normalise(input.value), true);
    });
    const terms = this.querySelector<HTMLFormElement>('form[data-terms]');
    terms?.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.accept(terms);
    });
    this.querySelector('[data-retry]')?.addEventListener('click', () => {
      const pending = this.pending;
      if (pending) void this.proceed(pending.code, pending.key, pending.fresh ?? null);
    });
    this.querySelector('[data-forget]')?.addEventListener('click', () => {
      remember(null);
      this.dataset.state = 'locked';
    });
    const code = remembered();
    if (code) void this.open(code, false);
    else this.dataset.state = 'locked';
  }

  private async open(code: string, typed: boolean): Promise<void> {
    this.dataset.state = 'checking';
    const key = await unlock(code).catch(() => null);
    if (!key) {
      if (!typed) remember(null);
      this.dataset.state = typed ? 'wrong' : 'locked';
      return;
    }
    this.pending = { code, key, typed };
    if (this.recording && !this.acceptance(code)) {
      this.dataset.state = 'terms';
      this.querySelector<HTMLInputElement>('form[data-terms] input')?.focus();
      return;
    }
    await this.proceed(code, key, null);
  }

  private get recording(): boolean {
    return Boolean(this.dataset.recordKey);
  }

  private acceptance(code: string): Acceptance | null {
    return readJson<Record<string, Acceptance>>(ACCEPTED, {})[codeId(code)] ?? null;
  }

  private async accept(form: HTMLFormElement): Promise<void> {
    if (!this.pending) return;
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const problem = form.querySelector<HTMLElement>('[data-terms-problem]');
    if (!validAcceptance(name, email) || !data.get('accept')) {
      if (problem) problem.hidden = false;
      return;
    }
    if (problem) problem.hidden = true;
    const acceptance: Acceptance = {
      name,
      email,
      version: TERMS_VERSION,
      at: new Date().toISOString(),
    };
    this.pending.fresh = acceptance;
    await this.proceed(this.pending.code, this.pending.key, acceptance);
  }

  /**
   * Opens the chapter (or, on the index page, the track). A fresh acceptance is recorded first
   * and stored only once its record has gone through.
   */
  private async proceed(code: string, key: CryptoKey, fresh: Acceptance | null): Promise<void> {
    const slug = this.dataset.slug;
    const id = codeId(code);
    const acceptance = fresh ?? this.acceptance(code);
    if (this.recording && !acceptance) {
      this.dataset.state = 'terms';
      return;
    }
    try {
      let payload: Payload | null = null;
      if (slug) {
        this.dataset.state = 'checking';
        try {
          const box = await (await fetch(`${base}ringdown-sealed/${slug}.json`)).json();
          payload = JSON.parse(new TextDecoder().decode(await decrypt(key, box))) as Payload;
        } catch {
          const typed = this.pending?.typed ?? false;
          if (!typed) remember(null);
          this.dataset.state = typed ? 'wrong' : 'locked';
          return;
        }
      }
      // One record per reader: the acceptance, with the chapter it opened. Seeing one chapter
      // is seeing the track, so later visits are not recorded again.
      if (this.recording && fresh) {
        this.dataset.state = 'recording';
        await this.record(slug ? 'accepted-and-opened' : 'accepted', id, fresh);
        const all = readJson<Record<string, Acceptance>>(ACCEPTED, {});
        writeJson(ACCEPTED, { ...all, [id]: fresh });
      }
      remember(code);
      this.pending = null;
      if (payload) this.show(payload, acceptance, id);
      else this.dataset.state = 'open';
    } catch {
      // The record did not go through (offline, blocked, the service down): stay closed.
      this.dataset.state = 'unrecorded';
    }
  }

  private async record(event: RecordEvent, id: string, acceptance: Acceptance): Promise<void> {
    const fields = buildRecord({
      event,
      codeId: id,
      acceptance,
      termsSha256: await sha256(TERMS.join('\n')),
      chapter: this.dataset.slug
        ? { slug: this.dataset.slug, title: this.dataset.title ?? this.dataset.slug }
        : undefined,
      page: location.href,
      now: new Date(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      userAgent: navigator.userAgent,
      language: navigator.language,
    });
    const response = await fetch(RECORD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ access_key: this.dataset.recordKey, ...fields }),
    });
    const result = (await response.json().catch(() => ({}))) as { success?: boolean };
    if (!response.ok || !result.success) throw new Error('not recorded');
  }

  private show(payload: Payload, acceptance: Acceptance | null, id: string): void {
    const present = new Set(
      [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map((l) => l.href),
    );
    for (const href of payload.styles.map(rebase)) {
      const url = new URL(href, location.href).href;
      if (present.has(url)) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.append(link);
    }
    const shell = this.closest('article') ?? this;
    const holder = document.createElement('div');
    holder.innerHTML = rebase(payload.article);
    const article = holder.firstElementChild;
    if (!article) return;
    if (acceptance) mark(article, acceptance, id);
    shell.replaceWith(article);
    revive(article);
    for (const src of payload.modules.map(rebase)) {
      if (document.querySelector(`script[src="${src}"]`)) continue;
      const script = document.createElement('script');
      script.type = 'module';
      script.src = src;
      document.body.append(script);
    }
    for (const el of article.querySelectorAll('[data-reveal]')) el.classList.add('is-revealed');
    article.setAttribute('data-unsealed', 'true');
  }
}

/** The reader's name over the chapter: a notice at its head and a faint repeated mark. */
function mark(article: Element, acceptance: Acceptance, id: string): void {
  const text = watermarkText(acceptance, id, new Date());
  const notice = document.createElement('p');
  notice.className = 'sealed-notice';
  notice.setAttribute('role', 'note');
  notice.textContent = `${text}. Do not copy or share.`;
  article.prepend(notice);
  article.setAttribute('data-reader', acceptance.name);
  article.setAttribute('data-code', id);

  const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#555';
  const escape = (value: string) => value.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
  // Two short lines, centred in a tile large enough that the rotated text is never cut.
  const lines = [
    `Reading copy for ${acceptance.name} · code ${id}`,
    `Unpublished work of ${AUTHOR} · ${new Date().toISOString().slice(0, 10)}`,
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320"><g transform="rotate(-20 320 160)" font-family="sans-serif" font-size="15" fill="${escape(ink)}" text-anchor="middle">${lines.map((line, i) => `<text x="320" y="${152 + i * 22}">${escape(line)}</text>`).join('')}</g></svg>`;
  const layer = document.createElement('div');
  layer.className = 'sealed-watermark';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  document.body.append(layer);
}

customElements.define('grwu-sealed', Sealed);
