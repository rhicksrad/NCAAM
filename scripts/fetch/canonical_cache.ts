import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  CoachRecord,
  CoachRecordEntry,
  InjuryRecord,
  LeagueDataSource,
  SourcePlayerRecord,
  SourceTeamRecord,
  TeamRecord,
  TransactionRecord,
} from "../lib/types.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const CANONICAL_DIR = path.join(ROOT, "data/2025-26/canonical");

let cachedPromise: Promise<LeagueDataSource | undefined> | undefined;

async function readJsonFile<T>(relativePath: string): Promise<T | undefined> {
  try {
    const absolutePath = path.join(CANONICAL_DIR, relativePath);
    const contents = await readFile(absolutePath, "utf8");
    return JSON.parse(contents) as T;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      throw error;
    }
    return undefined;
  }
}

function cloneCoachRecord(record: CoachRecord | undefined): CoachRecord | undefined {
  if (!record) {
    return undefined;
  }
  const { name, role, isNew } = record;
  return {
    name,
    role,
    isNew,
  };
}

export async function loadCanonicalLeagueSource(): Promise<LeagueDataSource | undefined> {
  if (!cachedPromise) {
    cachedPromise = (async () => {
      try {
        const teams = (await readJsonFile<TeamRecord[]>("teams.json")) ?? [];
        if (teams.length === 0) {
          return undefined;
        }
        const coaches = (await readJsonFile<CoachRecordEntry[]>("coaches.json")) ?? [];
        const injuries = (await readJsonFile<InjuryRecord[]>("injuries.json")) ?? [];
        const transactions = (await readJsonFile<TransactionRecord[]>("transactions.json")) ?? [];

        const coachMap: Record<string, CoachRecord> = {};
        for (const entry of coaches) {
          coachMap[entry.teamTricode] = {
            name: entry.name,
            role: entry.role,
            isNew: entry.isNew,
          };
        }

        const teamsMap: Record<string, SourceTeamRecord> = {};
        const playersMap: Record<string, SourcePlayerRecord> = {};

        for (const team of teams) {
          const roster: SourcePlayerRecord[] = [];
          for (const player of team.roster ?? []) {
            const record: SourcePlayerRecord = {
              playerId: player.playerId,
              name: player.name,
              position: player.position,
              teamId: team.teamId,
              teamTricode: team.tricode,
              status: player.status,
              isNewAddition: player.isNewAddition,
            };
            roster.push(record);
            const key = record.playerId ?? record.name;
            playersMap[key] = { ...record };
          }

          teamsMap[team.tricode] = {
            teamId: team.teamId,
            tricode: team.tricode,
            market: team.market,
            name: team.name,
            roster,
            coach: cloneCoachRecord(coachMap[team.tricode]),
            lastSeasonWins: team.lastSeasonWins,
            lastSeasonSRS: team.lastSeasonSRS,
          };
        }

        return {
          teams: teamsMap,
          players: playersMap,
          transactions: transactions.map((transaction) => ({ ...transaction })),
          coaches: Object.fromEntries(
            Object.entries(coachMap).map(([key, value]) => [key, cloneCoachRecord(value)!])
          ),
          injuries: injuries.map((injury) => ({ ...injury })),
        } satisfies LeagueDataSource;
      } catch (error) {
        console.warn(`Failed to load canonical roster cache: ${(error as Error).message}`);
        return undefined;
      }
    })();
  }

  return cachedPromise;
}
