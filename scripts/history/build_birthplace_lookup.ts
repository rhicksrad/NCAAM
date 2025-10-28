import fs from "node:fs/promises";
import path from "node:path";

import { normalizeNameKey, ensureHistoryDir, writeJsonFile } from "./utils.js";

interface BirthplaceRecord {
  player: string;
  city: string | null;
  stateName: string | null;
  state: string | null;
  country: string | null;
  source: string;
}

interface PlayerEntry {
  city: string | null;
  stateName: string | null;
  state: string | null;
  country: string | null;
  source: string;
}

interface BirthplaceDocument {
  generated_at: string;
  sources: Array<{ file: string; records: number }>;
  players: Record<string, PlayerEntry[]>;
}

const STATE_ALIASES: Record<string, string> = {
  "alabama": "AL",
  "alaska": "AK",
  "arizona": "AZ",
  "arkansas": "AR",
  "california": "CA",
  "colorado": "CO",
  "connecticut": "CT",
  "delaware": "DE",
  "district of columbia": "DC",
  "washington, d.c.": "DC",
  "washington dc": "DC",
  "florida": "FL",
  "georgia": "GA",
  "hawaii": "HI",
  "idaho": "ID",
  "illinois": "IL",
  "indiana": "IN",
  "iowa": "IA",
  "kansas": "KS",
  "kentucky": "KY",
  "louisiana": "LA",
  "maine": "ME",
  "maryland": "MD",
  "massachusetts": "MA",
  "michigan": "MI",
  "minnesota": "MN",
  "mississippi": "MS",
  "missouri": "MO",
  "montana": "MT",
  "nebraska": "NE",
  "nevada": "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  "ohio": "OH",
  "oklahoma": "OK",
  "oregon": "OR",
  "pennsylvania": "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  "tennessee": "TN",
  "texas": "TX",
  "utah": "UT",
  "vermont": "VT",
  "virginia": "VA",
  "washington": "WA",
  "west virginia": "WV",
  "wisconsin": "WI",
  "wyoming": "WY",
};

function toStateAbbr(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length === 2 && /^[A-Z]{2}$/u.test(trimmed)) {
    return trimmed;
  }
  const normalized = trimmed.toLowerCase();
  return STATE_ALIASES[normalized] ?? null;
}

function normalizeCountry(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (["usa", "u.s.a.", "united states", "united states of america", "u.s."].includes(normalized)) {
    return "USA";
  }
  if (normalized === "england" || normalized === "scotland" || normalized === "wales") {
    return "United Kingdom";
  }
  return value;
}

function parseBirthplace(player: string, birthplace: string, source: string): BirthplaceRecord {
  const trimmed = birthplace.trim();
  if (!trimmed.length) {
    return { player, city: null, stateName: null, state: null, country: null, source };
  }

  const parts = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return { player, city: null, stateName: null, state: null, country: null, source };
  }

  let city: string | null = null;
  let stateName: string | null = null;
  let state: string | null = null;
  let country: string | null = null;

  if (parts.length === 1) {
    country = normalizeCountry(parts[0]);
    return { player, city, stateName, state, country, source };
  }

  const lastPart = parts[parts.length - 1];
  const secondLast = parts.length >= 2 ? parts[parts.length - 2] : null;
  const lastAsState = toStateAbbr(lastPart.toUpperCase() === lastPart ? lastPart : lastPart);
  const lastNormalized = lastPart.toLowerCase();

  if (lastAsState) {
    country = "USA";
    state = lastAsState;
    stateName = lastPart;
    city = parts.slice(0, parts.length - 1).join(", ") || null;
  } else if (["usa", "u.s.a.", "united states", "united states of america", "u.s."].includes(lastNormalized)) {
    country = "USA";
    if (secondLast) {
      stateName = secondLast;
      state = toStateAbbr(secondLast);
      city = parts.slice(0, parts.length - 2).join(", ") || null;
    } else {
      city = null;
    }
  } else {
    country = normalizeCountry(lastPart);
    if (parts.length >= 3) {
      stateName = secondLast;
      state = toStateAbbr(secondLast);
      city = parts.slice(0, parts.length - 2).join(", ") || null;
    } else {
      city = parts.slice(0, parts.length - 1).join(", ") || null;
    }
  }

  if (!country) {
    country = null;
  }

  if (state && stateName && stateName.length === 2 && stateName.toUpperCase() === stateName) {
    // Normalize uppercase abbreviations without full state name
    const normalized = Object.entries(STATE_ALIASES).find(([, abbr]) => abbr === state);
    if (normalized) {
      stateName = normalized[0].replace(/\b\w/g, (letter) => letter.toUpperCase());
    }
  }

  return { player, city, stateName, state, country, source };
}

async function loadCsv(filePath: string): Promise<Array<{ player: string; birthplace: string }>> {
  const raw = await fs.readFile(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  const rows: Array<{ player: string; birthplace: string }> = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const [playerPart, ...rest] = line.split(",");
    if (!playerPart) continue;
    const player = playerPart.replace(/^"|"$/g, "").trim();
    const birthplace = rest.join(",").replace(/^"|"$/g, "").trim();
    if (!player || !birthplace) continue;
    rows.push({ player, birthplace });
  }
  return rows;
}

async function main(): Promise<void> {
  const sources = [
    { file: path.join("data", "nba_birthplaces.csv"), label: "nba_birthplaces.csv" },
    { file: path.join("data", "nba_draft_birthplaces.csv"), label: "nba_draft_birthplaces.csv" },
  ];

  const entries = new Map<string, PlayerEntry[]>();
  const sourceMeta: Array<{ file: string; records: number }> = [];

  for (const source of sources) {
    const rows = await loadCsv(source.file);
    sourceMeta.push({ file: source.label, records: rows.length });
    for (const row of rows) {
      const normalizedName = normalizeNameKey(row.player);
      const record = parseBirthplace(row.player, row.birthplace, source.label);
      const existing = entries.get(normalizedName) ?? [];
      const playerEntry: PlayerEntry = {
        city: record.city,
        stateName: record.stateName,
        state: record.state,
        country: record.country,
        source: source.label,
      };
      existing.push(playerEntry);
      entries.set(normalizedName, existing);
    }
  }

  const players: Record<string, PlayerEntry[]> = {};
  const sortedKeys = Array.from(entries.keys()).sort();
  for (const key of sortedKeys) {
    players[key] = entries.get(key) ?? [];
  }

  const document: BirthplaceDocument = {
    generated_at: new Date().toISOString(),
    sources: sourceMeta,
    players,
  };

  await ensureHistoryDir();
  const outputPath = path.join("public", "data", "history", "player_birthplaces.json");
  await writeJsonFile(outputPath, document, { pretty: true });
  console.log(
    `Wrote ${sortedKeys.length} player birthplace entries to ${path.relative(".", outputPath)}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
