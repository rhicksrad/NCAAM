# agents.md — Cloudflare Proxy Workflow (NCAAM)

This project **never** exposes API keys to the browser.
All NCAA Men’s Basketball (Ball Don’t Lie NCAAB) requests must go through the **Cloudflare Worker proxy**, which securely attaches the API key on the server side.

---

## 🔒 Non-negotiables

**Absolutely required for all agents and contributors:**

* ❌ **Never** add `Authorization` headers in client or browser code.
* ❌ **Never** include `.env`, meta tags, or client-side credential lookups.
* ✅ All browser fetches **must** go through the Worker endpoint:

  * **Base Data**: `https://ncaam.hicksrch.workers.dev/v1`
  * **Diagnostics**: `https://ncaam.hicksrch.workers.dev/diag`
* ✅ Only use **`GET`** or **`HEAD`** requests.
  The proxy and upstream are read-only; no `POST`, `PUT`, `PATCH`, or `DELETE` are ever allowed.
* ✅ Keep requests idempotent and cache-friendly.

---

## ⚙️ How to call the proxy

Always use the provided helper. Never call `fetch("https://api.balldontlie.io/ncaab/...")` directly.

```js
// public/assets/js/ncaam.js

export const NCAAM_BASE = "https://ncaam.hicksrch.workers.dev/v1";

/**
 * Fetch data from the NCAAM Cloudflare Worker proxy.
 * Automatically handles JSON, errors, and consistent headers.
 *
 * @param {string} path - The endpoint path, e.g. "/teams?per_page=100"
 * @param {object} [init] - Optional fetch configuration (no Authorization!)
 */
export async function ncaam(path, init = {}) {
  const url = `${NCAAM_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    ...init,
    method: 'GET',
    headers: {
      Accept: "application/json",
      ...(init.headers || {})
    },
  });

  if (!res.ok) {
    throw new Error(`NCAAM ${res.status} ${res.statusText} for ${path}`);
  }

  return res.json();
}
```

### ✅ Examples

```js
import { ncaam } from "./assets/js/ncaam.js";

// Get all teams
const teams = await ncaam("/teams?per_page=100");

// Get players (page 2)
const players = await ncaam("/players?per_page=50&page=2");

// Get standings for a specific season
const standings = await ncaam("/standings?season=2025");

// Get AP Top 25 rankings for week 3
const rankings = await ncaam("/rankings?season=2025&week=3");

// Get recent games in a date window
const games = await ncaam("/games?start_date=2025-11-05&end_date=2025-11-10&per_page=25");

// Fetch a single team by ID
const duke = await ncaam("/teams/3");

// Health check (useful for CI or debugging)
const diag = await ncaam("/diag");
console.log(diag.ok, diag.hasKey, diag.ts);
```

> 💡 **Tip:**
> Always prefix with `/v1/…` or `/ncaab/v1/…`.
> The Worker normalizes both formats automatically.

---

## 🧩 Expected repository state

* ✅ No `.env` files or inlined credentials.
* ✅ No `Authorization: Bearer ...` strings in any client or build script.
* ✅ `package.json` contains no key-injection logic.
* ✅ CI pipelines never expose secrets.
* ✅ Worker secret `BDL_API_KEY` is configured **only** in Cloudflare’s dashboard.

---

## 🚀 Worker summary

**Proxy behavior overview**

| Aspect               | Description                                             |
| -------------------- | ------------------------------------------------------- |
| **Upstream**         | `https://api.balldontlie.io/ncaab`                      |
| **Allowed methods**  | `GET`, `HEAD`, `OPTIONS` (CORS preflight only)          |
| **Key storage**      | `env.BDL_API_KEY` (Worker secret, never client-visible) |
| **CORS policy**      | Permissive (`*`) for `GET`, `HEAD`, and `OPTIONS`       |
| **Diagnostics**      | `/diag` → `{ ok: true, upstream, hasKey, ts, ... }`     |
| **Error handling**   | Returns JSON: `{ ok: false, error: "..." }`             |
| **Cache (optional)** | Public edge cache (configurable TTL)                    |
| **Normalization**    | `/ncaab/v1/...` → `/v1/...`                             |
| **Fallback**         | Returns 404 JSON on unrecognized paths                  |

### 🔍 Sample responses

**`GET /diag`**

```json
{
  "ok": true,
  "upstream": "https://api.balldontlie.io/ncaab",
  "hasKey": true,
  "path": "/diag",
  "query": {},
  "ts": "2025-10-28T16:22:51.123Z"
}
```

**`GET /v1/teams?per_page=3`**

```json
{
  "data": [
    { "id": 1, "full_name": "Duke Blue Devils" },
    { "id": 2, "full_name": "Kansas Jayhawks" },
    { "id": 3, "full_name": "North Carolina Tar Heels" }
  ],
  "meta": { "total_pages": 40, "per_page": 3 }
}
```

---

## 🧠 When adding features

* Always use `ncaam()` helper for all requests.
* Never fetch `https://api.balldontlie.io` directly.
* Keep requests cache-friendly:

  * Use query params for filtering and pagination.
  * Avoid dynamic cache busters unless truly required.
* To bypass cache temporarily:

  ```js
  await ncaam(`/games?season=2025&_=${Date.now()}`);
  ```
* Return only the fields needed for rendering.
* Normalize and validate data locally before rendering.

---

## 🚨 Common pitfalls & fixes

| Problem                                        | Fix                                                  |
| ---------------------------------------------- | ---------------------------------------------------- |
| ❌ Requests still point to `api.balldontlie.io` | ✅ Replace with `ncaam("/...")`                       |
| ❌ Authorization header appears in browser      | ✅ Remove. Worker adds it server-side                 |
| ❌ CORS errors                                  | ✅ Use Worker base URL (`ncaam.hicksrch.workers.dev`) |
| ❌ 401 from upstream                            | ✅ Rotate Worker secret                               |
| ❌ 403 to client                                | ✅ Check origin allowlist / domain policy             |
| ❌ 429 Too Many Requests                        | ✅ Back off, inspect rate limit config                |
| ❌ Stale cache                                  | ✅ Add `cache=0` query param for forced refresh       |

---

## 🧪 Testing checklist

Perform these tests **after any Worker or client changes:**

1. Open browser DevTools → Network tab.
   Verify all calls to:
   `https://ncaam.hicksrch.workers.dev/v1/...`
2. Confirm **no** `Authorization` header on any request.
3. Confirm no references to old `.env` or vendor keys.
4. Validate data loads correctly:

   ```bash
   curl https://ncaam.hicksrch.workers.dev/diag
   # → should return { ok: true, hasKey: true }
   ```
5. Sanity test in app console:

   ```js
   const teams = await ncaam("/teams?per_page=5");
   console.log(teams.data.map(t => t.full_name));
   ```
6. Ensure pages render with **no console errors** or network failures.

### 📸 Screenshot requirement

For pull requests:

* Attach a screenshot from DevTools showing:

  * Requests to `ncaam.hicksrch.workers.dev/v1/...`
  * Successful 200 responses
  * Network tab visible
* Reviewers verify proxy routing and data integrity before merge.

---

## 🧰 CI/CD Notes

* CI may hit the Worker for validation (no secrets required).
* Keep current build steps; no API key injection in pipelines.
* On secret rotation, **only update in Cloudflare** — no code edits.

---

## 🔐 Operational controls (reference)

| Control                         | Description                                                       |
| ------------------------------- | ----------------------------------------------------------------- |
| **Rate limit**                  | 60 requests/min per IP (configurable in Worker or Cloudflare WAF) |
| **IP policy**                   | Allow/deny lists via WAF or inline `CF-Connecting-IP` checks      |
| **Secret rotation**             | Update `BDL_API_KEY` in Worker Secrets only                       |
| **Logging**                     | Use Cloudflare Logs or Wrangler tail for diagnostics              |
| **Origin filtering (optional)** | Restrict to your production domain(s)                             |

---

## 🧯 Incident playbook

| Symptom                 | Action                                     |
| ----------------------- | ------------------------------------------ |
| **401 from upstream**   | Rotate `BDL_API_KEY`                       |
| **403 from Worker**     | Verify origin / WAF rules                  |
| **429 responses**       | Throttle calls, inspect client loops       |
| **High latency or 5xx** | Check upstream status; reduce cache misses |
| **Cache inconsistency** | Clear edge cache; confirm TTLs             |

---

## 🧭 Final principles

* Use the proxy, **never** the vendor API directly.
* Keep secrets **server-side** only.
* Prefer idempotent, cacheable reads.
* Validate data before render.
* Simplicity > complexity — the proxy exists to keep things secure, fast, and uniform.

## Build Verification

* Serve locally: `pnpm run dev`
* Open http://localhost:8787/index.html
* Provide a screenshot showing the nav and the Teams list with at least 10 items.
* Attach the screenshot to the PR.
