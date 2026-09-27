/** Joins a site-relative path onto a base path, e.g. ("/GRWU/", "about/") -> "/GRWU/about/". */
export function joinBase(base: string, path = ''): string {
  const head = base.endsWith('/') ? base : `${base}/`;
  return head + path.replace(/^\/+/, '');
}

/** Resolves a site-relative path against the configured Astro `base`. */
export function withBase(path = ''): string {
  return joinBase(import.meta.env.BASE_URL, path);
}
