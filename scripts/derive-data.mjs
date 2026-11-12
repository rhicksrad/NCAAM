// Turn the raw archives in data/raw into the small, purpose-built JSON files
// the pages actually fetch. Everything here is deterministic and offline.
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import { loadResolver } from "./team-keys.mjs";

const round = (n, d = 1) => (n == null || Number.isNaN(n) ? null : Math.round(n * 10 ** d) / 10 ** d);
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

function parseCsv(text) {
  const [head, ...rows] = text.trim().split(/\r?\n/).map((line) => line.split(","));
  return rows.map((row) => Object.fromEntries(head.map((key, i) => [key, row[i]])));
}

const POST = { Champions: 7, "2ND": 6, F4: 5, E8: 4, S16: 3, R32: 2, R64: 1, R68: 1 };

export async function deriveData(root, dist) {
  const raw = path.join(root, "data/raw");
  const out = path.join(dist, "data");
  await mkdir(path.join(out, "players"), { recursive: true });
  const seedTeamsPath = path.join(root, "data/seed/teams.json");
  const espnTeams = existsSync(seedTeamsPath) ? (await readJson(seedTeamsPath)).teams : [];
  const { resolve } = loadResolver(path.join(raw, "logos/metadata.json"), espnTeams);
  const write = (name, value) => writeFile(path.join(out, name), JSON.stringify(value));

  // Logos: 32px PNGs keyed by ESPN team id.
  await cp(path.join(raw, "logos"), path.join(out, "logos"), {
    recursive: true,
    filter: (src) => !src.endsWith("metadata.json"),
  });
  const localLogos = (await readdir(path.join(raw, "logos"))).filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -4));

  // Players: one compact table for 2024-25, plus a minified career file each.
  const files = (await readdir(path.join(raw, "players"))).filter((f) => f.endsWith(".json"));
  const SEASON = "2024-25";
  const rows = [];
  for (const file of files) {
    const doc = await readJson(path.join(raw, "players", file));
    const seasons = (doc.seasons ?? []).map((s) => [
      s.season, s.team, s.conf, s.gp, s.gs, round(s.mp_g), round(s.pts_g), round(s.trb_g), round(s.ast_g),
      round(s.stl_g), round(s.blk_g), round(s.tov_g), round(s.fg_pct, 3), round(s.fg3_pct, 3), round(s.ft_pct, 3),
    ]);
    await writeFile(path.join(out, "players", file), JSON.stringify({ name: doc.name, seasons }));
    const cur = (doc.seasons ?? []).find((s) => s.season === SEASON);
    if (!cur || !cur.gp) continue;
    rows.push([
      doc.slug, doc.name, cur.team, resolve(cur.team), cur.conf, cur.gp, round(cur.mp_g), round(cur.pts_g), round(cur.trb_g),
      round(cur.ast_g), round(cur.stl_g), round(cur.blk_g), round(cur.tov_g), round(cur.fg_pct, 3), round(cur.fg3_pct, 3),
      round(cur.ft_pct, 3), seasons.length,
    ]);
  }
  rows.sort((a, b) => (b[7] ?? 0) - (a[7] ?? 0));
  await write("players.json", {
    season: SEASON,
    cols: ["slug", "name", "team", "teamId", "conf", "gp", "mpg", "ppg", "rpg", "apg", "spg", "bpg", "tov", "fg", "fg3", "ft", "seasons"],
    rows,
  });

  // Efficiency archive (Bart Torvik): every team-season 2013-2025.
  const seasons = [];
  const push = (r, year) =>
    seasons.push([
      year, r.TEAM ?? r.Team, resolve(r.TEAM ?? r.Team), r.CONF, +r.W, +r.G, +r.ADJOE, +r.ADJDE, round(+r.BARTHAG, 3), +r.ADJ_T,
      POST[r.POSTSEASON] ?? 0, +r.SEED || 0, round(+r["3P_O"]), round(+r.EFG_O),
    ]);
  for (const r of parseCsv(await readFile(path.join(raw, "cbb/cbb.csv"), "utf8"))) push(r, +r.YEAR);
  for (const r of parseCsv(await readFile(path.join(raw, "cbb/cbb20.csv"), "utf8"))) push(r, 2020);
  for (const r of parseCsv(await readFile(path.join(raw, "cbb/cbb25.csv"), "utf8"))) push(r, 2025);
  seasons.sort((a, b) => a[0] - b[0] || b[8] - a[8]);
  await write("efficiency.json", {
    cols: ["year", "team", "teamId", "conf", "w", "g", "adjO", "adjD", "barthag", "tempo", "post", "seed", "fg3", "efg"],
    rows: seasons,
  });

  // Arenas, projected once here so the browser never loads a map library.
  const W = 960, H = 600;
  const topo = await readJson(path.join(raw, "us-states-10m.json"));
  const projection = geoAlbersUsa().fitSize([W, H], feature(topo, topo.objects.nation));
  const draw = geoPath(projection);
  const shorten = (d) => d.replace(/(\d+\.\d)\d+/g, "$1");
  const venueKinds = new Map();
  for (const line of (await readFile(path.join(raw, "venue_grouping_report.csv"), "utf8")).trim().split(/\r?\n/).slice(1)) {
    const parts = line.split(",");
    venueKinds.set(parts[0], parts[parts.length - 1]);
  }
  const arenas = [];
  for (const a of await readJson(path.join(raw, "team_home_locations.json"))) {
    const xy = projection([a.longitude, a.latitude]);
    if (!xy) continue;
    arenas.push([a.team, resolve(a.team), a.arena, Math.round(xy[0]), Math.round(xy[1]), Math.round(a.elevation_ft ?? 0), venueKinds.get(a.team) ?? ""]);
  }
  arenas.sort((a, b) => b[5] - a[5]);
  await write("arenas.json", {
    width: W,
    height: H,
    nation: shorten(draw(feature(topo, topo.objects.nation))),
    borders: shorten(draw(mesh(topo, topo.objects.states, (a, b) => a !== b))),
    cols: ["team", "teamId", "arena", "x", "y", "elev", "kind"],
    rows: arenas,
  });

  // Mascots, rivalries and roster heights: light reshapes.
  const mascots = await readJson(path.join(raw, "fun-lab/mascot-index.json"));
  await write("mascots.json", {
    families: mascots.families,
    categories: mascots.categories.map((c) => ({ slug: c.slug, label: c.label, family: c.family, count: c.count })),
    rows: mascots.records.map((r) => [r.college, resolve(r.full_name), r.mascot, r.category, r.conference?.short_name ?? ""]),
  });
  await cp(path.join(raw, "fun-lab/cats-vs-dogs.json"), path.join(out, "cats-dogs.json"));
  const heights = await readJson(path.join(raw, "team-height-snapshot.json"));
  await write("heights.json", {
    asOf: heights.generated_at,
    rows: heights.teams
      .filter((t) => t.average_height_inches)
      .map((t) => [t.team, resolve(t.team), t.average_height_inches, t.measured_count])
      .sort((a, b) => b[2] - a[2]),
  });

  // Per-team extras the team page joins onto live data.
  const extras = {};
  const at = (id) => (extras[id] ??= {});
  for (const a of arenas) if (a[1]) Object.assign(at(a[1]), { arena: a[2], elev: a[5], x: a[3], y: a[4] });
  for (const h of heights.teams) {
    const id = resolve(h.team);
    if (id && h.average_height_inches) at(id).height = h.average_height_inches;
  }
  for (const s of seasons) if (s[2]) (at(s[2]).hist ??= []).push([s[0], s[4], s[5], s[6], s[7], s[8], s[10], s[11]]);
  await write("team-extras.json", { histCols: ["year", "w", "g", "adjO", "adjD", "barthag", "post", "seed"], teams: extras, logos: localLogos });
}
