import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as cheerio from "cheerio";

import { fetchHtml } from "./lib/http.js";

const BASE_URL = "https://www.sports-reference.com";
const CONCURRENCY = 6;
const playerLimitEnv = process.env.CBB_PLAYER_LIMIT ? Number.parseInt(process.env.CBB_PLAYER_LIMIT, 10) : null;
const PLAYER_LIMIT = Number.isFinite(playerLimitEnv ?? null) && (playerLimitEnv ?? 0) > 0 ? playerLimitEnv : null;

interface PlayerIndexEntry {
  name: string;
  team: string;
  season: string;
  slug: string;
  url?: string;
  season_year?: number;
}

interface PlayerIndexDocument {
  seasons?: string[];
  players?: PlayerIndexEntry[];
}

interface PlayerSeasonStats {
  season: string;
  team: string;
  conf: string;
  gp: number | null;
  gs: number | null;
  mp_g: number | null;
  fg_pct: number | null;
  fg3_pct: number | null;
  ft_pct: number | null;
  orb_g: number | null;
  drb_g: number | null;
  trb_g: number | null;
  ast_g: number | null;
  stl_g: number | null;
  blk_g: number | null;
  tov_g: number | null;
  pf_g: number | null;
  pts_g: number | null;
}

interface PlayerStatsDocument {
  slug: string;
  name: string;
  seasons: PlayerSeasonStats[];
  source: string;
  last_scraped: string;
}

type LoadedTable = { table: cheerio.Cheerio<cheerio.Element>; $: cheerio.CheerioAPI };

function loadTable(root: cheerio.CheerioAPI, tableId: string): LoadedTable | null {
  const direct = root(`#${tableId}`);
  if (direct.length > 0) {
    return { table: direct, $: root };
  }
  const container = root(`#div_${tableId}`);
  if (!container.length) {
    return null;
  }
  let html = container.html() ?? "";
  if (!html.includes("<table")) {
    html = container.text();
  }
  if (!html.includes("<table")) {
    return null;
  }
  const sanitised = html.replace(/<!--/g, "").replace(/-->/g, "");
  const inner$ = cheerio.load(sanitised);
  const table = inner$(`#${tableId}`);
  if (!table.length) {
    return null;
  }
  return { table, $: inner$ };
}

function cleanText(value: string | undefined | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function getCellValue(row: cheerio.Cheerio<cheerio.Element>, stat: string): string | null {
  const cell = row.find(`[data-stat='${stat}']`).first();
  if (!cell.length) {
    return null;
  }
  const attr = cell.attr("csk") ?? cell.attr("data-value");
  if (attr && attr.trim().length > 0) {
    return attr.trim();
  }
  const text = cell.text().trim();
  return text.length > 0 ? text : null;
}

function parseInteger(value: string | null): number | null {
  if (!value) return null;
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) ? num : null;
}

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.+-]/g, "");
  if (!cleaned) return null;
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function seasonOrder(entry: PlayerIndexEntry | PlayerSeasonStats): number {
  const label = "season" in entry ? entry.season : "";
  const match = label.match(/(\d{4})-(\d{2})/);
  if (match) {
    const start = Number.parseInt(match[1], 10);
    if (Number.isFinite(start)) {
      return start;
    }
  }
  if (typeof (entry as PlayerIndexEntry).season_year === "number") {
    return (entry as PlayerIndexEntry).season_year ?? 0;
  }
  return 0;
}

function parsePerGame(root: cheerio.CheerioAPI): PlayerSeasonStats[] {
  const loaded = loadTable(root, "players_per_game");
  if (!loaded) {
    return [];
  }
  const { table, $ } = loaded;
  const seasons: PlayerSeasonStats[] = [];
  table.find("tbody tr").each((_, element) => {
    const row = $(element);
    const cls = row.attr("class") ?? "";
    if (cls.includes("thead")) {
      return;
    }
    const seasonLabel = cleanText(row.find("th[data-stat='year_id']").text());
    if (!seasonLabel || seasonLabel.toLowerCase() === "career") {
      return;
    }
    const team = cleanText(row.find("td[data-stat='team_name_abbr']").text());
    const conf = cleanText(row.find("td[data-stat='conf_abbr']").text()) || "—";
    const gp = parseInteger(getCellValue(row, "games"));
    const gs = parseInteger(getCellValue(row, "games_started"));
    const mp_g = parseNumber(getCellValue(row, "mp_per_g"));
    const fg_pct = parseNumber(getCellValue(row, "fg_pct"));
    const fg3_pct = parseNumber(getCellValue(row, "fg3_pct"));
    const ft_pct = parseNumber(getCellValue(row, "ft_pct"));
    const orb_g = parseNumber(getCellValue(row, "orb_per_g"));
    const drb_g = parseNumber(getCellValue(row, "drb_per_g"));
    const trb_g = parseNumber(getCellValue(row, "trb_per_g"));
    const ast_g = parseNumber(getCellValue(row, "ast_per_g"));
    const stl_g = parseNumber(getCellValue(row, "stl_per_g"));
    const blk_g = parseNumber(getCellValue(row, "blk_per_g"));
    const tov_g = parseNumber(getCellValue(row, "tov_per_g"));
    const pf_g = parseNumber(getCellValue(row, "pf_per_g"));
    const pts_g = parseNumber(getCellValue(row, "pts_per_g"));
    if (!team && !conf) {
      console.warn(`Skipping malformed per-game row for season ${seasonLabel}`);
      return;
    }
    seasons.push({
      season: seasonLabel,
      team,
      conf,
      gp,
      gs,
      mp_g,
      fg_pct,
      fg3_pct,
      ft_pct,
      orb_g,
      drb_g,
      trb_g,
      ast_g,
      stl_g,
      blk_g,
      tov_g,
      pf_g,
      pts_g,
    });
  });
  return seasons;
}

function parseTotals(root: cheerio.CheerioAPI): PlayerSeasonStats[] {
  const loaded = loadTable(root, "players_totals");
  if (!loaded) {
    return [];
  }
  const { table, $ } = loaded;
  const seasons: PlayerSeasonStats[] = [];
  table.find("tbody tr").each((_, element) => {
    const row = $(element);
    const cls = row.attr("class") ?? "";
    if (cls.includes("thead")) {
      return;
    }
    const seasonLabel = cleanText(row.find("th[data-stat='year_id']").text());
    if (!seasonLabel || seasonLabel.toLowerCase() === "career") {
      return;
    }
    const team = cleanText(row.find("td[data-stat='team_name_abbr']").text());
    const conf = cleanText(row.find("td[data-stat='conf_abbr']").text()) || "—";
    const gp = parseInteger(getCellValue(row, "games"));
    const gs = parseInteger(getCellValue(row, "games_started"));
    const minutesTotal = parseNumber(getCellValue(row, "mp"));
    const fg_pct = parseNumber(getCellValue(row, "fg_pct"));
    const fg3_pct = parseNumber(getCellValue(row, "fg3_pct"));
    const ft_pct = parseNumber(getCellValue(row, "ft_pct"));
    const orb = parseNumber(getCellValue(row, "orb"));
    const drb = parseNumber(getCellValue(row, "drb"));
    const trb = parseNumber(getCellValue(row, "trb"));
    const ast = parseNumber(getCellValue(row, "ast"));
    const stl = parseNumber(getCellValue(row, "stl"));
    const blk = parseNumber(getCellValue(row, "blk"));
    const tov = parseNumber(getCellValue(row, "tov"));
    const pf = parseNumber(getCellValue(row, "pf"));
    const pts = parseNumber(getCellValue(row, "pts"));
    const divisor = gp && gp > 0 ? gp : null;
    const toPerGame = (value: number | null): number | null => {
      if (!divisor || value === null) return null;
      return value / divisor;
    };
    const mp_g = divisor && minutesTotal !== null ? minutesTotal / divisor : null;
    if (!team && !conf) {
      console.warn(`Skipping malformed totals row for season ${seasonLabel}`);
      return;
    }
    seasons.push({
      season: seasonLabel,
      team,
      conf,
      gp,
      gs,
      mp_g,
      fg_pct,
      fg3_pct,
      ft_pct,
      orb_g: toPerGame(orb),
      drb_g: toPerGame(drb),
      trb_g: toPerGame(trb),
      ast_g: toPerGame(ast),
      stl_g: toPerGame(stl),
      blk_g: toPerGame(blk),
      tov_g: toPerGame(tov),
      pf_g: toPerGame(pf),
      pts_g: toPerGame(pts),
    });
  });
  return seasons;
}

async function writePlayerDocument(doc: PlayerStatsDocument): Promise<void> {
  const outputDir = path.resolve("public", "data", "players");
  await fs.mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, `${doc.slug}.json`);
  await fs.writeFile(filePath, JSON.stringify(doc, null, 2));
}

async function processPlayer(slug: string, entries: PlayerIndexEntry[]): Promise<void> {
  const sourceUrl = entries[0]?.url ?? `${BASE_URL}/cbb/players/${slug}.html`;
  const outputDir = path.resolve("public", "data", "players");
  const filePath = path.join(outputDir, `${slug}.json`);
  if (process.env.FORCE !== "1") {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const existing = JSON.parse(raw) as PlayerStatsDocument;
      if (Array.isArray(existing.seasons) && existing.seasons.length > 0) {
        return;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn(`Unable to reuse cached stats for ${slug}`, error);
      }
    }
  }
  try {
    const html = await fetchHtml(sourceUrl);
    const $ = cheerio.load(html);
    const name = cleanText($("h1 span").first().text()) || entries[0]?.name || slug;
    let seasons = parsePerGame($);
    if (seasons.length === 0) {
      seasons = parseTotals($);
    }
    seasons.sort((a, b) => seasonOrder(a) - seasonOrder(b));
    if (seasons.length === 0) {
      console.warn(`No seasons found for ${slug} (${name})`);
    }
    const doc: PlayerStatsDocument = {
      slug,
      name,
      seasons,
      source: sourceUrl,
      last_scraped: new Date().toISOString(),
    };
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(doc, null, 2));
  } catch (error) {
    console.error(`Failed to parse stats for ${slug}`, error);
    const doc: PlayerStatsDocument = {
      slug,
      name: entries[0]?.name ?? slug,
      seasons: [],
      source: sourceUrl,
      last_scraped: new Date().toISOString(),
    };
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(doc, null, 2));
  }
}

async function runPool<T>(items: T[], limit: number, iterator: (item: T) => Promise<void>): Promise<void> {
  const executing = new Set<Promise<void>>();
  for (const item of items) {
    const task = Promise.resolve().then(() => iterator(item));
    executing.add(task);
    const clean = () => executing.delete(task);
    task.then(clean, clean);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

async function main(): Promise<void> {
  const indexPath = path.resolve("public", "data", "players_index.json");
  const indexRaw = await fs.readFile(indexPath, "utf8");
  const indexDoc = JSON.parse(indexRaw) as PlayerIndexDocument;
  const entries = Array.isArray(indexDoc.players) ? indexDoc.players : [];
  const slugs = new Map<string, PlayerIndexEntry[]>();
  for (const entry of entries) {
    if (!entry.slug) continue;
    const bucket = slugs.get(entry.slug) ?? [];
    bucket.push(entry);
    slugs.set(entry.slug, bucket);
  }
  let uniqueSlugs = Array.from(slugs.entries());
  if (PLAYER_LIMIT && PLAYER_LIMIT > 0 && uniqueSlugs.length > PLAYER_LIMIT) {
    uniqueSlugs = uniqueSlugs.slice(0, PLAYER_LIMIT);
    console.log(`Fetching player pages for ${uniqueSlugs.length} players (limited)`);
  } else {
    console.log(`Fetching player pages for ${uniqueSlugs.length} players`);
  }
  let processed = 0;
  await runPool(uniqueSlugs, CONCURRENCY, async ([slug, group]) => {
    await processPlayer(slug, group);
    processed += 1;
    if (processed % 50 === 0) {
      console.log(`Processed ${processed} / ${uniqueSlugs.length}`);
    }
  });
  console.log(`Finished player scrape (${processed} players)`);
}

main().catch(error => {
  console.error("Failed to scrape College Basketball Reference player stats", error);
  process.exitCode = 1;
});

