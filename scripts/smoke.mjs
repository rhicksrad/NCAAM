// Browser smoke test. Serves dist/, answers ESPN requests from the recorded
// fixtures, and checks that every page renders real content with no script
// errors and no sideways scroll on a phone.
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./build.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fx = (name) => readFileSync(path.join(root, "tests/fixtures/espn", name), "utf8");
const shots = path.join(root, ".cache/shots");
mkdirSync(shots, { recursive: true });
const PORT = 4319;
const offline = process.argv.includes("--espn-down");

function espnFixture(url) {
  const u = new URL(url);
  const p = u.pathname;
  if (p.endsWith("/scoreboard")) return u.searchParams.get("dates") ? "scoreboard-20261111.json" : "scoreboard-today.json";
  if (p.endsWith("/rankings")) return "rankings.json";
  if (p.endsWith("/standings")) return "standings-2027.json";
  if (p.endsWith("/news")) return "news.json";
  if (p.endsWith("/summary")) return u.searchParams.get("event") === preId ? "summary-pre.json" : "summary-final.json";
  if (p.endsWith("/roster")) return "team-150-roster.json";
  if (p.endsWith("/schedule")) return "team-150-schedule.json";
  if (/\/teams\/\d+$/.test(p)) return "team-150.json";
  if (p.endsWith("/teams")) return "teams.json";
  return null;
}

const finalId = JSON.parse(fx("summary-final.json")).header.id;
const preId = JSON.parse(fx("summary-pre.json")).header.id;
const PAGES = [
  { url: "index.html", wait: "#home-games .ticket", expect: ["#home-poll .poll-list li", "#hero-tally b"] },
  { url: "games.html", wait: "#games-list .ticket", expect: ["#datestrip a[aria-current=date]"] },
  { url: `game.html?id=${finalId}`, wait: ".board__score", expect: [".sheet table tbody tr", ".flow svg path", ".pbp li"] },
  { url: `game.html?id=${preId}`, wait: ".board__teams", expect: [".form-guide .sheet tbody tr"] },
  { url: "rankings.html", wait: ".rafters .banner", expect: ["#rankings-root tbody tr:nth-child(25)"] },
  { url: "standings.html", wait: ".conf-grid .sheet", expect: [".conf-grid .sheet:nth-child(20) tbody tr"] },
  { url: "teams.html", wait: ".team-chip", expect: [".conf-block:nth-child(20)"] },
  { url: "team.html?id=150", wait: ".team-hero h1", expect: [".team-cols .sheet tbody tr", ".chalk svg rect"] },
  { url: "players.html", wait: "#players-root tbody tr[data-slug]", expect: [".leader__val"] },
  { url: "lab.html", wait: "#eff-dots circle", expect: [".map circle", "#mascot-list a", ".ledger__row", ".tall i"] },
  { url: "about.html", wait: ".prose h2", expect: [] },
  { url: "nope.html", wait: ".airball", expect: [] },
];
// With ESPN unreachable, snapshot-backed pages must still render.
const SURVIVES_OUTAGE = new Set(["index.html", "rankings.html", "standings.html", "teams.html", "players.html", "lab.html", "about.html"]);

const server = await startServer(PORT);
// Cloud sandboxes ship one pinned Chromium at this path; everywhere else use
// the browser that `playwright install chromium` fetched.
const pinned = "/opt/pw-browsers/chromium";
const browser = await chromium.launch(!process.env.CI && existsSync(pinned) ? { executablePath: pinned } : {});

const problems = [];
for (const viewport of [{ name: "desktop", width: 1360, height: 900 }, { name: "phone", width: 390, height: 800 }]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.route(/espn\.com|espncdn\.com/, (route) => {
    const url = route.request().url();
    if (url.includes("espncdn.com")) return route.abort();
    const name = offline ? null : espnFixture(url);
    if (!name) return route.fulfill({ status: 503, body: "{}" });
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: fx(name) });
  });
  for (const page of PAGES) {
    if (offline && !SURVIVES_OUTAGE.has(page.url)) continue;
    const tab = await context.newPage();
    const errors = [];
    tab.on("pageerror", (e) => errors.push(`script error: ${e.message}`));
    tab.on("console", (m) => {
      if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|503/.test(m.text())) errors.push(`console: ${m.text()}`);
    });
    const label = `${viewport.name} ${page.url}`;
    try {
      await tab.goto(`http://localhost:${PORT}/${page.url}`, { waitUntil: "domcontentloaded" });
      await tab.waitForSelector(page.wait, { timeout: 8000 });
      for (const selector of page.expect) {
        if (!(await tab.locator(selector).count())) errors.push(`missing ${selector}`);
      }
      await tab.waitForTimeout(250);
      const overflow = await tab.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) errors.push(`page scrolls sideways by ${overflow}px`);
      const text = await tab.locator("main").innerText();
      if (/undefined|NaN|\[object Object\]/.test(text)) errors.push(`leaked "${/undefined|NaN|\[object Object\]/.exec(text)[0]}" into the page`);
      await tab.screenshot({ path: path.join(shots, `${offline ? "down-" : ""}${viewport.name}-${page.url.replace(/[^a-z0-9]+/gi, "_")}.png`), fullPage: true });
    } catch (e) {
      errors.push(e.message.split("\n")[0]);
    }
    console.log(`${errors.length ? "FAIL" : " ok "}  ${label}`);
    for (const e of errors) problems.push(`${label}: ${e}`);
    await tab.close();
  }
  await context.close();
}
await browser.close();
server.close();
if (problems.length) {
  console.error("\n" + problems.join("\n"));
  process.exit(1);
}
