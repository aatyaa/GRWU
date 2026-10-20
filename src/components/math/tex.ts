import katex from 'katex';

/** Renders TeX to HTML + MathML at build time. `\htmlData{term=...}` is allowed for linked terms. */
export function tex(source: string, displayMode = true): string {
  return katex.renderToString(source, {
    displayMode,
    output: 'htmlAndMathml',
    throwOnError: true,
    trust: ({ command }) => command === '\\htmlData',
    strict: (code: string) => (code === 'htmlExtension' ? 'ignore' : 'error'),
  });
}
