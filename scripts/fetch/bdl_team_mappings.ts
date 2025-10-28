import { TEAM_METADATA } from "../lib/teams.js";

export interface BdlTeamMapping {
  bdlId: number;
  bdlAbbr: string;
  tricode: string;
}

export const BDL_TEAM_MAPPINGS: readonly BdlTeamMapping[] = [
  { bdlId: 1, bdlAbbr: "ATL", tricode: "ATL" },
  { bdlId: 2, bdlAbbr: "BOS", tricode: "BOS" },
  { bdlId: 3, bdlAbbr: "BKN", tricode: "BKN" },
  { bdlId: 4, bdlAbbr: "CHA", tricode: "CHA" },
  { bdlId: 5, bdlAbbr: "CHI", tricode: "CHI" },
  { bdlId: 6, bdlAbbr: "CLE", tricode: "CLE" },
  { bdlId: 7, bdlAbbr: "DAL", tricode: "DAL" },
  { bdlId: 8, bdlAbbr: "DEN", tricode: "DEN" },
  { bdlId: 9, bdlAbbr: "DET", tricode: "DET" },
  { bdlId: 10, bdlAbbr: "GSW", tricode: "GSW" },
  { bdlId: 11, bdlAbbr: "HOU", tricode: "HOU" },
  { bdlId: 12, bdlAbbr: "IND", tricode: "IND" },
  { bdlId: 13, bdlAbbr: "LAC", tricode: "LAC" },
  { bdlId: 14, bdlAbbr: "LAL", tricode: "LAL" },
  { bdlId: 15, bdlAbbr: "MEM", tricode: "MEM" },
  { bdlId: 16, bdlAbbr: "MIA", tricode: "MIA" },
  { bdlId: 17, bdlAbbr: "MIL", tricode: "MIL" },
  { bdlId: 18, bdlAbbr: "MIN", tricode: "MIN" },
  { bdlId: 19, bdlAbbr: "NOP", tricode: "NOP" },
  { bdlId: 20, bdlAbbr: "NYK", tricode: "NYK" },
  { bdlId: 21, bdlAbbr: "OKC", tricode: "OKC" },
  { bdlId: 22, bdlAbbr: "ORL", tricode: "ORL" },
  { bdlId: 23, bdlAbbr: "PHI", tricode: "PHI" },
  { bdlId: 24, bdlAbbr: "PHX", tricode: "PHX" },
  { bdlId: 25, bdlAbbr: "POR", tricode: "POR" },
  { bdlId: 26, bdlAbbr: "SAC", tricode: "SAC" },
  { bdlId: 27, bdlAbbr: "SAS", tricode: "SAS" },
  { bdlId: 28, bdlAbbr: "TOR", tricode: "TOR" },
  { bdlId: 29, bdlAbbr: "UTA", tricode: "UTA" },
  { bdlId: 30, bdlAbbr: "WAS", tricode: "WAS" },
];

const KNOWN_TRICODES = new Set(TEAM_METADATA.map((team) => team.tricode.toUpperCase()));

export const BDL_TEAM_ID_TO_TRICODE = new Map<number, string>(
  BDL_TEAM_MAPPINGS.map((mapping) => [mapping.bdlId, mapping.tricode]),
);

export const BDL_TEAM_ABBR_TO_TRICODE = new Map<string, string>(
  BDL_TEAM_MAPPINGS.map((mapping) => [mapping.bdlAbbr, mapping.tricode]),
);

export function mapBdlTeamToTricode(team: { id?: unknown; abbreviation?: unknown }): string {
  const teamId = typeof team.id === "number" ? team.id : undefined;
  const rawAbbr = typeof team.abbreviation === "string" ? team.abbreviation.toUpperCase() : undefined;

  if (rawAbbr) {
    const mapped =
      BDL_TEAM_ABBR_TO_TRICODE.get(rawAbbr) ?? (KNOWN_TRICODES.has(rawAbbr) ? rawAbbr : undefined);
    if (mapped) {
      return mapped;
    }
  }

  if (teamId !== undefined) {
    const mapped = BDL_TEAM_ID_TO_TRICODE.get(teamId);
    if (mapped) {
      return mapped;
    }
  }

  throw new Error(
    `Unable to map Ball Don't Lie team to local tricode (id=${String(teamId)}, abbreviation=${String(
      rawAbbr ?? "",
    )})`,
  );
}

export function lookupTricodeByBdlId(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return BDL_TEAM_ID_TO_TRICODE.get(value);
  }
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isFinite(parsed)) {
    return BDL_TEAM_ID_TO_TRICODE.get(parsed);
  }
  return undefined;
}
