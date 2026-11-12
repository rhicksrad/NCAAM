This codebase is yours; what it's for and how it's built are your call, and you'll keep building on it.

# Field House

A static, no-backend site for men's college basketball, deployed to GitHub Pages at
https://rhicksrad.github.io/NCAAM/. It exists to show off: it has to look great, load fast and
be clever. Protect those three things in every change.

## The one rule about data

**Nothing here may depend on a paid API, a secret, or a server of ours.** The original site died
when a paid Ball Don't Lie key lapsed. Everything now comes from:

- **ESPN's public JSON feeds**, fetched by the visitor's browser (`src/lib/espn.ts`). No key. They
  send `Access-Control-Allow-Origin: *`. They are undocumented, so every field is parsed
  defensively and normalised into the small types exported from that file. Pages never touch raw
  ESPN JSON.
- **A baked snapshot** of those feeds (`scripts/snapshot.ts` writes `dist/data/live/*.json`). The
  deploy workflow rebuilds it on a timer. Pages paint from the snapshot first and swap in live
  data (`feed()` in `src/lib/data.ts`). If ESPN is down the snapshot stays up with an amber note.
  `data/seed/` is the committed fallback used by offline builds and CI.
- **Archives in `data/raw/`** (Sports Reference player lines, Bart Torvik efficiency, arenas,
  mascots). `scripts/derive-data.mjs` reshapes them into compact files at build time.

If a feed changes shape: re-record `tests/fixtures/espn/`, fix the normaliser, run
`pnpm snapshot --reseed`, keep the tests green.

## Layout

```
src/pages/*.ts     one entry per page (bundled by esbuild, code-split)
src/lib/           espn (feeds + types), data (snapshot/live), ui, dom, charts, chrome
src/styles/*.css   base, chrome (masthead/footer), parts (components), pages
scripts/pages.mjs  every page's title, description and static skeleton markup
scripts/build.mjs  the whole build: copy public/, derive data, snapshot, bundle, write HTML
public/art/        generated art (WebP). Originals are not kept in the repo
data/raw/          source archives, never served directly
tests/             vitest unit tests + recorded ESPN fixtures
```

## Commands

```
pnpm dev        build, serve on :4173, rebuild on change
pnpm build      production build into dist/   (SNAPSHOT=seed to stay offline)
pnpm check      everything CI runs: typecheck, test, build, budget, smoke
```

CI (`.github/workflows/ci.yml`) runs `typecheck`, `test`, `build`, `budget` and a Playwright
`smoke` on every pull request. All five must pass before merging. Don't skip or loosen a check to
get green; fix the cause. The budget (`scripts/check-budget.mjs`) is a feature: if a page gets
heavier than its allowance, make it lighter.

## Design: the field house

The page is a gym floor. Read `src/styles/site.css` first. Three surfaces:

- **floor**: headings painted straight onto the maple (`.floor-title`, multiply-blended so the
  grain shows through), separated by white court lines.
- **paint**: navy blocks for the masthead, scoreboard and hero, like a painted key.
- **sheet**: chalk-white stat paper for anything tabular; game cards are ticket stubs.

Two typefaces, self-hosted: Big Shoulders (display, uppercase, gym-signage) and Archivo (text).
Palette: ink `#14213a`, ball `#d9541e`, maple `#e2b777`, chalk `#f3f0e6`, amber `#ffb52e`,
bleacher green `#1e5a48`. Team pages take their paint from the team's own colours.

Keep it from looking machine-made:

- No purple/blue gradients, glassmorphism, glow, or gradient text. No rounded-card-with-soft-shadow
  grids. No pill badges, emoji icons, or centred hero with two buttons.
- No Inter/Roboto/system-font body text. No pure `#000` or `#fff`.
- Structure follows content: tables for tabular things, not cards. Square corners. Shadows are
  warm contact shadows on the wood, never grey blur.
- One orchestrated motion per page at most (banners unfurl, dots migrate). Animate only
  `transform` and `opacity`. Respect `prefers-reduced-motion`.
- Copy is specific and a little dry. Say what the numbers say; no filler, no invented metrics.
- Every image needs a flat-colour fallback underneath it, and must earn its bytes.

## Art

Backgrounds and textures in `public/art/` were generated with Codex CLI and then cropped and
compressed to WebP with `scripts/optimize-art.mjs`. Brief for new pieces: an old college field
house (maple floor, painted lines, enamel scoreboard, chalk); no text, logos or faces; the palette
above; nothing glossy or 3D.

## Housekeeping

- pnpm 9, Node 22, TypeScript strict. No runtime dependencies: everything in `package.json` is a
  dev tool. Think hard before adding one.
- Never commit `dist/`. Never add API keys, `.env` files or auth headers; there is nothing to
  authenticate to.
- Logos and team names belong to the schools. Keep the footer credit and the About page honest
  about sources.
