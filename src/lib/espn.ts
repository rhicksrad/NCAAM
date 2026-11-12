// ESPN's public JSON feeds, normalised into the few shapes this site needs.
// No key, no proxy: the endpoints answer with `Access-Control-Allow-Origin: *`.
// Everything is parsed defensively because the feed is undocumented.

const SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball";
const STANDINGS = "https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/standings";

export const ESPN_URLS = {
  scoreboard: (ymd?: string) => `${SITE}/scoreboard?groups=50&limit=400${ymd ? `&dates=${ymd}` : ""}`,
  rankings: () => `${SITE}/rankings`,
  teams: () => `${SITE}/teams?limit=500&groups=50`,
  team: (id: string) => `${SITE}/teams/${id}`,
  roster: (id: string) => `${SITE}/teams/${id}/roster`,
  schedule: (id: string) => `${SITE}/teams/${id}/schedule`,
  summary: (id: string) => `${SITE}/summary?event=${id}`,
  news: () => `${SITE}/news?limit=12`,
  standings: (season?: number) => `${STANDINGS}${season ? `?season=${season}` : ""}`,
};

type J = Record<string, any>;

export type Team = {
  id: string;
  /** School name: "Duke" */
  name: string;
  /** Mascot: "Blue Devils" */
  mascot: string;
  abbr: string;
  /** Short display name: "Duke", "Mich St" */
  short: string;
  /** Primary colour as #rrggbb, or "" */
  color: string;
  alt: string;
};

export type Side = {
  team: Team;
  score: number | null;
  winner: boolean;
  rank: number | null;
  record: string;
  lines: number[];
};

export type GameState = "pre" | "in" | "post";

export type Game = {
  id: string;
  date: string;
  state: GameState;
  /** "Final", "Final/OT", "12:44 - 2nd Half", "11/12 - 7:00 PM EST" */
  detail: string;
  clock: string;
  period: number;
  neutral: boolean;
  confGame: boolean;
  venue: string;
  city: string;
  tv: string;
  note: string;
  odds: string;
  home: Side;
  away: Side;
};

export type RankRow = {
  rank: number;
  prev: number;
  points: number;
  firstPlace: number;
  record: string;
  team: Team;
};

export type Poll = {
  id: string;
  name: string;
  short: string;
  week: string;
  updated: string;
  ranks: RankRow[];
  others: Array<{ team: Team; points: number }>;
  dropped: Team[];
};

export type StandingRow = {
  team: Team;
  overall: string;
  conf: string;
  confPct: number;
  pct: number;
  home: string;
  away: string;
  streak: string;
  ppg: number | null;
  oppg: number | null;
};

export type Conference = { id: string; name: string; abbr: string; rows: StandingRow[] };

export type NewsItem = { headline: string; url: string; published: string };

export type RosterPlayer = {
  id: string;
  name: string;
  jersey: string;
  pos: string;
  height: string;
  weight: string;
  year: string;
  from: string;
};

export type ScheduleGame = {
  id: string;
  date: string;
  state: GameState;
  detail: string;
  home: boolean;
  neutral: boolean;
  opponent: Team;
  oppRank: number | null;
  us: number | null;
  them: number | null;
  won: boolean | null;
  tv: string;
};

export type TeamDetail = {
  team: Team;
  record: string;
  standing: string;
  rank: number | null;
  confId: string;
  venue: string;
};

export type BoxPlayer = { id: string; name: string; pos: string; jersey: string; starter: boolean; dnp: boolean; stats: string[] };
export type BoxTeam = {
  teamId: string;
  labels: string[];
  players: BoxPlayer[];
  totals: string[];
  /** Team totals keyed by ESPN stat name ("fieldGoalPct", "totalRebounds"...) */
  stats: Record<string, { label: string; value: string }>;
};

export type Play = {
  id: string;
  period: number;
  clock: string;
  text: string;
  home: number;
  away: number;
  scoring: boolean;
  teamId: string;
  /** Seconds elapsed since tip, for the game-flow chart. */
  t: number;
};

export type GameDetail = {
  game: Game;
  box: BoxTeam[];
  plays: Play[];
  /** Home win probability 0-1, one per play when ESPN supplies it. */
  winProb: number[];
  attendance: number | null;
  officials: string[];
  /** Length of a regulation period in seconds (1200 for halves). */
  periodSeconds: number;
};

const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
/** Arrays of objects only: a null or a stray number in a feed must not throw. */
const arr = (v: unknown): J[] => (Array.isArray(v) ? (v as unknown[]).filter((x): x is J => typeof x === "object" && x !== null) : []);
const hex = (v: unknown): string => (typeof v === "string" && /^[0-9a-f]{6}$/i.test(v) ? `#${v.toLowerCase()}` : "");

export function toTeam(raw: J | null | undefined): Team {
  const t = raw ?? {};
  const name = str(t.location) || str(t.shortDisplayName) || str(t.displayName) || str(t.name) || "TBD";
  return {
    id: str(t.id),
    name,
    mascot: str(t.name) && str(t.name) !== name ? str(t.name) : "",
    abbr: str(t.abbreviation) || name.slice(0, 4).toUpperCase(),
    short: str(t.shortDisplayName) || name,
    color: hex(t.color),
    alt: hex(t.alternateColor),
  };
}

function toRank(raw: unknown): number | null {
  const n = num(typeof raw === "object" && raw ? (raw as J).current : raw);
  return n !== null && n >= 1 && n <= 25 ? n : null;
}

function recordOf(records: unknown, want = "total"): string {
  const list = arr(records);
  const hit = list.find((r) => r.type === want || str(r.name).toLowerCase() === want) ?? (want === "total" ? list[0] : undefined);
  return str(hit?.summary) || str(hit?.displayValue);
}

function toSide(c: J | undefined): Side {
  const scoreRaw = c?.score;
  const score = typeof scoreRaw === "object" && scoreRaw ? num(scoreRaw.value ?? scoreRaw.displayValue) : num(scoreRaw);
  return {
    team: toTeam(c?.team),
    score,
    winner: c?.winner === true,
    rank: toRank(c?.curatedRank ?? c?.rank),
    record: recordOf(c?.records ?? c?.record),
    lines: arr(c?.linescores).map((l) => num(l.value ?? l.displayValue) ?? 0),
  };
}

function toState(status: J | undefined): GameState {
  const s = str(status?.type?.state);
  return s === "in" || s === "post" ? s : "pre";
}

function toGame(event: J, comp: J): Game {
  const competitors = arr(comp.competitors);
  const home = competitors.find((c) => c.homeAway === "home") ?? competitors[0];
  const away = competitors.find((c) => c.homeAway === "away") ?? competitors[1];
  const status = (comp.status ?? event.status ?? {}) as J;
  const state = toState(status);
  const address = comp.venue?.address ?? {};
  const broadcasts = arr(comp.broadcasts);
  const tv = broadcasts
    .flatMap((b) => (Array.isArray(b.names) ? b.names : [b.media?.shortName]))
    .filter(Boolean)
    .join(", ");
  const odds = arr(comp.odds)[0];
  const sideHome = toSide(home);
  const sideAway = toSide(away);
  if (state === "pre") {
    sideHome.score = null;
    sideAway.score = null;
  }
  return {
    id: str(event.id ?? comp.id),
    date: str(comp.date ?? event.date),
    state,
    detail: str(status.type?.shortDetail) || str(status.type?.detail) || str(status.type?.description),
    clock: str(status.displayClock),
    period: num(status.period) ?? 0,
    neutral: comp.neutralSite === true,
    confGame: comp.conferenceCompetition === true,
    venue: str(comp.venue?.fullName),
    city: [str(address.city), str(address.state)].filter(Boolean).join(", "),
    tv,
    note: str(arr(comp.notes)[0]?.headline),
    odds: state === "pre" && odds ? str(odds.details) : "",
    home: sideHome,
    away: sideAway,
  };
}

export function normalizeScoreboard(json: J): Game[] {
  return arr(json?.events)
    .map((event) => {
      const comp = arr(event.competitions)[0];
      return comp ? toGame(event, comp) : null;
    })
    .filter((g): g is Game => g !== null && g.id !== "");
}

/** The calendar days ESPN has games on, as YYYYMMDD, when the feed lists them. */
export function scoreboardDay(json: J): string {
  const day = str(json?.day?.date).replace(/-/g, "");
  if (/^\d{8}$/.test(day)) return day;
  // The college feed often omits `day`; fall back to the Eastern date of the slate.
  const at = Date.parse(str(json?.eventsDate?.date));
  if (!Number.isFinite(at)) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(at).replace(/-/g, "");
}

export function normalizeRankings(json: J): Poll[] {
  return arr(json?.rankings).map((r) => ({
    id: str(r.type) || str(r.id),
    name: str(r.name),
    short: str(r.shortName) || str(r.name),
    week: str(r.occurrence?.displayValue) || str(r.shortHeadline) || str(r.headline),
    updated: str(r.date ?? r.lastUpdated),
    ranks: arr(r.ranks)
      .map((row) => ({
        rank: num(row.current) ?? 0,
        prev: num(row.previous) ?? 0,
        points: num(row.points) ?? 0,
        firstPlace: num(row.firstPlaceVotes) ?? 0,
        record: str(row.recordSummary),
        team: toTeam(row.team),
      }))
      .filter((row) => row.rank > 0)
      .sort((a, b) => a.rank - b.rank),
    others: arr(r.others)
      .map((row) => ({ team: toTeam(row.team), points: num(row.points) ?? 0 }))
      .sort((a, b) => b.points - a.points),
    dropped: arr(r.droppedOut).map((row) => toTeam(row.team)),
  }));
}

function statMap(stats: unknown): Map<string, J> {
  const map = new Map<string, J>();
  for (const s of arr(stats)) {
    for (const key of [s.type, s.name, s.abbreviation]) {
      const k = str(key).toLowerCase();
      if (k && !map.has(k)) map.set(k, s);
    }
  }
  return map;
}

export function normalizeStandings(json: J): Conference[] {
  const groups: J[] = [];
  const walk = (node: J) => {
    if (node?.standings?.entries) groups.push(node);
    for (const child of arr(node?.children)) walk(child);
  };
  walk(json ?? {});
  return groups
    .map((g) => {
      const rows: StandingRow[] = arr(g.standings.entries).map((entry) => {
        const s = statMap(entry.stats);
        const get = (...keys: string[]): J | undefined => {
          for (const k of keys) {
            const hit = s.get(k);
            if (hit) return hit;
          }
          return undefined;
        };
        const disp = (...keys: string[]) => {
          const hit = get(...keys);
          return str(hit?.summary) || str(hit?.displayValue);
        };
        const val = (...keys: string[]) => num(get(...keys)?.value);
        const conf = disp("vsconf", "vs. conf.", "conf");
        const [cw, cl] = conf.split("-").map(Number);
        const overall = disp("total", "overall") || `${val("wins") ?? 0}-${val("losses") ?? 0}`;
        const [w, l] = overall.split("-").map(Number);
        return {
          team: toTeam(entry.team),
          overall,
          conf,
          confPct: val("leaguewinpercent") ?? (cw || cl ? (cw ?? 0) / ((cw ?? 0) + (cl ?? 0)) : 0),
          pct: val("winpercent") ?? (w || l ? (w ?? 0) / ((w ?? 0) + (l ?? 0)) : 0),
          home: disp("home"),
          away: disp("road", "away"),
          streak: disp("streak", "strk"),
          ppg: val("avgpointsfor"),
          oppg: val("avgpointsagainst"),
        };
      });
      rows.sort((a, b) => b.confPct - a.confPct || b.pct - a.pct || a.team.name.localeCompare(b.team.name));
      return { id: str(g.id), name: str(g.name), abbr: str(g.abbreviation).toUpperCase() || str(g.shortName), rows };
    })
    .filter((c) => c.rows.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function normalizeTeams(json: J): Team[] {
  const leagues = arr(arr(json?.sports)[0]?.leagues);
  return arr(leagues[0]?.teams)
    .map((entry) => toTeam(entry.team ?? entry))
    .filter((t) => t.id !== "")
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function normalizeNews(json: J): NewsItem[] {
  // Reported stories first; the wire's automated game previews fill the rest.
  const weight = (a: J) => (str(a.type) === "Preview" ? 1 : 0);
  return arr(json?.articles)
    .slice()
    .sort((a, b) => weight(a) - weight(b))
    .map((a) => ({
      headline: str(a.headline),
      url: str(a.links?.web?.href).replace(/^http:\/\//, "https://"),
      published: str(a.published),
    }))
    .filter((a) => a.headline && /^https:\/\/([a-z0-9-]+\.)*espn\.com\//.test(a.url));
}

export function normalizeTeam(json: J): TeamDetail {
  const t = (json?.team ?? {}) as J;
  const venue = t.franchise?.venue ?? t.venue ?? {};
  return {
    team: toTeam(t),
    record: recordOf(t.record?.items),
    standing: str(t.standingSummary),
    rank: toRank(t.rank),
    confId: str(t.groups?.id),
    venue: str(venue.fullName),
  };
}

export function normalizeRoster(json: J): RosterPlayer[] {
  const flat = arr(json?.athletes).flatMap((a) => (Array.isArray(a.items) ? (a.items as J[]) : [a]));
  return flat
    .map((a) => ({
      id: str(a.id),
      name: str(a.displayName) || str(a.fullName),
      jersey: str(a.jersey),
      pos: str(a.position?.abbreviation),
      height: str(a.displayHeight),
      weight: str(a.displayWeight).replace(/\s*lbs?$/, ""),
      year: str(a.experience?.displayValue),
      from: [str(a.birthPlace?.city), str(a.birthPlace?.state) || str(a.birthPlace?.country)].filter(Boolean).join(", "),
    }))
    .filter((p) => p.name)
    .sort((a, b) => (num(a.jersey) ?? 999) - (num(b.jersey) ?? 999));
}

export function normalizeSchedule(json: J, teamId: string): ScheduleGame[] {
  return arr(json?.events)
    .map((event) => {
      const comp = arr(event.competitions)[0] ?? {};
      const competitors = arr(comp.competitors);
      const us = competitors.find((c) => str(c.id) === teamId || str(c.team?.id) === teamId);
      const them = competitors.find((c) => c !== us);
      const usSide = toSide(us);
      const themSide = toSide(them);
      const state = toState(comp.status);
      const done = state === "post" && usSide.score !== null && themSide.score !== null;
      return {
        id: str(event.id),
        date: str(event.date ?? comp.date),
        state,
        detail: str(comp.status?.type?.shortDetail),
        home: us?.homeAway === "home",
        neutral: comp.neutralSite === true,
        opponent: themSide.team,
        oppRank: themSide.rank,
        us: state === "pre" ? null : usSide.score,
        them: state === "pre" ? null : themSide.score,
        won: done ? (us?.winner === true ? true : them?.winner === true ? false : (usSide.score ?? 0) > (themSide.score ?? 0)) : null,
        tv: arr(comp.broadcasts)
          .map((b) => str(b.media?.shortName) || str(arr(b.names)[0]))
          .filter(Boolean)
          .join(", "),
      };
    })
    .filter((g) => g.id && g.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function clockSeconds(display: string): number {
  const [m, s] = display.split(":");
  if (s === undefined) return num(m) ?? 0;
  return (num(m) ?? 0) * 60 + (num(s) ?? 0);
}

export function normalizeSummary(json: J): GameDetail | null {
  const comp = arr(json?.header?.competitions)[0];
  if (!comp) return null;
  const game = toGame({ id: json.header.id, date: comp.date, status: comp.status }, comp);
  const info = (json.gameInfo ?? {}) as J;
  if (!game.venue) game.venue = str(info.venue?.fullName);
  if (!game.city) {
    const a = info.venue?.address ?? {};
    game.city = [str(a.city), str(a.state)].filter(Boolean).join(", ");
  }

  const teamStats = new Map<string, BoxTeam["stats"]>();
  for (const t of arr(json.boxscore?.teams)) {
    const stats: BoxTeam["stats"] = {};
    for (const s of arr(t.statistics)) {
      if (s.name) stats[str(s.name)] = { label: str(s.label) || str(s.abbreviation), value: str(s.displayValue) };
    }
    teamStats.set(str(t.team?.id), stats);
  }
  const box: BoxTeam[] = arr(json.boxscore?.players).map((group) => {
    const block = arr(group.statistics)[0] ?? {};
    const teamId = str(group.team?.id);
    return {
      teamId,
      labels: (Array.isArray(block.labels) ? block.labels : Array.isArray(block.names) ? block.names : []).map(str),
      players: arr(block.athletes).map((a) => ({
        id: str(a.athlete?.id),
        name: str(a.athlete?.displayName) || str(a.athlete?.shortName),
        pos: str(a.athlete?.position?.abbreviation),
        jersey: str(a.athlete?.jersey),
        starter: a.starter === true,
        dnp: a.didNotPlay === true || !Array.isArray(a.stats) || a.stats.length === 0,
        stats: (Array.isArray(a.stats) ? a.stats : []).map(str),
      })),
      totals: (Array.isArray(block.totals) ? block.totals : []).map(str),
      stats: teamStats.get(teamId) ?? {},
    };
  });
  for (const [teamId, stats] of teamStats) {
    if (!box.some((b) => b.teamId === teamId)) box.push({ teamId, labels: [], players: [], totals: [], stats });
  }

  // College games are two 20-minute halves (women's and NBA feeds use quarters;
  // infer from the feed rather than assume).
  const rawPlays = arr(json.plays);
  const maxClock = rawPlays.reduce((m, p) => Math.max(m, clockSeconds(str(p.clock?.displayValue))), 0);
  const periodSeconds = maxClock > 12 * 60 ? 1200 : maxClock > 10 * 60 ? 720 : maxClock > 0 ? 600 : 1200;
  const regulation = periodSeconds === 1200 ? 2 : 4;
  const plays: Play[] = rawPlays.map((p, i) => {
    const period = num(p.period?.number) ?? 1;
    const clock = str(p.clock?.displayValue);
    const before = period <= regulation ? (period - 1) * periodSeconds : regulation * periodSeconds + (period - regulation - 1) * 300;
    const length = period <= regulation ? periodSeconds : 300;
    return {
      id: str(p.id) || String(i),
      period,
      clock,
      text: str(p.text),
      home: num(p.homeScore) ?? 0,
      away: num(p.awayScore) ?? 0,
      scoring: p.scoringPlay === true,
      teamId: str(p.team?.id),
      t: before + Math.max(0, length - clockSeconds(clock)),
    };
  });

  return {
    game,
    box,
    plays,
    winProb: arr(json.winprobability)
      .map((w) => num(w.homeWinPercentage))
      .filter((w): w is number => w !== null),
    attendance: num(info.attendance),
    officials: arr(info.officials).map((o) => str(o.displayName) || str(o.fullName)).filter(Boolean),
    periodSeconds,
  };
}

async function getJson(url: string, signal?: AbortSignal): Promise<J> {
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`ESPN answered ${res.status}`);
  return (await res.json()) as J;
}

export const espn = {
  scoreboard: async (ymd?: string) => normalizeScoreboard(await getJson(ESPN_URLS.scoreboard(ymd))),
  rankings: async () => normalizeRankings(await getJson(ESPN_URLS.rankings())),
  standings: async (season?: number) => normalizeStandings(await getJson(ESPN_URLS.standings(season))),
  teams: async () => normalizeTeams(await getJson(ESPN_URLS.teams())),
  news: async () => normalizeNews(await getJson(ESPN_URLS.news())),
  team: async (id: string) => normalizeTeam(await getJson(ESPN_URLS.team(id))),
  roster: async (id: string) => normalizeRoster(await getJson(ESPN_URLS.roster(id))),
  schedule: async (id: string) => normalizeSchedule(await getJson(ESPN_URLS.schedule(id)), id),
  summary: async (id: string) => normalizeSummary(await getJson(ESPN_URLS.summary(id))),
};
