/**
 * The access gate of the ringdown track (ADR 0007).
 *
 * <grwu-sealed data-slug="three-masses">: an article sealed by scripts/seal-ringdown.mjs.
 * With a valid access code it fetches the article's ciphertext, unwraps the content key with
 * the code (PBKDF2-SHA256, then AES-GCM), decrypts the article, loads its styles and scripts
 * and puts it in place of the gate. The code is remembered in this browser only.
 * Without data-slug the element only checks and remembers a code (the track's index page).
 *
 * State for tests and styling: data-state = locked | checking | open | wrong.
 */
const STORE = 'grwu-ringdown-code';
const BUILT_BASE = '/GRWU/';

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
  connectedCallback(): void {
    const form = this.querySelector('form');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = form.querySelector('input');
      if (input) void this.open(normalise(input.value), true);
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
    try {
      const key = await unlock(code);
      if (!key) throw new Error('wrong code');
      const slug = this.dataset.slug;
      if (!slug) {
        remember(code);
        this.dataset.state = 'open';
        return;
      }
      const box = await (await fetch(`${base}ringdown-sealed/${slug}.json`)).json();
      const payload = JSON.parse(new TextDecoder().decode(await decrypt(key, box))) as Payload;
      remember(code);
      this.show(payload);
    } catch {
      if (!typed) remember(null);
      this.dataset.state = typed ? 'wrong' : 'locked';
    }
  }

  private show(payload: Payload): void {
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

customElements.define('grwu-sealed', Sealed);
