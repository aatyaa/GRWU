# 12. Arabic as the site's second language

- Status: accepted
- Date: 2026-10-30
- Plan: `docs/plans/arabic-translation.md`

## Context

The translation plan (§ 7) prescribes the architecture but defers the ADR. This
record fixes the technical choices so the infrastructure can be built.

## Decisions

### Routing

Astro's built-in i18n with `prefixDefaultLocale: false`:

- English keeps its current URLs (`/GRWU/articles/…`).
- Arabic lives under `/GRWU/ar/articles/…`.

`Astro.currentLocale` returns `'en'` or `'ar'` in every component. No
middleware is needed in static output mode.

### Content files

Arabic articles sit alongside their English originals:

```
src/content/articles/<slug>/
  index.mdx        ← English (existing collection: articles)
  index.ar.mdx     ← Arabic  (new collection: articlesAr)
```

A separate `articlesAr` Astro content collection loads `*/index.ar.mdx` with
its own extended schema. The slug is identical to the English slug so pages
can look up their counterpart.

### Arabic article frontmatter (extends articleSchema)

| Field                  | Type                           | Meaning                                                  |
| ---------------------- | ------------------------------ | -------------------------------------------------------- |
| `translatedFrom`       | `Date`                         | `updated` date of the English version used as the source |
| `translators`          | `string[]`                     | who wrote the Arabic version                             |
| `translationReviewers` | `string[]`                     | scientific and language reviewers                        |
| `translationStatus`    | `draft \| review \| published` | mirrors article `status`; defaults to `draft`            |

A build-time test fails if any Arabic article's `translatedFrom` is older than
the English article's `updated`, signalling that the translation is stale.

### Glossary

`glossary.json` entries gain optional Arabic fields (`arName`, `arDefinition`,
`arStatus`, `arSource`, `arRejected`, `arDerivatives`, `arNote`) matching the
schema in § 3.8 of the plan. All are optional until Phase 1 is complete.
Three build checks enforce § 3.8 once an article has `translationStatus: published`.

### Direction and equations

The `<html>` element carries `lang` and `dir` from `BaseLayout.astro` props.
Arabic pages pass `lang="ar" dir="rtl"`.

`<Eq>` wraps its KaTeX output in `<span dir="ltr" style="unicode-bidi:isolate">`.
This keeps equations left-to-right in both LTR and RTL pages without per-article
changes.

### CSS

All prose and UI styles use logical properties (`margin-inline-start`,
`padding-inline-start`, `text-align: start`). Figure components that draw
LTR coordinate axes keep physical `left/right` properties intentionally and are
marked with a comment. `float: left` pairs tied to figure layout are also kept
physical.

### Fonts

`tokens.css` declares `--f-arabic-ui` and `--f-arabic-prose` CSS variables with
system-Arabic fallbacks. IBM Plex Sans Arabic and Noto Naskh Arabic are added as
local `@font-face` declarations when the subsetted font files are produced in
Phase 2; the variables then point to them first.

### Term component

`<Term>` reads `Astro.currentLocale` to build its `/start/` link:
`start/#term-…` in English, `ar/start/#term-…` in Arabic.

### Number isolation

`src/lib/i18n.ts` exports `bdi(s)` which wraps a number or LTR token in
`<bdi>…</bdi>`. Arabic prose that embeds numbers or symbols must call this.

## Consequences

- `pnpm check` and e2e tests for existing English pages are unaffected:
  `prefixDefaultLocale: false` leaves all current URLs unchanged.
- Arabic pages generate only when at least one `index.ar.mdx` file exists.
- The `articlesAr` collection is empty until Phase 3; no Arabic routes are built
  until then except the shell pages created in Phase 2.
