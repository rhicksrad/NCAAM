// Recorded ESPN responses are huge (standings is 6 MB). This strips the parts
// no normaliser reads so the fixtures stay reviewable. Run after re-recording:
//   node scripts/slim-fixtures.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../tests/fixtures/espn");
const DROP = new Set([
  "links", "$ref", "uid", "guid", "images", "videos", "video", "tickets", "geoBroadcasts", "article", "againstTheSpread",
  "pickcenter", "headshot", "flag", "description", "descriptions", "wallclock", "coordinate", "participants", "calendar",
  "leaders", "seasonseries", "logos", "logo", "seasons", "provider", "lastFiveGames", "injuries", "format", "featuredAthletes", "highlights",
  "categories", "premium", "dataSourceIdentifier", "ticketsAvailable", "playByPlayAvailable", "boxscoreAvailable",
  "onWatchESPN", "wasSuspended", "commentaryAvailable", "liveAvailable", "shotChartAvailable", "timeoutsAvailable",
  "possessionArrowAvailable", "recent", "previews", "college", "contracts", "alternateIds", "slug", "meta", "predictor",
]);

const STANDING_STATS = new Set(["wins", "losses", "winpercent", "leaguewinpercent", "streak", "avgpointsfor", "avgpointsagainst", "total", "home", "road", "vsconf"]);

function slim(value, key) {
  if (Array.isArray(value)) return value.map((v) => slim(v, key));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      // Scoreboard competitors carry season statistics nobody reads; box score
      // statistics (which have `labels` or `name`+`displayValue`) are kept.
      if (k === "links" && v?.web?.href) {
        out.links = { web: { href: v.web.href } }; // news articles: the one link we use
        continue;
      }
      if (DROP.has(k)) continue;
      if (k === "odds" && Array.isArray(v)) {
        out.odds = v.slice(0, 1).map((o) => ({ details: o?.details, overUnder: o?.overUnder }));
        continue;
      }
      // Standings rows carry 84 stats each; the site reads eleven.
      if (k === "stats" && Array.isArray(v) && v[0]?.type) {
        out.stats = v
          .filter((st) => STANDING_STATS.has(String(st.type).toLowerCase()))
          .map((st) => ({ name: st.name, type: st.type, abbreviation: st.abbreviation, value: st.value, displayValue: st.displayValue, summary: st.summary }));
        continue;
      }
      if (k === "statistics" && key === "competitors") continue;
      out[k] = slim(v, k === "competitors" ? "competitors-item" : k);
    }
    return out;
  }
  return value;
}

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const full = path.join(dir, file);
  const before = readFileSync(full, "utf8");
  const json = slim(JSON.parse(before));
  if (file.startsWith("summary")) {
    delete json.standings;
    delete json.news;
  }
  const after = JSON.stringify(json);
  writeFileSync(full, after + "\n");
  console.log(`${file.padEnd(28)} ${(before.length / 1024).toFixed(0).padStart(6)} kB -> ${(after.length / 1024).toFixed(0).padStart(5)} kB`);
}
