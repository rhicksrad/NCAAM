import { readFile } from "node:fs/promises";

import { TEAM_METADATA } from "../lib/teams.js";

interface ActiveRosterPlayer {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  height: string;
  weight: string;
  jersey_number: string;
  team_abbr: string;
  team_bdl_id: number;
}

interface ActiveRosterDoc {
  rosters: Record<string, ActiveRosterPlayer[]>;
}

function ensureRosterDoc(raw: unknown): ActiveRosterDoc {
  if (!raw || typeof raw !== "object") {
    throw new Error("Active roster JSON is not an object");
  }
  const rosters = (raw as { rosters?: unknown }).rosters;
  if (!rosters || typeof rosters !== "object") {
    throw new Error("Active roster JSON missing 'rosters' map");
  }
  return { rosters: rosters as Record<string, ActiveRosterPlayer[]> };
}

function summarizeSample(players: ActiveRosterPlayer[]): string {
  const sample = players
    .slice()
    .sort((a, b) => {
      const aKey = `${a.last_name ?? ""} ${a.first_name ?? ""}`.toLowerCase();
      const bKey = `${b.last_name ?? ""} ${b.first_name ?? ""}`.toLowerCase();
      return aKey.localeCompare(bKey);
    })
    .slice(0, 3)
    .map((player) => player.last_name || player.first_name || String(player.id));

  return sample.join(", ");
}

async function main(): Promise<void> {
  const raw = await readFile("public/data/rosters.json", "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const doc = ensureRosterDoc(parsed);

  const missingTeams: string[] = [];
  const rangeViolations: string[] = [];
  const duplicateViolations: string[] = [];
  const blakeHits: string[] = [];
  const nullTeamViolations: string[] = [];

  for (const meta of TEAM_METADATA) {
    const roster = doc.rosters[meta.tricode];
    if (!Array.isArray(roster) || roster.length === 0) {
      missingTeams.push(meta.tricode);
      continue;
    }

    if (roster.length < 13 || roster.length > 21) {
      rangeViolations.push(`${meta.tricode}:${roster.length}`);
    }

    const seen = new Set<number>();
    for (const player of roster) {
      if (typeof player.id !== "number" || Number.isNaN(player.id)) {
        throw new Error(`Invalid player id for ${meta.tricode}`);
      }
      if (!player.team_abbr || player.team_abbr !== meta.tricode) {
        nullTeamViolations.push(`${meta.tricode}:${player.id}`);
      }
      if (seen.has(player.id)) {
        duplicateViolations.push(`${meta.tricode}:${player.id}`);
      }
      seen.add(player.id);
      if (player.first_name === "Blake" && player.last_name === "Griffin") {
        blakeHits.push(`${meta.tricode}:${player.id}`);
      }
    }

    const summary = summarizeSample(roster);
    console.log(`${meta.tricode}: ${roster.length} players (sample: ${summary})`);
  }

  if (missingTeams.length) {
    throw new Error(`Missing rosters for: ${missingTeams.join(", ")}`);
  }
  if (rangeViolations.length) {
    throw new Error(`Roster size out of bounds: ${rangeViolations.join(", ")}`);
  }
  if (duplicateViolations.length) {
    throw new Error(`Duplicate player ids detected: ${duplicateViolations.join(", ")}`);
  }
  if (nullTeamViolations.length) {
    throw new Error(`Players missing team assignments: ${nullTeamViolations.join(", ")}`);
  }
  if (blakeHits.length) {
    throw new Error(`Blake Griffin detected in active data: ${blakeHits.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
