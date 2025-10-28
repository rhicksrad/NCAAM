# agents.md — Cloudflare Proxy Workflow (NCAAM)

This project never ships API keys to the browser. All NCAA Men’s Basketball (Ball Don’t Lie NCAAB) requests go through the Cloudflare Worker proxy.

## Non-negotiables
- Do not add `Authorization` headers in browser code.
- Do not re-introduce any client-side key injection, meta tags, or `.env` lookups for vendor APIs.
- All network calls must use the Worker base:
  - Data: `https://ncaam.hicksrch.workers.dev/ncaam`
  - Diag: `https://ncaam.hicksrch.workers.dev/diag`
- Keep requests idempotent. Only `GET`/`HEAD` to the proxy. No `POST`/`PUT`/`PATCH`/`DELETE`.

## How to call the proxy
Create and use the helper:

```js
// public/assets/js/ncaam.js
export const NCAAM_BASE = "https://ncaam.hicksrch.workers.dev/ncaam";

export async function ncaam(path, init = {}) {
  const url = `${NCAAM_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    ...init,
    method: 'GET',
    headers: {
      Accept: "application/json",
      ...(init.headers || {})
    }
  });
  if (!res.ok) throw new Error(`NCAAM ${res.status} ${res.statusText} for ${path}`);
  return res.json();
}
````

Use it everywhere:

```js
import { ncaam } from "./assets/js/ncaam.js";

// examples
const teams = await ncaam("/teams?per_page=100");
const players = await ncaam("/players?per_page=50&page=1");
const standings = await ncaam("/standings?season=2025");
const rankings = await ncaam("/rankings?season=2025&week=1");
const games = await ncaam("/games?start_date=2025-11-05&end_date=2025-11-10&per_page=50");
```

## Expected repo state

* Removed: any client credentials files, meta tags, or `.env` lookups for API keys.
* No references to `Authorization: Bearer ...` in client code.
* `package.json` has no scripts that inject keys.
* CI workflows contain no secret injection steps for vendor APIs.

## Worker summary

* Forwards `/ncaam/*` to upstream BallDon’tLie NCAAB endpoints with a server-side key.
* CORS: permissive for `GET`/`OPTIONS`.
* Cache: edge cache on successful `GET` (TTL tuned by route in Worker).
* Debug: `GET /diag` returns `{ ok: true, ... }`.

Optional controls (can be enabled in the Worker or Cloudflare):

* Per-IP rate cap (e.g., 60/min).
* WAF allow/deny lists on the routed domain.
* Origin checks (only allow our site).

## When adding features

* Build browser code against `NCAAM_BASE`. Never call `https://api.balldontlie.io` directly.
* Keep calls cache-friendly. Prefer query params. Avoid gratuitous cache busters.
* If you need a guaranteed fresh read for a single request, append `cache=0` or a one-off `_=${Date.now()}` only for that call.

## Common pitfalls and fixes

* Calls still point to raw vendor API
  Fix: replace with `ncaam("/...")` via the helper.
* Authorization header added by habit
  Fix: remove it. Auth is server-side.
* CORS error
  Fix: ensure requests hit the Worker `https://ncaam.hicksrch.workers.dev/ncaam/...`.
* 429 Too Many Requests
  Fix: back off; respect `Retry-After`. Verify rate limit configuration.
* 403 Forbidden
  Fix: you’re outside allowlist (if enabled) or origin check failed.

## Code patterns agents must follow

* Centralize fetch logic: import `ncaam()`; do not duplicate wrappers.
* Handle failures locally with minimal retries on safe, idempotent endpoints.
* Mappers: normalize fields to the site’s NCAAM types; validate only what renderers require.
* Modules: use `type="module"` and explicit imports from `./assets/js/ncaam.js`. No globals.

## Testing checklist (run after edits)

* DevTools Network on `home`, `teams`, `players`, `games`, `standings`, `rankings` shows requests to `ncaam.hicksrch.workers.dev/ncaam/...`.
* No browser request carries an `Authorization` header.
* No fetches to legacy key files or meta tags.
* Sanity calls:

  * `GET https://ncaam.hicksrch.workers.dev/diag` returns `{ ok: true }`.
  * `ncaam("/teams?per_page=5")` returns a list with `id` and `name`.
  * Pages render without console errors.

### Screenshot requirement

* Capture and attach a screenshot from the local dev server showing the updated page pulling from the Worker (Network tab visible). Reviewers verify content and accuracy before approval.

## CI/CD notes

* Keep existing build/validate steps.
* CI may call the proxy just like the browser. No secret injection into artifacts.

## Operational controls (reference)

* Rate limit: 60/min per IP via Worker logic or Cloudflare WAF on `/ncaam/*`.
* IP policy: WAF allow/deny or inline checks on `CF-Connecting-IP`.
* Secret rotation: rotate `BDL_API_KEY` in the Worker’s Secrets. No repo changes required.

## Incident playbook

* 401 from upstream: rotate Worker secret.
* 403 to clients: check allowlist/origin checks.
* 429 spikes: adjust rate limits; look for hot loops.
* High latency/errors: check upstream status, reduce cache misses, inspect Worker logs.

Keep it simple: use the proxy, keep secrets server-side, never reintroduce client auth.
