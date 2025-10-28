import { buildUrl, execute } from "./http.js";

const PAGE_SIZE = 25;

export interface BdlPlayerSummary {
  id?: number;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  height?: string | null;
  weight?: string | null;
  jersey_number?: string | null;
  college?: string | null;
  country?: string | null;
  draft_year?: number | null;
  draft_round?: number | null;
  draft_number?: number | null;
  team_id?: number | null;
  team?: { id?: number | null; abbreviation?: string | null; full_name?: string | null } | null;
}

export interface BdlPlayerInjury {
  id?: number;
  player?: BdlPlayerSummary | null;
  return_date?: string | null;
  description?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface PlayerInjuryPage {
  data?: BdlPlayerInjury[] | null;
  meta?: {
    next_cursor?: number | string | null;
  } | null;
}

export async function fetchPlayerInjuries(): Promise<BdlPlayerInjury[]> {
  const out: BdlPlayerInjury[] = [];
  let cursor: number | string | null | undefined = undefined;

  for (let i = 0; i < 4000; i += 1) {
    const qs =
      cursor != null ? `?per_page=${PAGE_SIZE}&cursor=${cursor}` : `?per_page=${PAGE_SIZE}`;
    const res = await execute<PlayerInjuryPage>(buildUrl("/v1/player_injuries", qs));
    const batch = Array.isArray(res?.data) ? res.data : [];
    out.push(...batch);

    const next = res?.meta?.next_cursor ?? null;
    if (!next || batch.length === 0) {
      break;
    }
    cursor = next ?? undefined;
  }

  return out;
}
