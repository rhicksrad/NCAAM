import fs from "node:fs/promises";
import path from "node:path";

import { getHistoryRoot } from "./utils.js";

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

type CatalogDocument = {
  count: number;
  cursor_hops: number;
  players: Array<{ id: number }>;
};

async function main(): Promise<void> {
  const historyRoot = getHistoryRoot();
  const fullPath = path.join(historyRoot, "players.index.json");
  const minPath = path.join(historyRoot, "players.index.min.json");

  const full = await readJson<CatalogDocument>(fullPath);
  const min = await readJson<Array<{ id: number }>>(minPath);

  if (!Array.isArray(full.players) || full.players.length === 0) {
    throw new Error("players.index.json is missing player data");
  }

  if (typeof full.count !== "number" || full.count !== full.players.length) {
    throw new Error("players.index.json count mismatch");
  }

  if (full.cursor_hops < 1) {
    console.warn("Warning: historical player crawl completed without any cursor hop.");
  }

  if (!Array.isArray(min) || min.length !== full.players.length) {
    throw new Error("players.index.min.json size mismatch");
  }

  const fullIds = new Set(full.players.map((player) => player.id));
  for (const entry of min) {
    if (!fullIds.has(entry.id)) {
      throw new Error(`players.index.min.json contains id ${entry.id} not present in full index`);
    }
  }

  console.log(
    `Verified history assets: ${full.players.length} players with ${full.cursor_hops} cursor hops recorded`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

