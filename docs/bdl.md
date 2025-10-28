# Ball Don't Lie Proxy Notes

- The Cloudflare Worker expects the environment variable `BALLDONTLIE_API_KEY` (falls back to the legacy `BDL_API_KEY`).
- Historical `season_averages` responses (seasons before the current year) are cached for 24 hours at the edge with `stale-while-revalidate` support.
- The browser client paces proxy calls at ~3 requests per second with a single-flight limiter, memoizes in-session results, and retries 429s respecting `Retry-After` headers with jittered backoff.
- Prewarm commands:
  - `pnpm prewarm:player <playerId> [startSeason] [endSeason]`
  - `pnpm prewarm:demo` (example: LeBron James historical seasons)
- Prewarm output files land in `public/data/bdl/season_averages/{playerId}.json` and are consumed by `history.js` before live lookups. The history page hydrates current-season data after loading the prewarmed archive.
