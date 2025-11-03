# NCAA Men’s Basketball Hub

Fast, multi-page web app for NCAA Men’s Basketball. All data flows through a Cloudflare Worker proxy; no API keys in the browser.

## Overview

- Multi-page app with a shared look/feel and light JS modules.
- Pages fetch JSON from the NCAAM Worker:
  - Data base: `https://ncaam.hicksrch.workers.dev/v1`
  - Diagnostics: `https://ncaam.hicksrch.workers.dev/diag`
- No client Authorization headers or `.env` keys. See `agents.md`.

## Pages

- `index.html` Home: Top-25 + today/next games.
- `teams.html` Teams index with conference filter.
- `team.html?team_id=...` Team detail with recent games and standings snapshot.
- `players.html` Players index with paging and filter.
- `player.html?player_id=...` Player detail with bio and recent team games.
- `games.html` Schedule explorer with date range, team filter, and paging.
- `standings.html` Standings viewer with season and conference filter.
- `rankings.html` Rankings viewer with season, week, and poll filter.

Pages load shared assets from `/src/lib/*` and plain CSS. No hardcoded rosters in HTML.

## Data access

- All requests go through the Worker. Do not call vendor APIs directly.
- Browser helper (example):
  ```js
  // public/assets/js/ncaam.js
  export const NCAAM_BASE = "https://ncaam.hicksrch.workers.dev/v1";
  export async function ncaam(path, init = {}) {
    const url = `${NCAAM_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
    const res = await fetch(url, { ...init, method: 'GET', headers: { Accept: 'application/json', ...(init.headers || {}) } });
    if (!res.ok) throw new Error(`NCAAM ${res.status} ${res.statusText} for ${path}`);
    return res.json();
  }
````

* Typical calls:

  * `/teams?per_page=...`
  * `/players?per_page=...&page=...`
  * `/games?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&team_id=...`
  * `/standings?season=2025`
  * `/rankings?season=2025&week=1`

### NCAA logos

- Curated logo PNGs live under `public/data/logos`; filenames map to upstream team identifiers.
- The directory includes a `metadata.json` descriptor that documents the current source and update date.
- Run `pnpm run prepare:logos` to validate that the directory and metadata are present before generating logo maps.
- The legacy `public/FBS-Logo-Library-main.zip` archive is no longer used.

## Agents and rules (summary)

* Do not add Authorization headers in client code.
* Do not inject API keys via meta tags, `.env`, or build steps.
* Use `NCAAM_BASE` exclusively. Keep calls GET/HEAD.
* See `agents.md` for operational controls, rate limiting, and incident playbook.

## Tech

* Node 20
* pnpm 9
* TypeScript strict
* No binaries in repo; UTF-8 text with trailing newlines

## Quickstart

* Install:

  ```bash
  corepack enable || true
  pnpm install
  ```
* Local dev:

  * Serve the repo (any static server). Examples:

    ```bash
    pnpm dlx http-server -c-1 -p 5173 .
    # or
    python3 -m http.server 5173
    ```
  * Open `http://localhost:5173/index.html`
* Health check:

  ```bash
  curl -sS https://ncaam.hicksrch.workers.dev/diag | jq .
  ```

### Refreshing College Basketball player data

Committed player stat JSON lives under `public/data`. The static dev server (`scripts/dev/serve-public.js`) reuses that data by default for fast startup. To opt in to a fresh scrape when booting the dev server, set the environment variable `CBB_SCRAPE_ON_START` to a truthy value (for example `1`, `true`, or `yes`).

```bash
CBB_SCRAPE_ON_START=1 pnpm exec node scripts/dev/serve-public.js
```

When the flag is absent or false, the previously scraped conference and player files remain untouched.

## Scripts (optional; add as needed)

* Typecheck:

  ```bash
  pnpm run typecheck
  ```
* Lint:

  ```bash
  pnpm run lint
  ```
* Build:

  ```bash
  pnpm run build
  ```

## CI/CD

* GitHub Actions:

  * `CI` workflow runs install, optional typecheck/lint/test, optional build.
  * `pages.yml` builds and deploys to GitHub Pages.
* Artifact directory:

  * If `dist/` exists it is deployed; otherwise `public/` is deployed.

## Smoke tests

* Teams:

  ```bash
  curl -sS "https://ncaam.hicksrch.workers.dev/v1/teams?per_page=5" | jq ".data[0]"
  ```
* Standings:

  ```bash
  curl -sS "https://ncaam.hicksrch.workers.dev/v1/standings?season=2025" | jq ".data[0]"
  ```
* Rankings:

  ```bash
  curl -sS "https://ncaam.hicksrch.workers.dev/v1/rankings?season=2025&week=1" | jq ".data[0]"
  ```
* Games (window):

  ```bash
  curl -sS "https://ncaam.hicksrch.workers.dev/v1/games?start_date=2025-11-05&end_date=2025-11-10&per_page=5" | jq ".data[0]"
  ```

## Contribution checklist

* Keep season context explicit in UI copy.
* No client secrets, no Authorization headers.
* Centralize fetches through `ncaam()`; do not duplicate wrappers.
* TypeScript strict passes; lints clean.
* Pages render without console errors.

## License

MIT unless noted otherwise in subfolders.


## Chart Theme Toolkit

The reusable chart system lives under `src/lib/charts/` and is built with D3 v7 modules only (`selection`, `scale`, `axis`, `shape`, `array`, `format`, `interpolate`). Highlights:

- **Theme tokens** (`theme.ts`): Light/dark palettes, CSS variable application, numeric/date formatting helpers, and automatic text-contrast utilities.
- **Frame utilities** (`frame.ts`): Accessible SVG scaffolding with deterministic IDs, responsive viewBoxes, and pixel alignment helpers.
- **Axes & Grid** (`axes.ts`): Scale builders for linear/time/band domains, responsive tick heuristics, crisp gridlines, and an optional wrapping legend.
- **Series primitives** (`series/`): Optimized line, area, and bar renderers with non-scaling strokes and reduced-motion-aware micro-animations.
- **Tooltips** (`tooltip.ts`): Keyboard and screen-reader friendly overlays backed by an aria-live region.

Shared styles are defined in `public/styles/charts.css` with CSS custom properties for both light and dark modes. Example integrations are available in `examples/bar-basic.ts` and `examples/line-basic.ts`; each script wires up ResizeObserver-driven redraws, accessible tooltips, and shared margin conventions.

Run the focused unit tests with:

```bash
pnpm vitest run tests/theme.spec.ts
```
