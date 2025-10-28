export interface BLTeam {
  id: number;
  abbreviation: string;
  full_name: string;
  city: string;
  division: string;
  conference: string;
}

export interface BLPlayer {
  id: number;
  first_name: string;
  last_name: string;
  position: string | null;
  jersey_number: string | null;
  height: string | null;
  weight: string | null;
  team: {
    id: number;
    abbreviation: string;
    full_name: string;
  };
}

export interface RosterTeam {
  id: number;
  abbreviation: string;
  full_name: string;
  roster: Array<Pick<BLPlayer, "id" | "first_name" | "last_name" | "position" | "jersey_number" | "height" | "weight">>;
}

export interface RostersDoc {
  fetched_at: string;
  ttl_hours: number;
  source?: string;
  season?: string;
  season_start_year?: number;
  teams: RosterTeam[];
}
