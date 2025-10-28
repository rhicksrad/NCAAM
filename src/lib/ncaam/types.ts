export interface Team {
  id: string;
  name: string;
  shortName: string;
  conference?: string;
  logo?: string;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  position?: string;
  teamId?: string;
  classYear?: string;
  eligibility?: string;
  height?: string;
  weight?: string;
}

export interface Game {
  id: string;
  date: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore?: number;
  awayScore?: number;
  status?: string;
  neutralSite?: boolean;
}

export interface StandingsRow {
  teamId: string;
  wins: number;
  losses: number;
  confWins?: number;
  confLosses?: number;
}

export interface RankingsRow {
  rank: number;
  teamId: string;
  poll: 'AP' | 'Coaches' | 'NET' | string;
  week?: number;
}

export interface Paged<T> {
  data: T[];
  nextPage?: number;
}
