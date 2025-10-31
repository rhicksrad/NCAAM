import * as fs from "node:fs/promises";
import * as path from "node:path";

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

interface PlayerIndexEntry {
  slug: string;
}

interface PlayerIndexDocument {
  players?: PlayerIndexEntry[];
}

const STRING_KEYS: Array<keyof PlayerSeasonStats> = ["season", "team", "conf"];
const NUMERIC_KEYS: Array<keyof PlayerSeasonStats> = [
  "gp",
  "gs",
  "mp_g",
  "fg_pct",
  "fg3_pct",
  "ft_pct",
  "orb_g",
  "drb_g",
  "trb_g",
  "ast_g",
  "stl_g",
  "blk_g",
  "tov_g",
  "pf_g",
  "pts_g",
];

function assertString(value: unknown, message: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(message);
  }
}

function assertNumberOrNull(value: unknown, message: string): void {
  if (value === null) {
    return;
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(message);
  }
}

async function validatePlayer(slug: string): Promise<void> {
  const filePath = path.resolve("public", "data", "players", `${slug}.json`);
  const raw = await fs.readFile(filePath, "utf8");
  const doc = JSON.parse(raw) as PlayerStatsDocument;
  if (doc.slug !== slug) {
    throw new Error(`Slug mismatch for ${slug}: received ${doc.slug}`);
  }
  assertString(doc.name, `Missing player name for ${slug}`);
  assertString(doc.source, `Missing source URL for ${slug}`);
  assertString(doc.last_scraped, `Missing last_scraped for ${slug}`);
  if (!Array.isArray(doc.seasons)) {
    throw new Error(`Seasons missing or invalid for ${slug}`);
  }
  for (const season of doc.seasons) {
    for (const key of STRING_KEYS) {
      assertString((season as Record<string, unknown>)[key], `Season ${key} missing for ${slug}`);
    }
    for (const key of NUMERIC_KEYS) {
      assertNumberOrNull((season as Record<string, unknown>)[key], `Season ${key} invalid for ${slug}`);
    }
  }
}

async function main(): Promise<void> {
  const indexPath = path.resolve("public", "data", "players_index.json");
  const indexRaw = await fs.readFile(indexPath, "utf8");
  const indexDoc = JSON.parse(indexRaw) as PlayerIndexDocument;
  const players = Array.isArray(indexDoc.players) ? indexDoc.players : [];
  if (players.length === 0) {
    throw new Error("Player index contains no players");
  }
  const sample = players.slice(0, Math.min(5, players.length));
  await Promise.all(sample.map(entry => validatePlayer(entry.slug)));
  console.log(`Validated ${sample.length} player files`);
}

main().catch(error => {
  console.error("Validation failed", error);
  process.exitCode = 1;
});

