// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import svelte from '@astrojs/svelte';

// Production lives at https://aatyaa.github.io/GRWU/. PR previews are served
// from /GRWU/pr-preview/pr-<n>/, so CI overrides the base path per build.
const base = process.env.BASE_PATH ?? '/GRWU/';

// Drafts are always visible in `astro dev`; preview builds opt in with SHOW_DRAFTS=1.
const showDrafts = process.env.SHOW_DRAFTS === '1';

export default defineConfig({
  site: 'https://aatyaa.github.io',
  base,
  trailingSlash: 'always',
  build: {
    // GitHub Pages runs Jekyll unless the branch root has .nojekyll, and Jekyll drops
    // folders starting with "_". A PR preview can land before any root deploy exists,
    // so keep bundled assets out of the default "_astro" folder.
    assets: 'assets',
  },
  integrations: [mdx(), svelte()],
  vite: {
    define: {
      __SHOW_DRAFTS__: JSON.stringify(showDrafts),
    },
  },
});
