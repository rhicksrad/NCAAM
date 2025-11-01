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

const POWER_CONFERENCE_TEAM_MAP = new Map<string, { conference: string; name: string }>([
  ["alabama", { conference: "SEC", name: "Alabama" }],
  ["arizona", { conference: "B12", name: "Arizona" }],
  ["arizona-state", { conference: "B12", name: "Arizona State" }],
  ["arkansas", { conference: "SEC", name: "Arkansas" }],
  ["auburn", { conference: "SEC", name: "Auburn" }],
  ["baylor", { conference: "B12", name: "Baylor" }],
  ["boston-college", { conference: "ACC", name: "Boston College" }],
  ["brigham-young", { conference: "B12", name: "Brigham Young" }],
  ["butler", { conference: "BE", name: "Butler" }],
  ["california", { conference: "ACC", name: "California" }],
  ["central-florida", { conference: "B12", name: "UCF" }],
  ["cincinnati", { conference: "B12", name: "Cincinnati" }],
  ["clemson", { conference: "ACC", name: "Clemson" }],
  ["colorado", { conference: "B12", name: "Colorado" }],
  ["connecticut", { conference: "BE", name: "Connecticut" }],
  ["creighton", { conference: "BE", name: "Creighton" }],
  ["depaul", { conference: "BE", name: "DePaul" }],
  ["duke", { conference: "ACC", name: "Duke" }],
  ["florida", { conference: "SEC", name: "Florida" }],
  ["florida-state", { conference: "ACC", name: "Florida State" }],
  ["georgetown", { conference: "BE", name: "Georgetown" }],
  ["georgia", { conference: "SEC", name: "Georgia" }],
  ["georgia-tech", { conference: "ACC", name: "Georgia Tech" }],
  ["houston", { conference: "B12", name: "Houston" }],
  ["illinois", { conference: "B10", name: "Illinois" }],
  ["indiana", { conference: "B10", name: "Indiana" }],
  ["iowa", { conference: "B10", name: "Iowa" }],
  ["iowa-state", { conference: "B12", name: "Iowa State" }],
  ["kansas", { conference: "B12", name: "Kansas" }],
  ["kansas-state", { conference: "B12", name: "Kansas State" }],
  ["kentucky", { conference: "SEC", name: "Kentucky" }],
  ["louisiana-state", { conference: "SEC", name: "Louisiana State" }],
  ["louisville", { conference: "ACC", name: "Louisville" }],
  ["marquette", { conference: "BE", name: "Marquette" }],
  ["maryland", { conference: "B10", name: "Maryland" }],
  ["miami-fl", { conference: "ACC", name: "Miami (FL)" }],
  ["michigan", { conference: "B10", name: "Michigan" }],
  ["michigan-state", { conference: "B10", name: "Michigan State" }],
  ["minnesota", { conference: "B10", name: "Minnesota" }],
  ["mississippi", { conference: "SEC", name: "Mississippi" }],
  ["mississippi-state", { conference: "SEC", name: "Mississippi State" }],
  ["missouri", { conference: "SEC", name: "Missouri" }],
  ["nebraska", { conference: "B10", name: "Nebraska" }],
  ["north-carolina", { conference: "ACC", name: "North Carolina" }],
  ["north-carolina-state", { conference: "ACC", name: "NC State" }],
  ["northwestern", { conference: "B10", name: "Northwestern" }],
  ["notre-dame", { conference: "ACC", name: "Notre Dame" }],
  ["ohio-state", { conference: "B10", name: "Ohio State" }],
  ["oklahoma", { conference: "SEC", name: "Oklahoma" }],
  ["oklahoma-state", { conference: "B12", name: "Oklahoma State" }],
  ["oregon", { conference: "B10", name: "Oregon" }],
  ["oregon-state", { conference: "P12", name: "Oregon State" }],
  ["penn-state", { conference: "B10", name: "Penn State" }],
  ["pittsburgh", { conference: "ACC", name: "Pittsburgh" }],
  ["providence", { conference: "BE", name: "Providence" }],
  ["purdue", { conference: "B10", name: "Purdue" }],
  ["rutgers", { conference: "B10", name: "Rutgers" }],
  ["seton-hall", { conference: "BE", name: "Seton Hall" }],
  ["south-carolina", { conference: "SEC", name: "South Carolina" }],
  ["southern-california", { conference: "B10", name: "Southern California" }],
  ["southern-methodist", { conference: "ACC", name: "Southern Methodist" }],
  ["st-johns-ny", { conference: "BE", name: "St. John's (NY)" }],
  ["stanford", { conference: "ACC", name: "Stanford" }],
  ["syracuse", { conference: "ACC", name: "Syracuse" }],
  ["tennessee", { conference: "SEC", name: "Tennessee" }],
  ["texas", { conference: "SEC", name: "Texas" }],
  ["texas-am", { conference: "SEC", name: "Texas A&M" }],
  ["texas-christian", { conference: "B12", name: "TCU" }],
  ["texas-tech", { conference: "B12", name: "Texas Tech" }],
  ["ucla", { conference: "B10", name: "UCLA" }],
  ["utah", { conference: "B12", name: "Utah" }],
  ["vanderbilt", { conference: "SEC", name: "Vanderbilt" }],
  ["villanova", { conference: "BE", name: "Villanova" }],
  ["virginia", { conference: "ACC", name: "Virginia" }],
  ["virginia-tech", { conference: "ACC", name: "Virginia Tech" }],
  ["wake-forest", { conference: "ACC", name: "Wake Forest" }],
  ["washington", { conference: "B10", name: "Washington" }],
  ["washington-state", { conference: "P12", name: "Washington State" }],
  ["west-virginia", { conference: "B12", name: "West Virginia" }],
  ["wisconsin", { conference: "B10", name: "Wisconsin" }],
  ["xavier", { conference: "BE", name: "Xavier" }],
]);

type ConferenceDetail = {
  code: string;
  name: string;
};

const CONFERENCE_SLUG_OVERRIDES = new Map<string, ConferenceDetail>([
  ["america-east", { code: "AEC", name: "America East Conference" }],
  ["aac", { code: "AAC", name: "American Athletic Conference" }],
  ["atlantic-sun", { code: "ASUN", name: "ASUN Conference" }],
  ["atlantic-10", { code: "A10", name: "Atlantic 10 Conference" }],
  ["big-sky", { code: "BSKY", name: "Big Sky Conference" }],
  ["big-south", { code: "BSOU", name: "Big South Conference" }],
  ["big-west", { code: "BWC", name: "Big West Conference" }],
]);

const conferenceTeamCache = new Map<string, Promise<string[]>>();

type TeamListing = {
  year: number;
  name: string;
  url: string;
  slug: string;
  conference?: string;
  conference_name?: string;
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
  conference?: string;
};

type PlayerIndexDocument = {
  seasons: string[];
  players: PlayerIndexEntry[];
};

function normaliseConferenceText(text: string): string {
  return text.replace(/\s+(?:MB|WB)B$/iu, "").replace(/\s+/g, " ").trim();
}

function titleCaseFromSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map(part => {
      if (part.length <= 3) {
        return part.toUpperCase();
      }
      return part[0].toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function formatConferenceName(slug: string, raw: string | null): string {
  const base = raw && raw.length > 0 ? raw : titleCaseFromSlug(slug);
  if (!base) {
    return "";
  }
  const hasConference = /conference$/iu.test(base);
  return hasConference ? base : `${base} Conference`;
}

function deriveConferenceDetailsFromLink(link: cheerio.Cheerio<cheerio.Element>): ConferenceDetail | null {
  const href = link.attr("href");
  if (!href) {
    return null;
  }
  const match = href.match(/\/cbb\/conferences\/([^/]+)/i);
  if (!match) {
    return null;
  }
  const slug = match[1];
  const override = CONFERENCE_SLUG_OVERRIDES.get(slug);
  const rawText = normaliseConferenceText(link.text());
  const name = override?.name ?? formatConferenceName(slug, rawText);
  const codeSource = override?.code ?? (rawText || slug);
  const code = codeSource.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!code || !name) {
    return null;
  }
  return { code, name };
}

function extractConferenceDetails(root: cheerio.CheerioAPI): ConferenceDetail | null {
  const meta = root("#meta");
  if (!meta.length) {
    return null;
  }
  const recordParagraph = meta.find("p strong:contains('Record')").parent();
  if (!recordParagraph.length) {
    return null;
  }
  const link = recordParagraph.find("a[href*='/cbb/conferences/']").first();
  if (!link.length) {
    return null;
  }
  return deriveConferenceDetailsFromLink(link);
}

async function fetchConferenceTeamSlugs(slug: string, year: number): Promise<string[]> {
  const cacheKey = `${slug}:${year}`;
  let loader = conferenceTeamCache.get(cacheKey);
  if (!loader) {
    loader = (async () => {
      const url = `${BASE_URL}/cbb/conferences/${slug}/men/${year}.html`;
      const html = await fetchHtml(url);
      const sanitised = html.replace(/<!--/g, "").replace(/-->/g, "");
      const $ = cheerio.load(sanitised);
      const slugs = new Set<string>();
      $("#standings tbody tr").each((_, row) => {
        const anchor = $(row).find("td[data-stat='school_name'] a");
        const href = anchor.attr("href");
        if (!href) {
          return;
        }
        const match = href.match(/\/cbb\/schools\/([^/]+)\//i);
        if (match) {
          slugs.add(match[1]);
        }
      });
      return Array.from(slugs.values());
    })();
    conferenceTeamCache.set(cacheKey, loader);
  }
  return loader;
}

async function buildConferenceTeamLookup(
  conferenceFilter: Set<string> | null,
  seasons: number[],
): Promise<Map<string, ConferenceDetail>> {
  const lookup = new Map<string, ConferenceDetail>();
  if (!conferenceFilter || conferenceFilter.size === 0) {
    return lookup;
  }
  for (const [slug, detail] of CONFERENCE_SLUG_OVERRIDES.entries()) {
    if (!conferenceFilter.has(detail.code)) {
      continue;
    }
    for (const year of seasons) {
      try {
        const teamSlugs = await fetchConferenceTeamSlugs(slug, year);
        for (const teamSlug of teamSlugs) {
          if (!lookup.has(teamSlug)) {
            lookup.set(teamSlug, detail);
          }
        }
      } catch (error) {
        console.warn(`Failed to load conference standings for ${slug} in ${year}`, error);
      }
    }
  }
  return lookup;
}

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

function cleanConference(value: string | undefined | null): string | undefined {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return undefined;
  return trimmed.toUpperCase();
}

function cleanConferenceName(value: string | undefined | null): string | undefined {
  const trimmed = (value ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed) return undefined;
  return trimmed;
}

function parseConferenceFilter(): Set<string> | null {
  const raw = process.env.CBB_CONFERENCES;
  if (!raw) return null;
  const values = raw
    .split(/[\s,]+/)
    .map(value => value.trim().toUpperCase())
    .filter(Boolean);
  if (!values.length) return null;
  return new Set(values);
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

async function fetchSeasonTeams(
  year: number,
  conferenceOverrides: Map<string, ConferenceDetail>,
): Promise<TeamListing[]> {
  const seasonUrl = `${BASE_URL}/cbb/seasons/men/${year}-school-stats.html`;
  console.log(`Fetching teams for ${year} from ${seasonUrl}`);
  const html = await fetchHtml(seasonUrl);
  const $ = cheerio.load(html);
  const teams = new Map<string, TeamListing>();
  $("#basic_school_stats tbody tr").each((_, row) => {
    const anchor = $(row).find("td[data-stat='school_name'] a");
    if (!anchor.length) {
      return;
    }
    const href = anchor.attr("href");
    const name = anchor.text().trim();
    if (!href || !name) {
      return;
    }
    const match = href.match(/\/cbb\/schools\/([^/]+)\//i);
    if (!match) {
      return;
    }
    const slug = match[1];
    const url = new URL(href, BASE_URL).toString();
    const override = conferenceOverrides.get(slug);
    const meta = POWER_CONFERENCE_TEAM_MAP.get(slug);
    const conference =
      meta?.conference ?? override?.code ?? cleanConference($(row).find("td[data-stat='conf_abbr']").text());
    const conferenceName =
      meta?.name ?? override?.name ?? cleanConferenceName($(row).find("td[data-stat='conf_name']").text());
    teams.set(slug, { year, name, url, slug, conference, conference_name: conferenceName });
  });
  return Array.from(teams.values());
}

async function fetchTeamRoster(listing: TeamListing): Promise<PlayerIndexEntry[]> {
  const html = await fetchHtml(listing.url);
  const $ = cheerio.load(html);

  if (!listing.conference || !listing.conference_name) {
    const details = extractConferenceDetails($);
    if (details) {
      if (!listing.conference) {
        listing.conference = details.code;
      }
      if (!listing.conference_name) {
        listing.conference_name = details.name;
      }
    }
  }

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
    const meta = POWER_CONFERENCE_TEAM_MAP.get(listing.slug);
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
      conference: listing.conference ?? meta?.conference ?? undefined,
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
  const conferenceFilter = parseConferenceFilter();
  if (conferenceFilter) {
    console.log(`Restricting to conferences: ${Array.from(conferenceFilter.values()).join(", ")}`);
  }

  const conferenceTeamOverrides = await buildConferenceTeamLookup(conferenceFilter, seasons);

  const playerMap = new Map<string, PlayerIndexEntry>();
  const seasonLabels = new Set<string>();

  for (const year of seasons) {
    const teams = await fetchSeasonTeams(year, conferenceTeamOverrides);
    let filteredTeams = teams;
    let skippedConferenceTeams = 0;
    if (conferenceFilter) {
      const immediateMatches = filteredTeams.filter(
        team => team.conference && conferenceFilter.has(team.conference),
      );
      skippedConferenceTeams = teams.length - immediateMatches.length;
      filteredTeams = immediateMatches;
      console.log(
        `Identified ${immediateMatches.length} conference-aligned teams out of ${teams.length} for ${year}.`,
      );
      if (skippedConferenceTeams > 0) {
        console.log(`Skipping ${skippedConferenceTeams} teams without a matching conference override.`);
      }
    }
    if (TEAM_SLUG_FILTER) {
      filteredTeams = filteredTeams.filter(team => TEAM_SLUG_FILTER!.has(team.slug));
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
        if (conferenceFilter) {
          const teamConference = listing.conference;
          if (!teamConference || !conferenceFilter.has(teamConference)) {
            return;
          }
        }
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

