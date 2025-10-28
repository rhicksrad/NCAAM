export interface PlayerRecord {
  playerId?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  teamId?: string;
  teamTricode?: string;
  source?: string;
  status?: string;
  injuries?: InjuryRecord[];
  isNewAddition?: boolean;
}

export interface PlayerScoringAverage {
  playerId: string;
  pointsPerGame: number;
  gamesPlayed: number;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface PlayerScoringDataset {
  season?: string;
  generatedAt?: string;
  players?: PlayerScoringAverage[];
}

export interface PlayerScoringIndex {
  byId: Record<string, PlayerScoringAverage>;
  byName: Record<string, PlayerScoringAverage>;
}

export interface TeamRecord {
  teamId: string;
  tricode: string;
  market: string;
  name: string;
  coach?: CoachRecord;
  lastSeasonWins?: number;
  lastSeasonSRS?: number;
  roster: PlayerRecord[];
  keyAdditions: string[];
  keyLosses: string[];
  notes: string[];
}

export interface CoachRecord {
  name: string;
  role?: string;
  isNew?: boolean;
}

export interface InjuryRecord {
  playerName: string;
  status: string;
  expectedReturn?: string;
  severity?: "low" | "medium" | "high";
}

export interface TransactionRecord {
  teamTricode?: string;
  description: string;
  date?: string;
  type?: string;
}

export interface LeagueDataSource {
  teams: Record<string, Partial<SourceTeamRecord>>;
  players: Record<string, SourcePlayerRecord>;
  transactions: TransactionRecord[];
  coaches: Record<string, CoachRecord>;
  injuries: InjuryRecord[];
}

export interface SourceTeamRecord {
  teamId: string;
  tricode: string;
  market: string;
  name: string;
  roster: SourcePlayerRecord[];
  coach?: CoachRecord;
  lastSeasonWins?: number;
  lastSeasonSRS?: number;
}

export interface SourcePlayerRecord {
  playerId?: string;
  name: string;
  position?: string;
  teamId?: string;
  teamTricode?: string;
  status?: string;
  isNewAddition?: boolean;
  id?: number;
  first_name?: string;
  last_name?: string;
  jersey_number?: string;
  height?: string;
  weight?: string;
  team_abbr?: string;
  team_bdl_id?: number;
}

export interface OverridesConfig {
  teams: Record<string, TeamOverride>;
  players: Record<string, PlayerOverride>;
  injuries: InjuryOverride[];
  coaches: CoachOverride[];
}

export interface TeamOverride {
  roster_add?: Array<string | PlayerOverride>;
  roster_drop?: string[];
  notes?: string[];
  coach?: CoachOverride;
}

export interface PlayerOverride {
  name?: string;
  team?: string;
  teamId?: string;
  position?: string;
  status?: string;
}

export interface InjuryOverride extends InjuryRecord {
  team?: string;
}

export interface CoachOverride extends CoachRecord {
  team?: string;
}

export interface CanonicalData {
  teams: TeamRecord[];
  players: PlayerRecord[];
  transactions: TransactionRecord[];
  coaches: CoachRecordEntry[];
  injuries: InjuryRecord[];
}

export interface CoachRecordEntry extends CoachRecord {
  teamTricode: string;
}

export interface LeagueContext {
  season: string;
  teams: TeamRecord[];
  players: PlayerRecord[];
  injuries: InjuryRecord[];
  rankings: RankedTeam[];
  playerScoring: PlayerScoringIndex;
}

export interface RankedTeam {
  tricode: string;
  score: number;
  rank: number;
  statusLine: string;
}
