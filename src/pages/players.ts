import { buildScales, drawAxes } from "../lib/charts/axes.js";
import { computeInnerSize, createSVG } from "../lib/charts/frame.js";
import { renderBars, type BarDatum } from "../lib/charts/series/bar.js";
import { defaultTheme, formatNumber } from "../lib/charts/theme.js";

const app = document.getElementById("app");
if (!app) {
  throw new Error("Players page requires an #app container");
}

app.innerHTML = `
  <div class="stack" data-gap="xl">
    <section class="stack" data-gap="md">
      <div class="card stack player-section" data-gap="xs">
        <span class="eyebrow">Feature 01</span>
        <h2 class="player-section__title">Top 10 leaders by category</h2>
        <p id="leaderboard-intro" class="player-section__meta">Pulling the latest top performers across the stat sheet.</p>
      </div>
      <div id="leaderboard-grid" class="leaderboard-grid" aria-live="polite"></div>
    </section>
    <section class="stack" data-gap="md">
      <div class="card stack player-section" data-gap="xs">
        <span class="eyebrow">Feature 02</span>
        <h2 class="player-section__title">Conference rosters with per-game stats</h2>
        <p id="conference-intro" class="player-section__meta">Explore every conference, team, and player at a glance.</p>
      </div>
      <div id="conference-directory" class="conference-directory" aria-live="polite"></div>
    </section>
  </div>
`;

const leaderboardGrid = document.getElementById("leaderboard-grid") as HTMLElement | null;
const leaderboardIntro = document.getElementById("leaderboard-intro") as HTMLElement | null;
const conferenceDirectory = document.getElementById("conference-directory") as HTMLElement | null;
const conferenceIntro = document.getElementById("conference-intro") as HTMLElement | null;

const dataUrl = (path: string) => new URL(path, import.meta.url).toString();

const METRIC_ORDER = [
  "points",
  "rebounds",
  "assists",
  "stocks",
  "fgPct",
  "fg3Pct",
  "ftPct",
  "mp",
  "turnovers",
] as const;

type LeaderboardMetricId = (typeof METRIC_ORDER)[number];

type PlayerLeaderboardEntry = {
  name: string;
  team: string;
  slug: string;
  url?: string;
  games?: number | null;
  value: number;
  valueFormatted?: string;
};

type PlayerLeaderboardMetric = {
  label: string;
  shortLabel: string;
  leaders: PlayerLeaderboardEntry[];
};

type PlayerLeaderboardDocument = {
  season: string;
  seasonYear?: number | null;
  generatedAt: string;
  metrics: Record<string, PlayerLeaderboardMetric | undefined>;
};

type PlayerIndexEntry = {
  name: string;
  team: string;
  season: string;
  slug: string;
  url?: string;
  season_year?: number;
  name_key?: string;
  team_key?: string;
  conference?: string;
};

type PlayerIndexDocument = {
  seasons?: string[];
  players?: PlayerIndexEntry[];
};

type PlayerStatsSeason = {
  season: string;
  team: string;
  conf: string;
  gp: number | null;
  gs: number | null;
  mp_g: number | null;
  fg_pct: number | null;
  fg3_pct: number | null;
  ft_pct: number | null;
  orb_g: number | null;
  drb_g: number | null;
  trb_g: number | null;
  ast_g: number | null;
  stl_g: number | null;
  blk_g: number | null;
  tov_g: number | null;
  pf_g: number | null;
  pts_g: number | null;
};

type PlayerStatsDocument = {
  slug: string;
  name: string;
  seasons: PlayerStatsSeason[];
  source: string;
  last_scraped: string;
};

type ConferenceGroup = {
  name: string;
  teams: Map<string, PlayerIndexEntry[]>;
  totalPlayers: number;
};

type RosterPlayer = {
  entry: PlayerIndexEntry;
  stats: PlayerStatsSeason | null;
};

const leaderboardSkeleton = document.createElement("div");
leaderboardSkeleton.className = "card leaderboard-card leaderboard-card--loading";
leaderboardSkeleton.innerHTML = `<div class="leaderboard-card__loading">Loading leaderboards…</div>`;

if (leaderboardGrid) {
  leaderboardGrid.appendChild(leaderboardSkeleton);
}

async function loadJSON<T>(path: string): Promise<T> {
  const url = dataUrl(path);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${path} (${res.status})`);
  }
  return (await res.json()) as T;
}

function formatDecimal(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  const formatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return formatter.format(value);
}

function formatInteger(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return Math.round(value).toLocaleString();
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return `${formatDecimal(value * 100, 1)}%`;
}

function createLeaderboardCard(
  metricId: LeaderboardMetricId | string,
  metric: PlayerLeaderboardMetric,
  seasonLabel: string,
): HTMLElement {
  const card = document.createElement("article");
  card.className = "card leaderboard-card";
  const chartId = `leaderboard-chart-${metricId}`;
  const description = `${metric.label} top 10 for ${seasonLabel}`;
  card.innerHTML = `
    <div class="leaderboard-card__head">
      <div class="leaderboard-card__labels">
        <p class="leaderboard-card__kicker">${metric.label}</p>
        <h3 class="leaderboard-card__title">${metric.shortLabel} leaders</h3>
      </div>
      <span class="leaderboard-card__season">${seasonLabel}</span>
    </div>
    <div id="${chartId}" class="leaderboard-card__chart" role="img" aria-label="${description}"></div>
    <ol class="leaderboard-card__list"></ol>
  `;

  const chartHost = card.querySelector(`#${CSS.escape(chartId)}`) as HTMLElement | null;
  const list = card.querySelector("ol.leaderboard-card__list") as HTMLOListElement | null;
  const leaders = (metric.leaders ?? []).slice(0, 10);

  if (chartHost) {
    renderLeaderboardChart(chartHost, metric, seasonLabel);
  }

  if (list) {
    list.innerHTML = "";
    leaders.forEach((leader, index) => {
      const item = document.createElement("li");
      item.className = "leaderboard-card__list-item";
      item.innerHTML = `
        <span class="leaderboard-card__rank">${index + 1}</span>
        <div class="leaderboard-card__player">
          <span class="leaderboard-card__name">${leader.name}</span>
          <span class="leaderboard-card__team">${leader.team}</span>
        </div>
        <span class="leaderboard-card__value" aria-label="${metric.shortLabel} per game">${
          leader.valueFormatted ?? formatNumber(leader.value)
        }</span>
      `;
      list.appendChild(item);
    });
  }

  return card;
}

function renderLeaderboardChart(
  container: HTMLElement,
  metric: PlayerLeaderboardMetric,
  seasonLabel: string,
): void {
  const leaders = (metric.leaders ?? []).slice(0, 10);
  if (!leaders.length) {
    container.innerHTML = `<p class="leaderboard-card__empty">No leaders available.</p>`;
    return;
  }

  const width = 720;
  const height = 360;
  const margin = { top: 24, right: 16, bottom: 48, left: 48 };
  const { iw, ih } = computeInnerSize(width, height, margin);
  const svg = createSVG(container, width, height, {
    title: `${metric.label} leaders`,
    description: `Top 10 ${metric.label.toLowerCase()} for ${seasonLabel}`,
  });
  const plot = svg.ownerDocument.createElementNS(svg.namespaceURI, "g") as SVGGElement;
  plot.setAttribute("transform", `translate(${margin.left},${margin.top})`);
  svg.appendChild(plot);

  const data: BarDatum[] = leaders.map((leader, index) => ({
    x: index + 1,
    y: leader.value,
  }));

  const scales = buildScales({
    x: {
      type: "band",
      domain: data.map((d) => d.x),
      range: [0, iw],
      paddingInner: 0.4,
      paddingOuter: 0.2,
    },
    y: {
      type: "linear",
      domain: [0, Math.max(...data.map((d) => d.y)) * 1.05],
      range: [ih, 0],
      nice: true,
      clamp: true,
    },
  });

  drawAxes(plot, scales, {
    innerWidth: iw,
    innerHeight: ih,
    xLabel: "Rank",
    yLabel: metric.shortLabel,
    tickCount: { x: 10, y: 5 },
    theme: defaultTheme,
    format: {
      x: (value) => `#${value}`,
      y: (value) => formatNumber(Number(value)),
    },
  });

  const seriesGroup = svg.ownerDocument.createElementNS(svg.namespaceURI, "g") as SVGGElement;
  plot.appendChild(seriesGroup);
  renderBars(seriesGroup, data, scales, {
    innerHeight: ih,
    theme: defaultTheme,
    gap: 8,
    cornerRadius: 4,
  });
}

async function renderLeaderboards(): Promise<void> {
  if (!leaderboardGrid) return;

  try {
    const doc = await loadJSON<PlayerLeaderboardDocument>("../../data/player_stat_leaders_2024-25.json");
    const metrics = doc.metrics ?? {};
    const availableIds = METRIC_ORDER.filter((id) => metrics[id]);
    const extraIds = Object.keys(metrics).filter(
      (id): id is LeaderboardMetricId | string => !METRIC_ORDER.includes(id as LeaderboardMetricId),
    );

    const seasonLabel = doc.season ?? `${doc.seasonYear ?? "Season"}`;
    if (leaderboardIntro) {
      const updated = new Date(doc.generatedAt);
      const updatedText = Number.isNaN(updated.valueOf()) ? "recent updates" : updated.toLocaleDateString();
      leaderboardIntro.textContent = `Top performers for ${seasonLabel}. Updated ${updatedText}.`;
    }

    leaderboardGrid.innerHTML = "";

    const orderedMetrics = [...availableIds, ...extraIds];
    if (!orderedMetrics.length) {
      leaderboardGrid.innerHTML = `<p class="card leaderboard-card__empty">No leaderboard data available right now.</p>`;
      return;
    }

    orderedMetrics.forEach((id) => {
      const metric = metrics[id];
      if (!metric) return;
      leaderboardGrid.appendChild(createLeaderboardCard(id, metric, seasonLabel));
    });
  } catch (error) {
    console.error(error);
    leaderboardGrid.innerHTML = `<p class="card leaderboard-card__error">Unable to load leaderboards. Please try refreshing the page.</p>`;
  }
}

const playerDocumentCache = new Map<string, Promise<PlayerStatsDocument>>();

function loadPlayerDocument(slug: string): Promise<PlayerStatsDocument> {
  if (!playerDocumentCache.has(slug)) {
    const promise = loadJSON<PlayerStatsDocument>(`../../data/players/${slug}.json`).catch((error) => {
      playerDocumentCache.delete(slug);
      throw error;
    });
    playerDocumentCache.set(slug, promise);
  }
  return playerDocumentCache.get(slug)!;
}

function pickSeasonStats(document: PlayerStatsDocument, season: string): PlayerStatsSeason | null {
  const seasons = document.seasons ?? [];
  const exact = seasons.find((s) => s.season === season);
  if (exact) return exact;
  return seasons.length ? seasons[seasons.length - 1] : null;
}

async function resolveRosterPlayers(entries: PlayerIndexEntry[]): Promise<RosterPlayer[]> {
  const roster = await Promise.all(
    entries.map(async (entry) => {
      try {
        const doc = await loadPlayerDocument(entry.slug);
        const stats = pickSeasonStats(doc, entry.season);
        return { entry, stats } satisfies RosterPlayer;
      } catch (error) {
        console.error(`Failed to load player ${entry.slug}`, error);
        return { entry, stats: null } satisfies RosterPlayer;
      }
    }),
  );

  roster.sort((a, b) => {
    const aPts = a.stats?.pts_g ?? 0;
    const bPts = b.stats?.pts_g ?? 0;
    if (bPts !== aPts) {
      return bPts - aPts;
    }
    return a.entry.name.localeCompare(b.entry.name);
  });

  return roster;
}

type NumericStatKey = Exclude<keyof PlayerStatsSeason, "season" | "team" | "conf">;

const ROSTER_COLUMNS: Array<{
  key: NumericStatKey;
  label: string;
  formatter: (value: number | null | undefined) => string;
}> = [
  { key: "gp", label: "GP", formatter: (value) => formatInteger(value) },
  { key: "mp_g", label: "MIN", formatter: (value) => formatDecimal(value, 1) },
  { key: "pts_g", label: "PTS", formatter: (value) => formatDecimal(value, 1) },
  { key: "trb_g", label: "REB", formatter: (value) => formatDecimal(value, 1) },
  { key: "ast_g", label: "AST", formatter: (value) => formatDecimal(value, 1) },
  { key: "stl_g", label: "STL", formatter: (value) => formatDecimal(value, 1) },
  { key: "blk_g", label: "BLK", formatter: (value) => formatDecimal(value, 1) },
  { key: "fg_pct", label: "FG%", formatter: (value) => formatPercent(value) },
  { key: "fg3_pct", label: "3P%", formatter: (value) => formatPercent(value) },
  { key: "ft_pct", label: "FT%", formatter: (value) => formatPercent(value) },
];

function createRosterHeader(): HTMLElement {
  const header = document.createElement("div");
  header.className = "roster-grid roster-grid--header";
  const nameLabel = document.createElement("span");
  nameLabel.textContent = "Player";
  header.appendChild(nameLabel);
  ROSTER_COLUMNS.forEach((column) => {
    const span = document.createElement("span");
    span.textContent = column.label;
    header.appendChild(span);
  });
  return header;
}

function createRosterRow(player: RosterPlayer): HTMLElement {
  const row = document.createElement("li");
  row.className = "roster-grid";
  row.dataset.player = player.entry.slug;

  const nameCell = document.createElement("span");
  nameCell.className = "roster-grid__name";
  if (player.entry.url) {
    const link = document.createElement("a");
    link.href = player.entry.url;
    link.target = "_blank";
    link.rel = "noreferrer noopener";
    link.textContent = player.entry.name;
    nameCell.appendChild(link);
  } else {
    nameCell.textContent = player.entry.name;
  }
  const teamLabel = document.createElement("span");
  teamLabel.className = "roster-grid__team";
  teamLabel.textContent = player.entry.team;
  nameCell.appendChild(teamLabel);
  row.appendChild(nameCell);

  ROSTER_COLUMNS.forEach((column) => {
    const cell = document.createElement("span");
    cell.className = "roster-grid__stat";
    cell.dataset.stat = column.label;
    const rawValue = player.stats ? (player.stats[column.key] as number | null | undefined) : null;
    cell.textContent = column.formatter(rawValue);
    row.appendChild(cell);
  });

  return row;
}

async function renderTeamRoster(teamName: string, entries: PlayerIndexEntry[], container: HTMLElement): Promise<void> {
  const card = document.createElement("article");
  card.className = "team-roster";
  card.innerHTML = `
    <header class="team-roster__head">
      <div>
        <h4 class="team-roster__title">${teamName}</h4>
        <p class="team-roster__meta">${entries.length} players</p>
      </div>
    </header>
  `;

  const tableShell = document.createElement("div");
  tableShell.className = "team-roster__table";
  const header = createRosterHeader();
  const list = document.createElement("ul");
  list.className = "roster-list";
  list.setAttribute("aria-label", `${teamName} roster`);
  list.innerHTML = `<li class="roster-grid roster-grid--loading">Loading…</li>`;
  tableShell.append(header, list);
  card.appendChild(tableShell);
  container.appendChild(card);

  const roster = await resolveRosterPlayers(entries);

  list.innerHTML = "";
  if (!roster.length) {
    const empty = document.createElement("li");
    empty.className = "roster-grid roster-grid--empty";
    empty.textContent = "Roster data is not available.";
    list.appendChild(empty);
    return;
  }

  roster.forEach((player) => {
    list.appendChild(createRosterRow(player));
  });
}

function buildConferenceGroups(entries: PlayerIndexEntry[]): ConferenceGroup[] {
  const conferenceMap = new Map<string, Map<string, PlayerIndexEntry[]>>();
  for (const entry of entries) {
    if (!entry.conference || !entry.team) continue;
    if (!conferenceMap.has(entry.conference)) {
      conferenceMap.set(entry.conference, new Map());
    }
    const teamMap = conferenceMap.get(entry.conference)!;
    if (!teamMap.has(entry.team)) {
      teamMap.set(entry.team, []);
    }
    teamMap.get(entry.team)!.push(entry);
  }

  const groups: ConferenceGroup[] = [];
  for (const [name, teams] of conferenceMap.entries()) {
    let totalPlayers = 0;
    for (const roster of teams.values()) {
      totalPlayers += roster.length;
    }
    groups.push({ name, teams, totalPlayers });
  }

  groups.sort((a, b) => a.name.localeCompare(b.name));
  return groups;
}

async function renderConferenceDirectory(): Promise<void> {
  if (!conferenceDirectory) return;

  try {
    const indexDoc = await loadJSON<PlayerIndexDocument>("../../data/players_index.json");
    const players = (indexDoc.players ?? []).filter((player) => player.conference && player.team);
    if (!players.length) {
      conferenceDirectory.innerHTML = `<p class="card conference-card__empty">No roster data available.</p>`;
      return;
    }

    const groups = buildConferenceGroups(players);
    const uniqueTeams = new Set(players.map((player) => `${player.conference}::${player.team}`));
    if (conferenceIntro) {
      const seasonLabel = indexDoc.seasons?.[0] ?? players[0]?.season ?? "current season";
      conferenceIntro.textContent = `${groups.length} conferences, ${uniqueTeams.size} teams, ${players.length} players tracked for ${seasonLabel}.`;
    }

    conferenceDirectory.innerHTML = "";

    groups.forEach((group) => {
      const details = document.createElement("details");
      details.className = "conference-card card";
      const summary = document.createElement("summary");
      summary.className = "conference-card__summary";
      summary.innerHTML = `
        <div class="conference-card__summary-content">
          <h3 class="conference-card__title">${group.name}</h3>
          <p class="conference-card__meta">${group.teams.size} teams · ${group.totalPlayers} players</p>
        </div>
        <span class="conference-card__chevron" aria-hidden="true"></span>
      `;

      const body = document.createElement("div");
      body.className = "conference-card__body";
      body.innerHTML = `<p class="conference-card__placeholder">Open to load rosters…</p>`;

      details.append(summary, body);
      conferenceDirectory.appendChild(details);

      let loading: Promise<void> | null = null;
      details.addEventListener("toggle", () => {
        if (!details.open || details.dataset.loaded === "true") {
          return;
        }
        if (!loading) {
          loading = (async () => {
            body.innerHTML = "";
            const teams = [...group.teams.entries()].sort((a, b) => a[0].localeCompare(b[0]));
            for (const [teamName, entries] of teams) {
              await renderTeamRoster(teamName, entries, body);
            }
            details.dataset.loaded = "true";
          })().catch((error) => {
            console.error(error);
            body.innerHTML = `<p class="conference-card__error">Unable to load rosters for ${group.name}. Please try again later.</p>`;
          }).finally(() => {
            loading = null;
          });
        }
      });
    });
  } catch (error) {
    console.error(error);
    conferenceDirectory.innerHTML = `<p class="card conference-card__error">We couldn't reach the roster index. Please refresh to try again.</p>`;
  }
}

await renderLeaderboards();
await renderConferenceDirectory();
