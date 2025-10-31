import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as cheerio from "cheerio";

import { fetchHtml } from "./lib/http.js";

const BASE_URL = "https://www.sports-reference.com";
const DEFAULT_SEASONS = [2024, 2025];
const concurrencyEnvRaw = process.env.CBB_CONCURRENCY;
const concurrencyValue = concurrencyEnvRaw ? Number.parseInt(concurrencyEnvRaw, 10) : Number.NaN;
const parsedConcurrency = Number.isFinite(concurrencyValue) && concurrencyValue > 0 ? concurrencyValue : null;
const isCi = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
const CONCURRENCY = parsedConcurrency ?? (isCi ? 1 : 2);
const teamLimitEnv = process.env.CBB_TEAM_LIMIT ? Number.parseInt(process.env.CBB_TEAM_LIMIT, 10) : null;
const TEAM_LIMIT = Number.isFinite(teamLimitEnv ?? null) && (teamLimitEnv ?? 0) > 0 ? teamLimitEnv : null;
const teamSlugsEnv = process.env.CBB_TEAMS
  ? process.env.CBB_TEAMS.split(/[,\s]+/).map(value => value.trim()).filter(Boolean)
  : null;
const TEAM_SLUG_FILTER = teamSlugsEnv && teamSlugsEnv.length > 0 ? new Set(teamSlugsEnv) : null;

type TeamListing = {
  year: number;
  name: string;
  url: string;
  slug: string;
};

type PlayerIndexEntry = {
  name: string;
  team: string;
  season: string;
  slug: string;
  url: string;
  season_year: number;
  team_slug: string;
  name_key: string;
  team_key: string;
};

type PlayerIndexDocument = {
  seasons: string[];
  players: PlayerIndexEntry[];
};

function parseSeasonArgs(): number[] {
  const fromEnv = process.env.CBB_SEASONS;
  const raw = fromEnv ? fromEnv.split(/[,\s]+/) : process.argv.slice(2);
  const seasons = raw
    .map(value => Number.parseInt(value, 10))
    .filter((value): value is number => Number.isFinite(value) && value >= 1900);
  if (seasons.length > 0) {
    return Array.from(new Set(seasons)).sort((a, b) => a - b);
  }
  return DEFAULT_SEASONS;
}

function seasonLabelFromYear(year: number): string {
  const start = year - 1;
  const end = String(year).slice(-2);
  return `${start}-${end}`;
}

function cleanTeamName(raw: string): string {
  return raw
    .replace(/\s*(Men's|Women's)\s*$/iu, "")
    .replace(/\s*(Men|Women)\s+Basketball\s*$/iu, "")
    .trim();
}

function normaliseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normaliseTeam(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/men's|mens|women's|womens/gi, "")
    .replace(/\b(men|women|basketball)\b/gi, "")
    .replace(/[^a-z0-9]/g, "");
}

function uniqueKey(entry: PlayerIndexEntry): string {
  return `${entry.season}|${entry.team_slug}|${entry.slug}`;
}

async function fetchSeasonTeams(year: number): Promise<TeamListing[]> {
  const seasonUrl = `${BASE_URL}/cbb/seasons/men/${year}-school-stats.html`;
  console.log(`Fetching teams for ${year} from ${seasonUrl}`);
  const html = await fetchHtml(seasonUrl);
  const $ = cheerio.load(html);
  const teams = new Map<string, TeamListing>();
  $("td[data-stat='school_name'] a").each((_, element) => {
    const href = $(element).attr("href");
    const name = $(element).text().trim();
    if (!href || !name) {
      return;
    }
    const match = href.match(/\/cbb\/schools\/([^/]+)\//i);
    if (!match) {
      return;
    }
    const slug = match[1];
    const url = new URL(href, BASE_URL).toString();
    teams.set(slug, { year, name, url, slug });
  });
  return Array.from(teams.values());
}

async function fetchTeamRoster(listing: TeamListing): Promise<PlayerIndexEntry[]> {
  const html = await fetchHtml(listing.url);
  const $ = cheerio.load(html);

  const heading = $("h1").first();
  const spanTexts = heading
    .find("span")
    .map((_, el) => $(el).text().trim())
    .toArray()
    .filter(Boolean);
  const seasonLabel = spanTexts[0] || seasonLabelFromYear(listing.year);
  const rawTeamName = spanTexts[1] || listing.name;
  const team = cleanTeamName(rawTeamName || listing.name);

  const rosterContainer = $("#div_roster");
  let rosterHtml = rosterContainer.html();
  if (!rosterHtml) {
    const rosterTable = $("#roster");
    rosterHtml = rosterTable.length > 0 ? rosterTable.parent().html() ?? rosterTable.toString() : "";
  }
  if (!rosterHtml) {
    console.warn(`No roster table found for ${listing.url}`);
    return [];
  }

  const sanitised = rosterHtml.replace(/<!--/g, "").replace(/-->/g, "");
  const inner = cheerio.load(sanitised);
  const rows = inner("#roster tbody tr");
  const players: PlayerIndexEntry[] = [];

  rows.each((_, row) => {
    const playerCell = inner(row).find("th[data-stat='player'] a");
    if (playerCell.length === 0) {
      return;
    }
    const name = playerCell.text().trim();
    const href = playerCell.attr("href");
    if (!name || !href) {
      return;
    }
    const slugMatch = href.match(/\/cbb\/players\/([^./]+)\.html/i);
    if (!slugMatch) {
      return;
    }
    const slug = slugMatch[1];
    const url = new URL(href, BASE_URL).toString();
    players.push({
      name,
      team,
      season: seasonLabel,
      slug,
      url,
      season_year: listing.year,
      team_slug: listing.slug,
      name_key: normaliseName(name),
      team_key: normaliseTeam(team),
    });
  });

  return players;
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
  const seasons = parseSeasonArgs();
  console.log(`Building College Basketball Reference index for seasons: ${seasons.join(", ")}`);
  console.log(`Roster fetch concurrency: ${CONCURRENCY}`);

  const playerMap = new Map<string, PlayerIndexEntry>();
  const seasonLabels = new Set<string>();

  for (const year of seasons) {
    const teams = await fetchSeasonTeams(year);
    let filteredTeams = teams;
    if (TEAM_SLUG_FILTER) {
      filteredTeams = teams.filter(team => TEAM_SLUG_FILTER!.has(team.slug));
    }
    const teamList =
      TEAM_LIMIT && TEAM_LIMIT > 0
        ? filteredTeams.slice(0, Math.min(TEAM_LIMIT, filteredTeams.length))
        : filteredTeams;
    console.log(
      `Parsing rosters for ${teamList.length} teams in ${year}${
        TEAM_SLUG_FILTER ? " (filtered)" : ""
      }${TEAM_LIMIT && TEAM_LIMIT > 0 && teamList.length < filteredTeams.length ? ` (limited from ${filteredTeams.length})` : ""}`,
    );
    await runPool(teamList, CONCURRENCY, async listing => {
      try {
        const players = await fetchTeamRoster(listing);
        for (const player of players) {
          const key = uniqueKey(player);
          if (!playerMap.has(key)) {
            playerMap.set(key, player);
            seasonLabels.add(player.season);
          }
        }
      } catch (error) {
        console.warn(`Failed to process roster for ${listing.url}`, error);
      }
    });
  }

  const sortedPlayers = Array.from(playerMap.values()).sort((a, b) => {
    const name = a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    if (name !== 0) return name;
    const season = a.season.localeCompare(b.season, "en", { sensitivity: "base" });
    if (season !== 0) return season;
    return a.team.localeCompare(b.team, "en", { sensitivity: "base" });
  });

  const document: PlayerIndexDocument = {
    seasons: Array.from(seasonLabels.values()).sort((a, b) => a.localeCompare(b, "en")),
    players: sortedPlayers,
  };

  const outputPath = path.resolve("public", "data", "players_index.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(document, null, 2));
  console.log(`Wrote ${document.players.length} players to ${outputPath}`);
}

main().catch(error => {
  console.error("Failed to build College Basketball Reference index", error);
  process.exitCode = 1;
});

