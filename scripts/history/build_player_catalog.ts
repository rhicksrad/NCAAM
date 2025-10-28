import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { z } from "zod";

import { request } from "../fetch/http.js";
import {
  ensureHistoryDir,
  getHistoryRoot,
  normalizeNameKey,
  writeJsonFile,
  writeMinifiedJsonFile,
} from "./utils.js";

const API_BASE = "https://bdlproxy.hicksrch.workers.dev/bdl";
const PER_PAGE = 100;
const MAX_PAGES = Number(process.env.HISTORY_PAGE_CAP ?? 2500);
const PAGE_DELAY_MS = Number(process.env.HISTORY_PAGE_DELAY_MS ?? 250);

const teamSchema = z
  .object({
    id: z.number().int(),
    abbreviation: z.string().min(1).optional().nullable(),
    full_name: z.string().min(1).optional().nullable(),
  })
  .strip();

const playerSchema = z
  .object({
    id: z.number().int(),
    first_name: z.string(),
    last_name: z.string(),
    position: z.string().nullable().optional(),
    height: z.string().nullable().optional(),
    weight: z.string().nullable().optional(),
    college: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    draft_year: z.union([z.string(), z.number(), z.null()]).optional(),
    draft_round: z.union([z.string(), z.number(), z.null()]).optional(),
    draft_number: z.union([z.string(), z.number(), z.null()]).optional(),
    team: teamSchema.nullable().optional(),
  })
  .strip();

const pageSchema = z
  .object({
    data: z.array(playerSchema),
    meta: z
      .object({
        next_cursor: z.union([z.string(), z.number(), z.null()]).optional(),
        per_page: z.number().int().optional(),
        total_pages: z.number().int().optional(),
        current_page: z.number().int().optional(),
      })
      .optional(),
  })
  .strip();

type PlayerRecord = z.infer<typeof playerSchema>;

type CatalogRow = {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  position: string | null;
  height: string | null;
  weight: string | null;
  college: string | null;
  country: string | null;
  draft_year: string | null;
  draft_round: string | null;
  draft_number: string | null;
  team: {
    id: number;
    abbreviation: string | null;
    full_name: string | null;
  } | null;
};

type MinRow = {
  id: number;
  first: string;
  last: string;
  name_key: string;
  position: string | null;
  debut_season?: number | null;
  final_season?: number | null;
};

type CatalogDocument = {
  fetched_at: string;
  source: "Ball Don't Lie";
  per_page: number;
  cursor_hops: number;
  count: number;
  players: CatalogRow[];
};

type PageResponse = z.infer<typeof pageSchema>;

function coerceNullable(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const stringValue = String(value).trim();
  return stringValue.length ? stringValue : null;
}

async function fetchPage(cursor?: string): Promise<PageResponse> {
  const query = new URLSearchParams();
  query.set("per_page", String(PER_PAGE));
  if (cursor && cursor.length) {
    query.set("cursor", cursor);
  }

  const url = `${API_BASE}/v1/players?${query.toString()}`;
  const raw = await request<unknown>(url);
  return pageSchema.parse(raw);
}

function toCatalogRow(player: PlayerRecord): CatalogRow {
  const fullName = `${player.first_name} ${player.last_name}`.replace(/\s+/g, " ").trim();
  return {
    id: player.id,
    first_name: player.first_name,
    last_name: player.last_name,
    full_name: fullName,
    position: player.position ?? null,
    height: coerceNullable(player.height),
    weight: coerceNullable(player.weight),
    college: coerceNullable(player.college),
    country: coerceNullable(player.country),
    draft_year: coerceNullable(player.draft_year),
    draft_round: coerceNullable(player.draft_round),
    draft_number: coerceNullable(player.draft_number),
    team: player.team
      ? {
          id: player.team.id,
          abbreviation: coerceNullable(player.team.abbreviation),
          full_name: coerceNullable(player.team.full_name),
        }
      : null,
  };
}

function toMinRow(row: CatalogRow): MinRow {
  return {
    id: row.id,
    first: row.first_name,
    last: row.last_name,
    name_key: normalizeNameKey(`${row.first_name} ${row.last_name}`),
    position: row.position,
  };
}

async function main(): Promise<void> {
  await ensureHistoryDir();

  const seenIds = new Map<number, CatalogRow>();
  let cursor: string | undefined;
  let hopCount = 0;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await fetchPage(cursor);
    for (const player of response.data) {
      seenIds.set(player.id, toCatalogRow(player));
    }

    const nextCursor = response.meta?.next_cursor;
    if (nextCursor === undefined || nextCursor === null || String(nextCursor).length === 0) {
      break;
    }

    cursor = String(nextCursor);
    hopCount += 1;
    if (PAGE_DELAY_MS > 0) {
      await delay(PAGE_DELAY_MS);
    }
  }

  const players = Array.from(seenIds.values()).sort((a, b) => {
    const lastCompare = a.last_name.localeCompare(b.last_name);
    if (lastCompare !== 0) return lastCompare;
    return a.first_name.localeCompare(b.first_name);
  });

  const catalog: CatalogDocument = {
    fetched_at: new Date().toISOString(),
    source: "Ball Don't Lie",
    per_page: PER_PAGE,
    cursor_hops: hopCount,
    count: players.length,
    players,
  };

  const historyRoot = getHistoryRoot();
  const fullPath = path.join(historyRoot, "players.index.json");
  const minPath = path.join(historyRoot, "players.index.min.json");

  await writeJsonFile(fullPath, catalog, { pretty: true });

  const minRows = players.map((row) => toMinRow(row));
  await writeMinifiedJsonFile(minPath, minRows);

  console.log(
    `Wrote ${players.length} historical players (${hopCount} cursor hops) to ${path.relative(".", fullPath)}`,
  );

  if (players.length > 0 && hopCount === 0) {
    console.warn("Warning: player crawl completed without any cursor hop. Verify pagination logic.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

