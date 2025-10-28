import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { fetchPlayerInjuries, BdlPlayerInjury, BdlPlayerSummary } from "./fetch/bdl_player_injuries.js";
import { lookupTricodeByBdlId, mapBdlTeamToTricode } from "./fetch/bdl_team_mappings.js";
import { TRICODE_TO_TEAM } from "./lib/teams.js";

const OUTPUT_DIR = path.join(process.cwd(), "public", "data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "player_injuries.json");
const FAILURE_FILE = path.join(OUTPUT_DIR, "player_injuries.failed.json");

export type InjuryStatusLevel = "season" | "caution" | "monitor" | "ready";

const STATUS_PRIORITIES: Record<InjuryStatusLevel, number> = {
  season: 0,
  caution: 1,
  monitor: 2,
  ready: 3,
};

const DEFAULT_MAX_ITEMS = 10;

export interface InjuryMonitorItem {
  player: string;
  status: string;
  status_level: InjuryStatusLevel;
  player_id?: number;
  team_tricode?: string;
  team_name?: string;
  return_date?: string;
  description?: string;
  report_label?: string;
  last_updated?: string;
}

export interface InjuryMonitorSnapshot {
  fetched_at: string;
  source: string;
  items: InjuryMonitorItem[];
  note: string;
}

interface InternalInjuryEntry {
  playerId?: number;
  playerKey: string;
  playerName: string;
  teamTricode?: string;
  teamName?: string;
  status: string;
  statusLevel: InjuryStatusLevel;
  returnDate?: string;
  description?: string;
  reportLabel?: string;
  priority: number;
  timestamp: number;
  index: number;
}

function safeTrim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function classifyInjuryStatus(
  statusRaw: string | null | undefined,
  descriptionRaw: string | null | undefined,
): { level: InjuryStatusLevel; priority: number } {
  const statusText = safeTrim(statusRaw).toLowerCase();
  const descriptionText = safeTrim(descriptionRaw).toLowerCase();
  const combined = `${statusText} ${descriptionText}`;

  const seasonPatterns = [
    /season[-\s]?ending/, // season-ending or season ending
    /out for the season/,
    /ruled out for the season/,
    /shut down for the season/,
    /rest of the season/,
  ];

  if (seasonPatterns.some((pattern) => pattern.test(combined))) {
    return { level: "season", priority: STATUS_PRIORITIES.season };
  }

  if (statusText.includes("out")) {
    return { level: "caution", priority: STATUS_PRIORITIES.caution };
  }

  if (
    /doubtful/.test(statusText) ||
    /questionable/.test(statusText) ||
    /day[-\s]?to[-\s]?day/.test(statusText) ||
    /game[-\s]?time/.test(statusText)
  ) {
    return { level: "monitor", priority: STATUS_PRIORITIES.monitor };
  }

  if (/probable/.test(statusText) || /available/.test(statusText)) {
    return { level: "ready", priority: STATUS_PRIORITIES.ready };
  }

  if (combined.includes("indefinitely")) {
    return { level: "caution", priority: STATUS_PRIORITIES.caution };
  }

  return { level: "monitor", priority: STATUS_PRIORITIES.monitor };
}

function normalizePlayerSummary(player: BdlPlayerSummary | null | undefined): {
  playerId?: number;
  name: string;
  key: string;
} | null {
  if (!player) {
    return null;
  }

  const playerId = typeof player.id === "number" && Number.isFinite(player.id) ? player.id : undefined;
  const first = safeTrim(player.first_name);
  const last = safeTrim(player.last_name);
  const name = `${first} ${last}`.trim();

  if (!name) {
    return null;
  }

  const key = playerId !== undefined ? `id:${playerId}` : `name:${name.toLowerCase()}`;

  return { playerId, name, key };
}

function resolveTeamTricode(player: BdlPlayerSummary | null | undefined): string | undefined {
  if (!player) {
    return undefined;
  }

  const direct = lookupTricodeByBdlId(player.team_id ?? player.team?.id ?? null);
  if (direct) {
    return direct;
  }

  const abbreviation = safeTrim(player.team?.abbreviation);
  if (abbreviation) {
    try {
      return mapBdlTeamToTricode({ abbreviation });
    } catch {
      // ignore mapping error
    }
  }

  return undefined;
}

function resolveTeamName(tricode: string | undefined): string | undefined {
  if (!tricode) {
    return undefined;
  }
  const metadata = TRICODE_TO_TEAM.get(tricode.toUpperCase());
  if (!metadata) {
    return undefined;
  }
  return `${metadata.market} ${metadata.name}`.trim();
}

function extractReportLabel(description: string | null | undefined): string | undefined {
  const text = safeTrim(description);
  if (!text) {
    return undefined;
  }
  const colonIndex = text.indexOf(":");
  if (colonIndex > 0) {
    const label = text.slice(0, colonIndex).trim();
    if (label) {
      return label;
    }
  }
  return undefined;
}

function parseTimestamp(...values: Array<string | null | undefined>): number {
  for (const value of values) {
    if (!value) {
      continue;
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

export function normalizeInjuryEntry(injury: BdlPlayerInjury, index: number): InternalInjuryEntry | null {
  const summary = normalizePlayerSummary(injury.player);
  if (!summary) {
    return null;
  }

  const statusText = safeTrim(injury.status) || "Status unavailable";
  const { level, priority } = classifyInjuryStatus(injury.status, injury.description);

  const teamTricode = resolveTeamTricode(injury.player ?? undefined);
  const teamName = resolveTeamName(teamTricode);
  const reportLabel = extractReportLabel(injury.description);
  const timestamp = parseTimestamp(injury.updated_at, injury.created_at);

  return {
    playerId: summary.playerId,
    playerKey: summary.key,
    playerName: summary.name,
    teamTricode: teamTricode,
    teamName,
    status: statusText,
    statusLevel: level,
    returnDate: safeTrim(injury.return_date) || undefined,
    description: safeTrim(injury.description) || undefined,
    reportLabel,
    priority,
    timestamp,
    index,
  };
}

export async function collectMonitorEntries(options: { maxItems?: number } = {}): Promise<InternalInjuryEntry[]> {
  const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;

  const rawInjuries = await fetchPlayerInjuries();
  const deduped = new Map<string, InternalInjuryEntry>();

  rawInjuries.forEach((injury, index) => {
    const normalized = normalizeInjuryEntry(injury, index);
    if (!normalized) {
      return;
    }

    const existing = deduped.get(normalized.playerKey);
    if (!existing) {
      deduped.set(normalized.playerKey, normalized);
      return;
    }

    if (normalized.priority < existing.priority) {
      deduped.set(normalized.playerKey, normalized);
      return;
    }

    if (normalized.priority === existing.priority) {
      if (normalized.timestamp > existing.timestamp) {
        deduped.set(normalized.playerKey, normalized);
        return;
      }
      if (normalized.timestamp === existing.timestamp && normalized.index < existing.index) {
        deduped.set(normalized.playerKey, normalized);
      }
    }
  });

  const entries = Array.from(deduped.values());
  entries.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    if (a.timestamp !== b.timestamp) {
      return b.timestamp - a.timestamp;
    }
    return a.index - b.index;
  });

  return entries.slice(0, maxItems);
}

export async function buildInjuryMonitorSnapshot(options: { maxItems?: number } = {}): Promise<InjuryMonitorSnapshot> {
  const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;
  const entries = await collectMonitorEntries({
    maxItems,
  });

  const items: InjuryMonitorItem[] = entries.map((entry) => {
    const item: InjuryMonitorItem = {
      player: entry.playerName,
      status: entry.status,
      status_level: entry.statusLevel,
    };
    if (entry.playerId !== undefined) {
      item.player_id = entry.playerId;
    }
    if (entry.teamTricode) {
      item.team_tricode = entry.teamTricode;
    }
    if (entry.teamName) {
      item.team_name = entry.teamName;
    }
    if (entry.returnDate) {
      item.return_date = entry.returnDate;
    }
    if (entry.description) {
      item.description = entry.description;
    }
    if (entry.reportLabel) {
      item.report_label = entry.reportLabel;
    }
    if (entry.timestamp > 0) {
      item.last_updated = new Date(entry.timestamp).toISOString();
    }
    return item;
  });

  return {
    fetched_at: new Date().toISOString(),
    source: "Ball Don't Lie",
    items,
    note: "Source: Ball Don't Lie player injuries feed. Displaying the 10 most relevant recent reports.",
  };
}

export async function writeInjuryMonitorSnapshot(
  outFile: string = OUTPUT_FILE,
  failFile: string = FAILURE_FILE,
): Promise<InjuryMonitorSnapshot> {
  try {
    const snapshot = await buildInjuryMonitorSnapshot();
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.writeFile(outFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    await fs.rm(failFile, { force: true });
    console.log(`Wrote injury snapshot to ${outFile} with ${snapshot.items.length} entries.`);
    return snapshot;
  } catch (error) {
    const payload = {
      error: error instanceof Error ? error.message : String(error),
      at: new Date().toISOString(),
    };
    await fs.mkdir(path.dirname(failFile), { recursive: true });
    await fs.writeFile(failFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    throw error;
  }
}

async function main() {
  const allowSoftFail = process.env.ALLOW_INJURY_FAILURE === "true";
  try {
    await writeInjuryMonitorSnapshot();
  } catch (error) {
    if (allowSoftFail) {
      console.warn(error instanceof Error ? error.message : String(error));
      console.warn("Continuing without injury snapshot due to ALLOW_INJURY_FAILURE=true");
    } else {
      console.error("Failed to build injury monitor snapshot:", error);
      process.exitCode = 1;
    }
  }
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  main();
}
