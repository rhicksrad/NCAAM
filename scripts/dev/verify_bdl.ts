const base = (process.env.BDL_PROXY_BASE || "").replace(/\/$/, "");
// Use a stable, lightweight endpoint for health checks.
const url = `${base || "https://api.balldontlie.io"}/v1/teams?per_page=1`;
const soft = process.env.VERIFY_ALLOW_5XX === "true";

async function check(u: string): Promise<boolean> {
  try {
    const r1 = await fetch(u);
    if (r1.ok) return true;
    const body = await r1.text().catch(() => "");
    console.error(`BDL verify: ${r1.status} ${r1.statusText}`, body.slice(0, 200));
    if (r1.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const r2 = await fetch(u);
      if (r2.ok) return true;
      console.error(`Retry failed: ${r2.status} ${r2.statusText}`);
      if (soft) {
        console.warn("Soft-failing BDL verify due to upstream 5xx");
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error("BDL verify: network error", error instanceof Error ? error.message : String(error));
    return false;
  }
}

const ok = await check(url);
process.exit(ok ? 0 : 1);
