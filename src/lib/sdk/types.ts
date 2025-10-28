export interface Team {
  id: string;
  name: string;
  displayName: string;
  shortName: string;
  abbreviation: string;
  conferenceId?: number;
  conference?: string;
  logo?: string;
  record?: {
    overall?: string;
    conference?: string;
  };
}

export interface GameTeam {
  team: Team;
  score?: number;
  record?: string;
}

export type GameStage = 'pre' | 'live' | 'final' | 'postponed' | 'canceled' | 'unknown';

export interface Game {
  id: string;
  dateUTC: string;
  tipLocal: string;
  tipLabel: string;
  stage: GameStage;
  status: string;
  home: GameTeam;
  away: GameTeam;
  neutralSite?: boolean;
}

export interface PollEntry {
  rank: number;
  team: Team;
  record?: string;
  firstPlaceVotes?: number;
  points?: number;
}

export interface Poll {
  poll: string;
  displayName: string;
  season: number;
  week?: number;
  entries: PollEntry[];
  fetchedAt: string;
}

export interface StandingRow {
  team: Team;
  wins: number;
  losses: number;
  conferenceWins?: number;
  conferenceLosses?: number;
}

export interface StandingGroup {
  conferenceId: number;
  conferenceName: string;
  rows: StandingRow[];
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  position?: string;
  height?: string;
  weight?: string;
  classYear?: string;
  teamId?: string;
  teamName?: string;
}
