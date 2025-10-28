agents.md — Cloudflare Proxy Workflow

This project no longer ships API keys to the browser. All Ball Don’t Lie (BDL) calls go through a Cloudflare Worker proxy.

Non-negotiables

Do not add Authorization headers in browser code.

Do not re-introduce any client-side key injection, meta tags, or .env lookups for BDL.

All network calls to BDL must use the Worker base:
https://bdlproxy.hicksrch.workers.dev/bdl

Keep requests GET/HEAD only. No POST/PUT/PATCH/DELETE to the proxy.

How to call BDL now

Create or use the helper:

// public/assets/js/bdl.js
export const BDL_BASE = "https://bdlproxy.hicksrch.workers.dev/bdl";

export async function bdl(path, init = {}) {
  const url = `${BDL_BASE}${path}`;
  const res = await fetch(url, { ...init, headers: { Accept: "application/json", ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`BDL ${res.status} ${res.statusText} for ${path}`);
  return res.json();
}


Use it everywhere:

import { bdl } from "./assets/js/bdl.js";

const { data } = await bdl("/v1/players?search=lillard");

Expected repo state

Removed: public/assets/bdl-credentials.js, public/assets/js/credentials.js, any <meta name="bdl-api-key">.

No references to data/bdl-key.json, assets/bdl-key.json, or Authorization: Bearer ... in client code.

package.json has no inject:bdl, restore:bdl, or prepare:bdl scripts.

CI workflows contain no secret injection steps for BDL.

Worker summary

The Worker forwards /bdl/* to https://api.balldontlie.io/* with a server-side key.

60s edge cache on successful GETs.

Optional controls:

Per-IP rate cap via Durable Object limiter (60/min).

WAF rules for allow/deny lists and rate limiting when routed via a custom domain.

Optional origin check to only allow requests from our site.

When adding new features

Build browser code against the proxy base. Never import or construct https://api.balldontlie.io directly.

Keep calls idempotent and cache-friendly. Prefer query parameters; avoid needless cache-busters.

If you need fresh data for a specific call, append a one-off &_=${Date.now()} only to that call.

Common pitfalls and fixes

Calls go to api.balldontlie.io
Fix: replace with bdl("/v1/...") via the helper.

Authorization header added by habit
Remove it. The Worker adds auth server-side.

CORS error
Ensure the request hits the Worker URL and path begins with /bdl/. The Worker sets permissive CORS.

429 Too Many Requests
You exceeded the per-IP cap. Back off and retry after Retry-After seconds.

403 Forbidden
You’re outside the allowlist (if enabled). Use an approved origin/IP.

Code patterns agents should follow

Centralize fetch logic:

Import bdl() and call it; do not duplicate fetch wrappers.

Handle failures with small, local retries only when the endpoint is safe to retry.

Data loaders:

Keep shape compatible with existing renderers.

Validate presence of required fields; don’t re-validate upstream schema exhaustively.

Modules:

Prefer type="module" scripts and explicit imports from ./assets/js/bdl.js.

Avoid global variables for configuration.

Testing checklist (do this after edits)

DevTools Network on players.html, history.html, games.html, teams.html shows requests to bdlproxy.hicksrch.workers.dev/bdl/....

No browser request carries an Authorization header.

No fetches to legacy key files or meta tags.

Sample sanity:

bdl("/v1/players?search=lillard") returns Damian Lillard.

Team and roster pages populate without console errors.

Screenshot requirement

Capture and attach a screenshot from the local development server that demonstrates the updated feature or fix working end-to-end.

Reviewers must inspect the screenshot for both content and accuracy before approving changes.

CI/CD notes

Keep existing site build/validate steps.

Do not add any step that reads or injects a BDL key into artifacts.

If a job needs BDL data server-side, it may call the proxy just like the browser does.

Operational controls (reference)

Rate limit: Worker DO limiter at 60/min per IP and/or Cloudflare WAF Rate Limiting at 60/min on /bdl/*.

IP policy: allow/deny via WAF on a routed domain, or inline CF-Connecting-IP checks in the Worker.

Secret rotation: rotate BDL_API_KEY in the Worker’s Variables/Secrets. No repo change required.

Incident playbook

401 from upstream: rotate BDL_API_KEY.

403 to clients: check allowlist rules or origin checks.

429 spikes: adjust WAF rule or DO limit; verify no client loop.

High latency/errors: confirm BDL status, reduce cache TTL misses, and inspect Worker logs.

Keep it simple: use the proxy, keep secrets server-side, and never reintroduce client auth.
