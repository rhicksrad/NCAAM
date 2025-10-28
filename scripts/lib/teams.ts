export interface TeamMetadata {
  teamId: string;
  tricode: string;
  market: string;
  name: string;
  lastSeasonWins: number;
  lastSeasonSRS: number;
}

export const TEAM_METADATA: TeamMetadata[] = [
  { teamId: "1610612737", tricode: "ATL", market: "Atlanta", name: "Hawks", lastSeasonWins: 36, lastSeasonSRS: -0.8 },
  { teamId: "1610612738", tricode: "BOS", market: "Boston", name: "Celtics", lastSeasonWins: 64, lastSeasonSRS: 10.7 },
  { teamId: "1610612751", tricode: "BKN", market: "Brooklyn", name: "Nets", lastSeasonWins: 32, lastSeasonSRS: -2.7 },
  { teamId: "1610612766", tricode: "CHA", market: "Charlotte", name: "Hornets", lastSeasonWins: 21, lastSeasonSRS: -7.6 },
  { teamId: "1610612741", tricode: "CHI", market: "Chicago", name: "Bulls", lastSeasonWins: 39, lastSeasonSRS: -0.4 },
  { teamId: "1610612739", tricode: "CLE", market: "Cleveland", name: "Cavaliers", lastSeasonWins: 48, lastSeasonSRS: 3.5 },
  { teamId: "1610612742", tricode: "DAL", market: "Dallas", name: "Mavericks", lastSeasonWins: 50, lastSeasonSRS: 3.7 },
  { teamId: "1610612743", tricode: "DEN", market: "Denver", name: "Nuggets", lastSeasonWins: 57, lastSeasonSRS: 5.4 },
  { teamId: "1610612765", tricode: "DET", market: "Detroit", name: "Pistons", lastSeasonWins: 14, lastSeasonSRS: -9.3 },
  { teamId: "1610612744", tricode: "GSW", market: "Golden State", name: "Warriors", lastSeasonWins: 46, lastSeasonSRS: 1.7 },
  { teamId: "1610612745", tricode: "HOU", market: "Houston", name: "Rockets", lastSeasonWins: 41, lastSeasonSRS: 1.4 },
  { teamId: "1610612754", tricode: "IND", market: "Indiana", name: "Pacers", lastSeasonWins: 47, lastSeasonSRS: 3.2 },
  { teamId: "1610612746", tricode: "LAC", market: "Los Angeles", name: "Clippers", lastSeasonWins: 51, lastSeasonSRS: 4.5 },
  { teamId: "1610612747", tricode: "LAL", market: "Los Angeles", name: "Lakers", lastSeasonWins: 47, lastSeasonSRS: 1.7 },
  { teamId: "1610612763", tricode: "MEM", market: "Memphis", name: "Grizzlies", lastSeasonWins: 27, lastSeasonSRS: -4.9 },
  { teamId: "1610612748", tricode: "MIA", market: "Miami", name: "Heat", lastSeasonWins: 46, lastSeasonSRS: 1.5 },
  { teamId: "1610612749", tricode: "MIL", market: "Milwaukee", name: "Bucks", lastSeasonWins: 49, lastSeasonSRS: 3.0 },
  { teamId: "1610612750", tricode: "MIN", market: "Minnesota", name: "Timberwolves", lastSeasonWins: 56, lastSeasonSRS: 6.0 },
  { teamId: "1610612740", tricode: "NOP", market: "New Orleans", name: "Pelicans", lastSeasonWins: 49, lastSeasonSRS: 4.6 },
  { teamId: "1610612752", tricode: "NYK", market: "New York", name: "Knicks", lastSeasonWins: 50, lastSeasonSRS: 5.6 },
  { teamId: "1610612760", tricode: "OKC", market: "Oklahoma City", name: "Thunder", lastSeasonWins: 57, lastSeasonSRS: 6.3 },
  { teamId: "1610612753", tricode: "ORL", market: "Orlando", name: "Magic", lastSeasonWins: 47, lastSeasonSRS: 2.4 },
  { teamId: "1610612755", tricode: "PHI", market: "Philadelphia", name: "76ers", lastSeasonWins: 47, lastSeasonSRS: 4.1 },
  { teamId: "1610612756", tricode: "PHX", market: "Phoenix", name: "Suns", lastSeasonWins: 49, lastSeasonSRS: 2.4 },
  { teamId: "1610612757", tricode: "POR", market: "Portland", name: "Trail Blazers", lastSeasonWins: 21, lastSeasonSRS: -7.4 },
  { teamId: "1610612758", tricode: "SAC", market: "Sacramento", name: "Kings", lastSeasonWins: 48, lastSeasonSRS: 3.0 },
  { teamId: "1610612759", tricode: "SAS", market: "San Antonio", name: "Spurs", lastSeasonWins: 22, lastSeasonSRS: -8.0 },
  { teamId: "1610612761", tricode: "TOR", market: "Toronto", name: "Raptors", lastSeasonWins: 25, lastSeasonSRS: -5.6 },
  { teamId: "1610612762", tricode: "UTA", market: "Utah", name: "Jazz", lastSeasonWins: 31, lastSeasonSRS: -4.4 },
  { teamId: "1610612764", tricode: "WAS", market: "Washington", name: "Wizards", lastSeasonWins: 15, lastSeasonSRS: -8.8 }
];

export const TEAM_ID_TO_TRICODE = new Map(TEAM_METADATA.map((team) => [team.teamId, team.tricode]));
export const TRICODE_TO_TEAM = new Map(TEAM_METADATA.map((team) => [team.tricode, team]));

export function ensureTeamMetadata(tricode: string): TeamMetadata {
  const record = TRICODE_TO_TEAM.get(tricode);
  if (!record) {
    throw new Error(`Unknown team tricode: ${tricode}`);
  }
  return record;
}
