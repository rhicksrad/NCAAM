#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const dataDir = path.resolve("public/data/cbb");
const outputFile = path.resolve("public/data/cbb/cbb-summary.json");

function parseCsv(text) {
  const rows = [];
  let current = [];
  let value = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "\"") {
      const next = text[i + 1];
      if (inQuotes && next === "\"") {
        value += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      current.push(value);
      value = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (value !== "" || current.length > 0) {
        current.push(value);
        rows.push(current);
        current = [];
        value = "";
      }
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      continue;
    }
    value += char;
  }
  if (value !== "" || current.length > 0) {
    current.push(value);
    rows.push(current);
  }
  return rows;
}

function toNumber(raw) {
  if (raw == null) {
    return null;
  }
  const trimmed = String(raw).trim();
  if (!trimmed) {
    return null;
  }
  const numeric = Number(trimmed);
  return Number.isNaN(numeric) ? null : numeric;
}

function round(value, precision = 2) {
  if (value == null) {
    return null;
  }
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function normalizeHeader(header) {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
}

function parseYearFromFile(name) {
  const match = name.match(/cbb(\d{2})/i);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  if (value >= 0 && value <= 9) {
    return 2000 + value;
  }
  if (value >= 10 && value <= 99) {
    return 2000 + value;
  }
  return null;
}

const allowedFiles = new Set(["cbb.csv", "cbb20.csv", "cbb25.csv"]);

const files = readdirSync(dataDir)
  .filter(file => file.endsWith(".csv") && allowedFiles.has(file))
  .sort();

const teams = new Map();

for (const file of files) {
  const fullPath = path.join(dataDir, file);
  const raw = readFileSync(fullPath, "utf8").trim();
  if (!raw) continue;
  const rows = parseCsv(raw);
  if (rows.length <= 1) continue;
  const headers = rows[0].map(normalizeHeader);
  const headerIndex = new Map();
  headers.forEach((header, index) => {
    headerIndex.set(header, index);
  });

  const inferredYear = toNumber(rows[0][headerIndex.get("year")] ?? null) ?? parseYearFromFile(file);

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.length === 1 && row[0].trim() === "") {
      continue;
    }
    const get = key => {
      const index = headerIndex.get(key);
      if (index == null) {
        return null;
      }
      return row[index] ?? null;
    };
    const teamName = get("team") ?? get("team_");
    if (!teamName) {
      continue;
    }
    const team = String(teamName).trim();
    const conference = (get("conf") ?? "").trim();
    const year = toNumber(get("year")) ?? inferredYear;
    const games = toNumber(get("g"));
    const wins = toNumber(get("w"));
    const postseasonRaw = get("postseason");
    const postseason = postseasonRaw ? String(postseasonRaw).trim() || null : null;
    const seed = toNumber(get("seed"));
    const wab = toNumber(get("wab"));
    const adjO = toNumber(get("adjoe"));
    const adjD = toNumber(get("adjde"));
    const barthag = toNumber(get("barthag"));
    const tempo = toNumber(get("adj_t"));

    const season = {
      year,
      conference: conference || null,
      games,
      wins,
      losses: games != null && wins != null ? games - wins : null,
      adjO,
      adjD,
      barthag,
      tempo,
      wab,
      postseason,
      seed,
    };

    if (!teams.has(team)) {
      teams.set(team, []);
    }
    teams.get(team).push(season);
  }
}

function average(values) {
  const filtered = values.filter(value => value != null);
  if (filtered.length === 0) {
    return null;
  }
  const total = filtered.reduce((sum, value) => sum + value, 0);
  return total / filtered.length;
}

const summary = {};

for (const [team, seasons] of teams.entries()) {
  seasons.sort((a, b) => {
    if (a.year == null && b.year == null) return 0;
    if (a.year == null) return -1;
    if (b.year == null) return 1;
    return a.year - b.year;
  });
  const firstYear = seasons.find(season => season.year != null)?.year ?? null;
  const lastYear = [...seasons].reverse().find(season => season.year != null)?.year ?? firstYear;
  const seasonCount = seasons.length;

  const averageWins = average(seasons.map(season => season.wins));
  const averageLosses = average(seasons.map(season => season.losses));
  const averageAdjO = average(seasons.map(season => season.adjO));
  const averageAdjD = average(seasons.map(season => season.adjD));
  const averageBarthag = average(seasons.map(season => season.barthag));
  const averageTempo = average(seasons.map(season => season.tempo));

  const postseasonAppearances = seasons.filter(season => season.postseason).length;
  const bestSeason = seasons
    .slice()
    .sort((a, b) => {
      const wabA = a.wab ?? -Infinity;
      const wabB = b.wab ?? -Infinity;
      if (wabA !== wabB) {
        return wabB - wabA;
      }
      const barthagA = a.barthag ?? -Infinity;
      const barthagB = b.barthag ?? -Infinity;
      if (barthagA !== barthagB) {
        return barthagB - barthagA;
      }
      const winsA = a.wins ?? -Infinity;
      const winsB = b.wins ?? -Infinity;
      return winsB - winsA;
    })[0];

  const conferences = Array.from(new Set(seasons.map(season => season.conference).filter(Boolean)));

  summary[team] = {
    team,
    seasons: seasonCount,
    firstYear,
    lastYear,
    conferences,
    averages: {
      wins: averageWins != null ? round(averageWins, 1) : null,
      losses: averageLosses != null ? round(averageLosses, 1) : null,
      adjO: averageAdjO != null ? round(averageAdjO, 1) : null,
      adjD: averageAdjD != null ? round(averageAdjD, 1) : null,
      barthag: averageBarthag != null ? round(averageBarthag, 3) : null,
      tempo: averageTempo != null ? round(averageTempo, 1) : null,
    },
    postseason: {
      appearances: postseasonAppearances,
      bestFinish: bestSeason?.postseason ?? null,
    },
    bestSeason: bestSeason
      ? {
          year: bestSeason.year,
          wins: bestSeason.wins,
          losses: bestSeason.losses,
          postseason: bestSeason.postseason,
          seed: bestSeason.seed,
          wab: bestSeason.wab != null ? round(bestSeason.wab, 2) : null,
          adjO: bestSeason.adjO != null ? round(bestSeason.adjO, 1) : null,
          adjD: bestSeason.adjD != null ? round(bestSeason.adjD, 1) : null,
          barthag: bestSeason.barthag != null ? round(bestSeason.barthag, 4) : null,
        }
      : null,
    recentSeason: seasons.length > 0
      ? {
          year: seasons[seasons.length - 1].year,
          wins: seasons[seasons.length - 1].wins,
          losses: seasons[seasons.length - 1].losses,
          postseason: seasons[seasons.length - 1].postseason,
          seed: seasons[seasons.length - 1].seed,
          wab: seasons[seasons.length - 1].wab != null ? round(seasons[seasons.length - 1].wab, 2) : null,
          adjO: seasons[seasons.length - 1].adjO != null ? round(seasons[seasons.length - 1].adjO, 1) : null,
          adjD: seasons[seasons.length - 1].adjD != null ? round(seasons[seasons.length - 1].adjD, 1) : null,
          barthag: seasons[seasons.length - 1].barthag != null ? round(seasons[seasons.length - 1].barthag, 4) : null,
        }
      : null,
  };
}

writeFileSync(outputFile, JSON.stringify(summary, null, 2));

console.log(`Wrote summary for ${Object.keys(summary).length} teams to ${path.relative(process.cwd(), outputFile)}`);
