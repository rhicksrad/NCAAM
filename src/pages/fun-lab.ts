import {
  arc as d3Arc,
  axisBottom,
  axisLeft,
  format as d3Format,
  pie as d3Pie,
  scaleBand,
  scaleLinear,
  select,
} from "../lib/vendor/d3-bundle.js";
import type { PieArcDatum, Selection } from "d3";

import { createChartContainer, type ChartContainerHandle } from "../lib/charts/container.js";
import { setChartDefaults } from "../lib/charts/defaults.js";
import { computeInnerSize, createSVG, pixelAlign } from "../lib/charts/frame.js";
import { resolveColor } from "../lib/charts/theme.js";
import { requireOk } from "../lib/health.js";

const DATA_URL = new URL("../../data/fun-lab/mascot-index.json", import.meta.url).toString();
const CATS_DOGS_DATA_URL = new URL("../../data/fun-lab/cats-vs-dogs.json", import.meta.url).toString();
const ARENA_DATA_URL = new URL("../../venue_grouping_report.csv", import.meta.url).toString();

interface MascotIndexRecord {
  id: number;
  full_name: string;
  college: string;
  mascot: string;
  abbreviation: string | null;
  conference: {
    id: number;
    name: string;
    short_name: string | null;
  } | null;
  category: string;
  category_label: string;
  family: string;
  family_label: string;
}

interface ChartCategorySummary {
  slug: string;
  label: string;
  count: number;
}

interface MascotCategorySummary extends ChartCategorySummary {
  family: string;
  family_label: string;
}

interface MascotFamilySummary {
  slug: string;
  label: string;
  count: number;
}

interface MascotIndexPayload {
  generated_at?: string;
  source?: Record<string, unknown>;
  total_programs: number;
  total_conferences?: number;
  families: MascotFamilySummary[];
  categories: MascotCategorySummary[];
  records: MascotIndexRecord[];
}

interface CatsDogsTeamRecord {
  program?: string;
  mascot?: string;
  wins: number;
}

interface CatsDogsMatchup {
  slug: string;
  rank: number;
  series: string;
  total_games: number;
  total_games_display?: string;
  updated_through?: string;
  note?: string;
  cat: CatsDogsTeamRecord;
  dog: CatsDogsTeamRecord;
}

interface CatsDogsPayload {
  generated_at?: string;
  notes?: string[];
  matchups: CatsDogsMatchup[];
}

interface CatsDogsTotals {
  catWins: number;
  dogWins: number;
  totalGames: number;
}

interface ArenaGroupSummary {
  slug: string;
  label: string;
  count: number;
}

interface ArenaRecord {
  team: string;
  venue: string;
  groupSlug: string;
  groupLabel: string;
}

interface ArenaIndexPayload {
  totalPrograms: number;
  groups: ArenaGroupSummary[];
  records: ArenaRecord[];
}

interface ArenaFeatureContext {
  summary: HTMLElement;
  chart: HTMLElement;
  table: HTMLTableElement;
  handle: ChartContainerHandle;
}

interface ChartControls {
  colorByCategory: Map<string, string>;
  setActiveCategory: (slug: string | null) => void;
  onArcToggle: (callback: (slug: string) => void) => void;
}

interface CatsDogsFeatureContext {
  section: HTMLElement;
  summary: HTMLElement;
  chart: HTMLElement;
  legend: HTMLElement;
  footnote: HTMLElement;
  handle: ChartContainerHandle;
}

const numberFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = d3Format(".1%");

const app = document.getElementById("app");
if (!app) {
  throw new Error("Fun Lab requires an #app container");
}

setChartDefaults();

app.innerHTML = `
  <div class="fun-lab stack" data-gap="lg">
    <section class="card stack fun-lab__intro" data-gap="sm">
      <header class="stack" data-gap="xs">
        <h2 class="section-title">Mascot Fun Lab kickoff</h2>
        <p id="fun-lab-summary" class="section-summary">Loading mascot taxonomy…</p>
      </header>
      <div class="fun-lab__meta">
        <span id="fun-lab-generated">Updated just now</span>
        <a id="fun-lab-download" href="${DATA_URL}" download>Download mascot JSON</a>
      </div>
    </section>
    <section class="card stack fun-lab__archetype" data-gap="lg">
      <header class="stack" data-gap="xs">
        <h2 class="section-title">Mascot archetype index</h2>
        <p id="fun-lab-chart-summary" class="section-summary">Crunching archetype insights…</p>
      </header>
      <div class="fun-lab__feature-grid">
        <article class="viz-card fun-lab__chart-card">
          <div id="fun-lab-chart" class="fun-lab__chart-surface viz-canvas" role="presentation"></div>
        </article>
        <div class="table-shell fun-lab__table-shell">
          <table id="fun-lab-table" aria-label="Division I mascot taxonomy index">
            <thead>
              <tr>
                <th scope="col">Program</th>
                <th scope="col">Mascot</th>
                <th scope="col">Conference</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </section>
    <section id="cats-dogs-section" class="card stack fun-lab__showdown" data-gap="md">
      <header class="stack" data-gap="xs">
        <h2 class="section-title">Fighting Like Dogs and Cats</h2>
        <p id="cats-dogs-summary" class="section-summary">Sizing up rivalry bragging rights…</p>
      </header>
      <div class="fun-lab__showdown-visual stack" data-gap="md">
        <div
          id="cats-dogs-chart"
          class="fun-lab__chart-surface fun-lab__showdown-chart viz-canvas"
          role="presentation"
        ></div>
        <dl
          id="cats-dogs-legend"
          class="fun-lab__showdown-legend"
          aria-label="Cats versus dogs rivalry ledger"
        ></dl>
      </div>
      <p id="cats-dogs-footnote" class="fun-lab__showdown-footnote"></p>
    </section>
    <section class="card stack fun-lab__arena" data-gap="lg">
      <header class="stack" data-gap="xs">
        <h2 class="section-title">Arena name type index</h2>
        <p id="arena-type-summary" class="section-summary">Parsing home-court name trends…</p>
      </header>
      <div class="fun-lab__feature-grid">
        <article class="viz-card fun-lab__chart-card">
          <div id="arena-type-chart" class="fun-lab__chart-surface viz-canvas" role="presentation"></div>
        </article>
        <div class="table-shell fun-lab__table-shell">
          <table id="arena-type-table" aria-label="Division I arena name type index">
            <thead>
              <tr>
                <th scope="col">Program</th>
                <th scope="col">Venue</th>
                <th scope="col">Type</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
`;

const summaryEl = document.getElementById("fun-lab-summary");
const generatedEl = document.getElementById("fun-lab-generated");
const chartSummaryEl = document.getElementById("fun-lab-chart-summary");
const chartRoot = document.getElementById("fun-lab-chart") as HTMLElement | null;
const tableEl = document.getElementById("fun-lab-table") as HTMLTableElement | null;
const catsDogsSection = document.getElementById("cats-dogs-section") as HTMLElement | null;
const catsDogsSummaryEl = document.getElementById("cats-dogs-summary") as HTMLElement | null;
const catsDogsChartEl = document.getElementById("cats-dogs-chart") as HTMLElement | null;
const catsDogsLegendEl = document.getElementById("cats-dogs-legend") as HTMLElement | null;
const catsDogsFootnoteEl = document.getElementById("cats-dogs-footnote") as HTMLElement | null;
const arenaSummaryEl = document.getElementById("arena-type-summary") as HTMLElement | null;
const arenaChartEl = document.getElementById("arena-type-chart") as HTMLElement | null;
const arenaTableEl = document.getElementById("arena-type-table") as HTMLTableElement | null;

const chartHandle = chartRoot ? createChartContainer(chartRoot, { ratio: 0.82 }) : null;
const catsDogsHandle = catsDogsChartEl ? createChartContainer(catsDogsChartEl, { ratio: 0.68 }) : null;
const arenaHandle = arenaChartEl ? createChartContainer(arenaChartEl, { ratio: 0.82 }) : null;
const expandedGroups = new Set<string>();

function formatPercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0.0%";
  }
  return percentFormatter(Math.max(0, value));
}

function measureContainerSize(element: HTMLElement): { width: number; height: number } {
  const doc = element.ownerDocument ?? document;
  const view = doc.defaultView;
  const rect = element.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || element.clientWidth || element.offsetWidth));
  const height = Math.max(1, Math.round(rect.height || element.clientHeight || element.offsetHeight));
  if (width > 0 && height > 0) {
    return { width, height };
  }
  const fallbackWidth = view ? Math.round(view.innerWidth * 0.9) : 600;
  const fallbackHeight = Math.round(fallbackWidth * 0.6);
  return { width: Math.max(1, fallbackWidth), height: Math.max(1, fallbackHeight) };
}

function readBarRadius(element: HTMLElement): number {
  const doc = element.ownerDocument ?? document;
  const view = doc.defaultView;
  if (!view) {
    return 8;
  }
  const value = Number.parseFloat(view.getComputedStyle(element).getPropertyValue("--chart-bar-radius"));
  return Number.isFinite(value) ? value : 8;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let isQuoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\"") {
      const next = text[index + 1];
      if (isQuoted && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        isQuoted = !isQuoted;
      }
    } else if (char === "," && !isQuoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !isQuoted) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      while (index + 1 < text.length && (text[index + 1] === "\n" || text[index + 1] === "\r")) {
        index += 1;
      }
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function slugify(value: string, fallback = "other"): string {
  const normalized = value.trim().toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function formatArenaLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Other/Unknown";
  }
  return trimmed.replace(/\b\w/g, letter => letter.toUpperCase());
}

async function fetchMascotIndex(): Promise<MascotIndexPayload> {
  const response = await requireOk(DATA_URL, "Fun Lab", {
    headers: { Accept: "application/json" },
  });
  const payload = (await response.json()) as MascotIndexPayload;
  if (!payload || !Array.isArray(payload.records)) {
    throw new Error("Mascot index payload is malformed");
  }
  return payload;
}

async function fetchCatsDogsShowdowns(): Promise<CatsDogsPayload> {
  const response = await requireOk(CATS_DOGS_DATA_URL, "Fun Lab", {
    headers: { Accept: "application/json" },
  });
  const payload = (await response.json()) as CatsDogsPayload;
  if (!payload || !Array.isArray(payload.matchups)) {
    throw new Error("Cats vs dogs payload is malformed");
  }
  return payload;
}

async function fetchArenaGroupingReport(): Promise<ArenaIndexPayload> {
  const response = await requireOk(ARENA_DATA_URL, "Fun Lab", {
    headers: { Accept: "text/csv, text/plain" },
  });
  const text = await response.text();
  const rows = parseCsv(text).filter(row => row.some(cell => cell.trim().length > 0));
  if (rows.length === 0) {
    return { totalPrograms: 0, groups: [], records: [] };
  }

  const [, ...dataRows] = rows;
  const records: ArenaRecord[] = [];
  dataRows.forEach(columns => {
    const [teamRaw = "", venueRaw = "", groupRaw = ""] = columns;
    const team = teamRaw.trim();
    if (!team) {
      return;
    }
    const venue = venueRaw.trim() || "Unknown venue";
    const groupValue = groupRaw.trim() || "Other/Unknown";
    const slug = slugify(groupValue);
    const label = formatArenaLabel(groupValue);
    records.push({
      team,
      venue,
      groupSlug: slug,
      groupLabel: label,
    });
  });

  const totals = new Map<string, { label: string; count: number }>();
  records.forEach(record => {
    const entry = totals.get(record.groupSlug);
    if (entry) {
      entry.count += 1;
      if (entry.label.length < record.groupLabel.length) {
        entry.label = record.groupLabel;
      }
    } else {
      totals.set(record.groupSlug, { label: record.groupLabel, count: 1 });
    }
  });

  const groups = [...totals.entries()]
    .map(([slug, value]) => ({ slug, label: value.label, count: value.count }))
    .sort((a, b) => {
      if (b.count === a.count) {
        return a.label.localeCompare(b.label, "en-US");
      }
      return b.count - a.count;
    });

  return {
    totalPrograms: records.length,
    groups,
    records,
  };
}

function describeSummary(data: MascotIndexPayload): string {
  const total = data.total_programs;
  if (!total || total <= 0) {
    return "No mascot data available yet.";
  }

  const categories = [...data.categories].sort((a, b) => b.count - a.count);
  const families = [...data.families].sort((a, b) => b.count - a.count);
  const topCategory = categories[0];
  const secondCategory = categories[1];
  const rareCategory = categories[categories.length - 1];
  const topFamily = families[0];

  const pieces: string[] = [
    `We classified ${numberFormatter.format(total)} Division I programs into ${categories.length} mascot archetypes.`,
  ];
  if (topFamily) {
    const share = formatPercent(topFamily.count / total);
    pieces.push(`${topFamily.label} lead the board at ${numberFormatter.format(topFamily.count)} programs (${share}).`);
  }
  if (topCategory) {
    pieces.push(
      `${topCategory.label} is the most common archetype with ${numberFormatter.format(topCategory.count)} programs ` +
        `(${formatPercent(topCategory.count / total)}).`,
    );
  }
  if (rareCategory && rareCategory !== topCategory) {
    pieces.push(
      `${rareCategory.label} shows up the least, with just ${numberFormatter.format(rareCategory.count)} programs ` +
        `(${formatPercent(rareCategory.count / total)}).`,
    );
  } else if (secondCategory) {
    pieces.push(
      `${secondCategory.label} trails close behind at ${numberFormatter.format(secondCategory.count)} programs ` +
        `(${formatPercent(secondCategory.count / total)}).`,
    );
  }

  return pieces.join(" ");
}

function formatProgramLabel(team: CatsDogsTeamRecord): string {
  const program = team.program?.trim() ?? "";
  const mascot = team.mascot?.trim() ?? "";
  if (program && mascot) {
    return `${program} ${mascot}`;
  }
  return program || mascot || "Unknown program";
}

function computeCatsDogsTotals(matchups: CatsDogsMatchup[]): CatsDogsTotals {
  return matchups.reduce<CatsDogsTotals>(
    (acc, matchup) => {
      const catWins = Number.isFinite(matchup.cat.wins) ? Math.max(0, matchup.cat.wins) : 0;
      const dogWins = Number.isFinite(matchup.dog.wins) ? Math.max(0, matchup.dog.wins) : 0;
      acc.catWins += catWins;
      acc.dogWins += dogWins;
      acc.totalGames += catWins + dogWins;
      return acc;
    },
    { catWins: 0, dogWins: 0, totalGames: 0 },
  );
}

function describeCatsDogsSummary(matchups: CatsDogsMatchup[]): string {
  if (matchups.length === 0) {
    return "No cat-versus-dog rivalries to chart yet.";
  }
  const totals = computeCatsDogsTotals(matchups);
  if (totals.totalGames <= 0) {
    return "No cat-versus-dog rivalries to chart yet.";
  }

  const leaderIsCats = totals.catWins >= totals.dogWins;
  const leaderLabel = leaderIsCats ? "Cat mascots" : "Dog mascots";
  const trailerLabel = leaderIsCats ? "dog mascots" : "cat mascots";
  const leaderWins = leaderIsCats ? totals.catWins : totals.dogWins;
  const trailerWins = leaderIsCats ? totals.dogWins : totals.catWins;
  const winRate = totals.totalGames > 0 ? leaderWins / totals.totalGames : 0;
  const mostPlayed = matchups[0];
  const tightest = matchups.reduce<
    { margin: number; label: string; leader: string } | null
  >((closest, matchup) => {
    const margin = Math.abs(matchup.cat.wins - matchup.dog.wins);
    if (closest === null || margin < closest.margin) {
      const leader =
        matchup.cat.wins === matchup.dog.wins
          ? "Cats and dogs"
          : matchup.cat.wins > matchup.dog.wins
            ? "Cats"
            : "Dogs";
      return { margin, label: matchup.series, leader };
    }
    return closest;
  }, null);

  const fragments: string[] = [
    `These ${matchups.length} cat-versus-dog rivalries combine for ${numberFormatter.format(totals.totalGames)} Division I games.`,
    `${leaderLabel} hold the crown at ${numberFormatter.format(leaderWins)} wins (${formatPercent(winRate)}), while ${trailerLabel} have ${numberFormatter.format(trailerWins)}.`,
  ];
  if (mostPlayed) {
    const totalLabel = mostPlayed.total_games_display ?? numberFormatter.format(mostPlayed.total_games);
    fragments.push(`${mostPlayed.series} is the most frequent showdown with ${totalLabel} meetings.`);
  }
  if (tightest && tightest.margin > 0) {
    fragments.push(
      `${tightest.leader} lead ${tightest.label} by ${numberFormatter.format(tightest.margin)} wins, the narrowest gap on the board.`,
    );
  }
  return fragments.join(" ");
}

function describeArenaOverview(groups: ArenaGroupSummary[], totalPrograms: number): string {
  if (!totalPrograms || totalPrograms <= 0 || groups.length === 0) {
    return "No arena naming data available yet.";
  }

  const overview: string[] = [
    `We mapped ${numberFormatter.format(totalPrograms)} Division I programs across ${groups.length} arena name types.`,
  ];

  const leader = groups[0];
  const runnerUp = groups[1];
  const rare = groups[groups.length - 1];

  if (leader) {
    overview.push(
      `${leader.label} leads the board with ${numberFormatter.format(leader.count)} programs ` +
        `(${formatPercent(leader.count / totalPrograms)}).`,
    );
  }

  if (rare && rare !== leader) {
    overview.push(
      `${rare.label} is the rarest, appearing for ${numberFormatter.format(rare.count)} programs ` +
        `(${formatPercent(rare.count / totalPrograms)}).`,
    );
  } else if (runnerUp) {
    overview.push(
      `${runnerUp.label} follows at ${numberFormatter.format(runnerUp.count)} programs ` +
        `(${formatPercent(runnerUp.count / totalPrograms)}).`,
    );
  }

  return overview.join(" ");
}

function describeArenaChartSummary(
  groups: ArenaGroupSummary[],
  totalPrograms: number,
  activeGroup: string | null,
): string {
  if (!totalPrograms || totalPrograms <= 0 || groups.length === 0) {
    return "No arena naming data available yet.";
  }

  if (activeGroup) {
    const selected = groups.find(group => group.slug === activeGroup);
    if (selected) {
      const share = formatPercent(selected.count / totalPrograms);
      return `${selected.label} programs only — ${numberFormatter.format(selected.count)} schools (${share}). Click again to reset.`;
    }
  }

  if (groups.length >= 2) {
    const [top, next] = groups;
    return `${top.label} names ${formatPercent(top.count / totalPrograms)} of Division I home courts, with ${next.label} close behind at ${formatPercent(next.count / totalPrograms)}.`;
  }

  return describeArenaOverview(groups, totalPrograms);
}

function formatGeneratedAt(timestamp?: string): string {
  if (!timestamp) {
    return "Generated from the latest worker snapshot.";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Generated from the latest worker snapshot.";
  }
  return `Generated ${date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function describeChartSummary(
  categories: MascotCategorySummary[],
  totalPrograms: number,
  activeCategory: string | null,
): string {
  if (!totalPrograms || totalPrograms <= 0 || categories.length === 0) {
    return "No mascot taxonomy available yet.";
  }

  if (activeCategory) {
    const selected = categories.find(category => category.slug === activeCategory);
    if (selected) {
      const share = formatPercent(selected.count / totalPrograms);
      return `${selected.label} programs only — ${numberFormatter.format(selected.count)} schools (${share}) in the index. Click again to reset.`;
    }
  }

  if (categories.length >= 2) {
    const [top, runnerUp] = categories;
    return `${top.label} owns ${formatPercent(top.count / totalPrograms)} of Division I mascots, with ${runnerUp.label} next at ${formatPercent(runnerUp.count / totalPrograms)}.`;
  }

  if (categories.length === 1) {
    const top = categories[0];
    return `${top.label} accounts for ${formatPercent(top.count / totalPrograms)} of Division I mascots.`;
  }

  return "No mascot taxonomy available yet.";
}

function renderChart<T extends ChartCategorySummary>(
  categories: T[],
  total: number,
  chartContainer: HTMLElement,
  handle: ChartContainerHandle,
  options: {
    chartId?: string;
    title?: string;
    description?: string;
    unitLabel?: string;
    segmentLabel?: string;
  } = {},
): ChartControls {
  const {
    chartId = "fun-lab-mascot-share",
    title = "Mascot archetype share",
    description = "Donut chart showing the share of each mascot archetype across Division I programs.",
    unitLabel = "programs",
    segmentLabel = "archetype",
  } = options;

  const colorByCategory = new Map<string, string>();
  categories.forEach((category, index) => {
    colorByCategory.set(category.slug, resolveColor(index));
  });

  let activeSlug: string | null = null;
  let arcToggleHandler: ((slug: string) => void) | null = null;
  let arcs: Selection<SVGPathElement, PieArcDatum<T>, SVGGElement, unknown> | null = null;

  const applyActiveState = () => {
    if (!arcs) {
      return;
    }
    arcs.each(function (d: PieArcDatum<T>) {
      const element = this as SVGPathElement;
      const isActive = activeSlug !== null && d.data.slug === activeSlug;
      const isDimmed = activeSlug !== null && d.data.slug !== activeSlug;
      element.classList.toggle("fun-lab__arc--dimmed", isDimmed);
      element.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  handle.mount(() => {
    chartContainer.innerHTML = "";

    const { width, height } = measureContainerSize(chartContainer);
    const radius = Math.min(width, height) / 2;

    const svg = createSVG(chartContainer, width, height, {
      title,
      description,
      id: chartId,
    });

    const group = select(svg)
      .append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    const barRadius = readBarRadius(chartContainer);

    const pie = d3Pie<T>().value((d: T) => d.count).sort(null);
    const arc = d3Arc<T>()
      .innerRadius(radius * 0.55)
      .outerRadius(Math.max(0, radius - 12))
      .padAngle(0.012)
      .cornerRadius(barRadius);

    const invokeToggle = (slug: string) => {
      if (arcToggleHandler) {
        arcToggleHandler(slug);
      }
    };

    arcs = group
      .selectAll<SVGPathElement>("path.fun-lab__arc")
      .data(pie(categories))
      .join("path") as Selection<SVGPathElement, PieArcDatum<T>, SVGGElement, unknown>;

    arcs
      .attr("class", "fun-lab__arc")
      .attr("fill", (d: PieArcDatum<T>, index: number) => {
        const color = colorByCategory.get(d.data.slug);
        if (color) {
          return color;
        }
        const fallback = resolveColor(index);
        colorByCategory.set(d.data.slug, fallback);
        return fallback;
      })
      .attr("stroke", "var(--chart-bg)")
      .attr("stroke-width", "calc(var(--chart-line-width) * 1px)")
      .attr("d", (d: PieArcDatum<T>) => arc(d) ?? "")
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("focusable", "true")
      .attr("aria-pressed", "false")
      .attr("aria-label", (d: PieArcDatum<T>) => `Toggle ${d.data.label} ${unitLabel}`)
      .on("click", (event: PointerEvent, d: PieArcDatum<T>) => {
        event.preventDefault();
        invokeToggle(d.data.slug);
      })
      .on("keydown", (event: KeyboardEvent, d: PieArcDatum<T>) => {
        if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
          event.preventDefault();
          invokeToggle(d.data.slug);
        }
      });

    arcs.append("title").text((d: PieArcDatum<T>) => {
      const share = formatPercent(d.data.count / total);
      return `${d.data.label}: ${numberFormatter.format(d.data.count)} ${unitLabel} (${share}). Click to isolate this ${segmentLabel}.`;
    });

    group
      .append("text")
      .attr("class", "fun-lab__chart-total")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .text(numberFormatter.format(total));

    group
      .append("text")
      .attr("class", "fun-lab__chart-total fun-lab__chart-total--caption")
      .attr("text-anchor", "middle")
      .attr("dy", "1.1em")
      .text(unitLabel);

    applyActiveState();
  });

  return {
    colorByCategory,
    setActiveCategory: (slug: string | null) => {
      activeSlug = slug;
      applyActiveState();
    },
    onArcToggle: (callback: (slug: string) => void) => {
      arcToggleHandler = callback;
    },
  };
}

function renderGroupedTable(
  table: HTMLTableElement,
  records: MascotIndexRecord[],
  categories: MascotCategorySummary[],
  colorByCategory: Map<string, string>,
  totalPrograms: number,
  expanded: Set<string>,
  activeCategory: string | null,
): void {
  while (table.tBodies.length > 0) {
    table.removeChild(table.tBodies[0]);
  }

  const doc = table.ownerDocument ?? document;
  const colCount = table.tHead?.rows[0]?.cells.length ?? 3;

  if (records.length === 0) {
    const body = doc.createElement("tbody");
    body.className = "fun-lab__group fun-lab__group--empty";
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = colCount;
    cell.className = "fun-lab__cell fun-lab__cell--empty";
    cell.textContent = "No programs match this filter yet.";
    table.appendChild(body);
    return;
  }

  const grouped = new Map<string, MascotIndexRecord[]>();
  records.forEach(record => {
    const list = grouped.get(record.category);
    if (list) {
      list.push(record);
    } else {
      grouped.set(record.category, [record]);
    }
  });

  const order = categories.filter(category => grouped.has(category.slug));
  if (order.length === 0) {
    const body = doc.createElement("tbody");
    body.className = "fun-lab__group fun-lab__group--empty";
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = colCount;
    cell.className = "fun-lab__cell fun-lab__cell--empty";
    cell.textContent = "No programs match this filter yet.";
    table.appendChild(body);
    return;
  }

  order.forEach((category, index) => {
    const recordsInGroup = grouped.get(category.slug);
    if (!recordsInGroup || recordsInGroup.length === 0) {
      return;
    }

    const body = doc.createElement("tbody");
    body.className = "fun-lab__group";
    body.dataset.category = category.slug;

    const color = colorByCategory.get(category.slug) ?? resolveColor(index);
    body.style.setProperty("--group-color", color);

    const shouldExpand = activeCategory ? category.slug === activeCategory : expanded.has(category.slug);
    body.dataset.expanded = shouldExpand ? "true" : "false";

    const headerRow = body.insertRow();
    headerRow.className = "fun-lab__group-row";
    const headerCell = headerRow.insertCell();
    headerCell.colSpan = colCount;
    headerCell.className = "fun-lab__group-cell";

    const toggle = doc.createElement("button");
    toggle.type = "button";
    toggle.className = "fun-lab__group-toggle";
    toggle.setAttribute("aria-expanded", shouldExpand ? "true" : "false");

    const icon = doc.createElement("span");
    icon.className = "fun-lab__group-icon";
    icon.setAttribute("aria-hidden", "true");
    toggle.appendChild(icon);

    const label = doc.createElement("span");
    label.className = "fun-lab__group-label";
    label.textContent = category.label;
    toggle.appendChild(label);

    const meta = doc.createElement("span");
    meta.className = "fun-lab__group-meta";
    const recordCount = recordsInGroup.length;
    const share = totalPrograms > 0 ? formatPercent(category.count / totalPrograms) : "0.0%";
    const programWord = recordCount === 1 ? "program" : "programs";
    meta.innerHTML = `<strong>${numberFormatter.format(recordCount)}</strong> ${programWord} • ${share}`;
    toggle.appendChild(meta);

    const applyExpandedState = (next: boolean) => {
      body.dataset.expanded = next ? "true" : "false";
      toggle.setAttribute("aria-expanded", next ? "true" : "false");
      if (next) {
        expanded.add(category.slug);
      } else {
        expanded.delete(category.slug);
      }
    };

    toggle.addEventListener("click", event => {
      event.preventDefault();
      const isOpen = body.dataset.expanded === "true";
      applyExpandedState(!isOpen);
    });

    headerCell.appendChild(toggle);

    recordsInGroup.forEach(record => {
      const row = body.insertRow();
      row.className = "fun-lab__group-data";
      row.dataset.category = category.slug;

      const programCell = row.insertCell();
      programCell.className = "fun-lab__cell fun-lab__cell--program";
      programCell.textContent = record.full_name;

      const mascotCell = row.insertCell();
      mascotCell.className = "fun-lab__cell fun-lab__cell--mascot";
      mascotCell.textContent = record.mascot;

      const conferenceCell = row.insertCell();
      conferenceCell.className = "fun-lab__cell fun-lab__cell--conference";
      if (record.conference) {
        const labelText = record.conference.short_name ?? record.conference.name;
        conferenceCell.textContent = labelText;
        if (record.conference.name && record.conference.name !== labelText) {
          conferenceCell.title = record.conference.name;
        }
      } else {
        conferenceCell.textContent = "—";
      }
    });

    if (activeCategory === category.slug) {
      expanded.add(category.slug);
    }

    table.appendChild(body);
  });
}

function renderArenaTable(
  table: HTMLTableElement,
  records: ArenaRecord[],
  groups: ArenaGroupSummary[],
  colorByCategory: Map<string, string>,
  totalPrograms: number,
  expanded: Set<string>,
  activeGroup: string | null,
): void {
  while (table.tBodies.length > 0) {
    table.removeChild(table.tBodies[0]);
  }

  const doc = table.ownerDocument ?? document;
  const colCount = table.tHead?.rows[0]?.cells.length ?? 3;

  if (records.length === 0) {
    const body = doc.createElement("tbody");
    body.className = "fun-lab__group fun-lab__group--empty";
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = colCount;
    cell.className = "fun-lab__cell fun-lab__cell--empty";
    cell.textContent = "No arena naming data available yet.";
    table.appendChild(body);
    return;
  }

  const grouped = new Map<string, ArenaRecord[]>();
  records.forEach(record => {
    const bucket = grouped.get(record.groupSlug);
    if (bucket) {
      bucket.push(record);
    } else {
      grouped.set(record.groupSlug, [record]);
    }
  });

  const order = groups.filter(group => grouped.has(group.slug));
  if (order.length === 0) {
    const body = doc.createElement("tbody");
    body.className = "fun-lab__group fun-lab__group--empty";
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = colCount;
    cell.className = "fun-lab__cell fun-lab__cell--empty";
    cell.textContent = "No arena naming data available yet.";
    table.appendChild(body);
    return;
  }

  order.forEach((group, index) => {
    const recordsInGroup = grouped.get(group.slug);
    if (!recordsInGroup || recordsInGroup.length === 0) {
      return;
    }

    const body = doc.createElement("tbody");
    body.className = "fun-lab__group";
    body.dataset.category = group.slug;

    const color = colorByCategory.get(group.slug) ?? resolveColor(index);
    body.style.setProperty("--group-color", color);

    const shouldExpand = activeGroup ? group.slug === activeGroup : expanded.has(group.slug);
    body.dataset.expanded = shouldExpand ? "true" : "false";

    const headerRow = body.insertRow();
    headerRow.className = "fun-lab__group-row";
    const headerCell = headerRow.insertCell();
    headerCell.colSpan = colCount;
    headerCell.className = "fun-lab__group-cell";

    const toggle = doc.createElement("button");
    toggle.type = "button";
    toggle.className = "fun-lab__group-toggle";
    toggle.setAttribute("aria-expanded", shouldExpand ? "true" : "false");

    const icon = doc.createElement("span");
    icon.className = "fun-lab__group-icon";
    icon.setAttribute("aria-hidden", "true");
    toggle.appendChild(icon);

    const label = doc.createElement("span");
    label.className = "fun-lab__group-label";
    label.textContent = group.label;
    toggle.appendChild(label);

    const meta = doc.createElement("span");
    meta.className = "fun-lab__group-meta";
    const share = totalPrograms > 0 ? formatPercent(group.count / totalPrograms) : "0.0%";
    const programWord = group.count === 1 ? "program" : "programs";
    meta.innerHTML = `<strong>${numberFormatter.format(group.count)}</strong> ${programWord} • ${share}`;
    toggle.appendChild(meta);

    const applyExpandedState = (next: boolean) => {
      body.dataset.expanded = next ? "true" : "false";
      toggle.setAttribute("aria-expanded", next ? "true" : "false");
      if (next) {
        expanded.add(group.slug);
      } else {
        expanded.delete(group.slug);
      }
    };

    toggle.addEventListener("click", event => {
      event.preventDefault();
      const isOpen = body.dataset.expanded === "true";
      applyExpandedState(!isOpen);
    });

    headerCell.appendChild(toggle);

    recordsInGroup.forEach(record => {
      const row = body.insertRow();
      row.className = "fun-lab__group-data";
      row.dataset.category = group.slug;

      const programCell = row.insertCell();
      programCell.className = "fun-lab__cell fun-lab__cell--program";
      programCell.textContent = record.team;

      const venueCell = row.insertCell();
      venueCell.className = "fun-lab__cell fun-lab__cell--mascot";
      venueCell.textContent = record.venue;

      const typeCell = row.insertCell();
      typeCell.className = "fun-lab__cell fun-lab__cell--conference";
      typeCell.textContent = record.groupLabel;
    });

    if (activeGroup === group.slug) {
      expanded.add(group.slug);
    }

    table.appendChild(body);
  });
}

function renderCatsDogsColumns(
  matchups: CatsDogsMatchup[],
  chartContainer: HTMLElement,
  handle: ChartContainerHandle,
  options: {
    catColor: string;
    dogColor: string;
    chartId?: string;
  },
): void {
  const { catColor, dogColor, chartId = "fun-lab-cats-dogs-columns" } = options;

  const safeWins = (value: number | undefined): number => {
    const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
    return Math.max(0, numeric);
  };

  interface CatsDogsColumnEntry {
    matchup: CatsDogsMatchup;
    slug: string;
    catWins: number;
    dogWins: number;
    label: string;
    shortLabel: string;
  }

  interface CatsDogsBarDatum {
    side: "cats" | "dogs";
    value: number;
    entry: CatsDogsColumnEntry;
  }

  const entries: CatsDogsColumnEntry[] = matchups.map(matchup => ({
    matchup,
    slug: matchup.slug,
    catWins: safeWins(matchup.cat.wins),
    dogWins: safeWins(matchup.dog.wins),
    label: `${formatProgramLabel(matchup.cat)} vs ${formatProgramLabel(matchup.dog)}`,
    shortLabel: `${matchup.cat.mascot ?? "Cats"} vs ${matchup.dog.mascot ?? "Dogs"}`,
  }));

  const labelBySlug = new Map(entries.map(entry => [entry.slug, entry.shortLabel] as const));
  const seriesBySlug = new Map(entries.map(entry => [entry.slug, entry.matchup.series] as const));

  const sides: Array<"cats" | "dogs"> = ["cats", "dogs"];

  handle.mount(() => {
    chartContainer.innerHTML = "";

    if (entries.length === 0) {
      chartContainer.textContent = "No cat-versus-dog rivalries to chart yet.";
      return;
    }

    const { width, height } = measureContainerSize(chartContainer);
    const margin = { top: 48, right: 32, bottom: 132, left: 88 };
    const { iw, ih } = computeInnerSize(width, height, margin);

    if (iw <= 0 || ih <= 0) {
      chartContainer.textContent = "Chart area is too small to render the rivalry view.";
      return;
    }

    const svg = createSVG(chartContainer, width, height, {
      id: chartId,
      title: "Cat versus dog rivalry wins",
      description: "Grouped column chart comparing wins for cat and dog mascots in marquee rivalries.",
    });

    const root = select(svg)
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const x0 = scaleBand<string>()
      .domain(entries.map(entry => entry.slug))
      .range([0, iw])
      .paddingInner(0.32)
      .paddingOuter(0.08);

    const x1 = scaleBand<string>()
      .domain(sides)
      .range([0, x0.bandwidth()])
      .paddingInner(0.22)
      .paddingOuter(0.06);

    const maxWins = Math.max(1, ...entries.flatMap(entry => [entry.catWins, entry.dogWins]));

    const y = scaleLinear()
      .domain([0, maxWins])
      .nice()
      .range([ih, 0]);

    const yAxis = axisLeft(y)
      .ticks(Math.min(6, Math.max(3, Math.ceil(maxWins / 25))))
      .tickSize(-iw)
      .tickPadding(12)
      .tickFormat((value: number) => numberFormatter.format(Number(value)));

    const yGroup = root
      .append("g")
      .attr("class", "fun-lab__showdown-axis fun-lab__showdown-axis--y")
      .call(yAxis);

    yGroup.selectAll(".tick line").attr("stroke", "var(--chart-grid)");
    yGroup.select(".domain").remove();

    const xAxis = axisBottom(x0)
      .tickSizeOuter(0)
      .tickFormat((slug: string) => labelBySlug.get(slug) ?? slug);

    const xGroup = root
      .append("g")
      .attr("class", "fun-lab__showdown-axis fun-lab__showdown-axis--x")
      .attr("transform", `translate(0, ${ih})`)
      .call(xAxis);

    const xLabels = xGroup.selectAll("text") as Selection<SVGTextElement, string, SVGGElement, unknown>;
    xLabels
      .attr("transform", "translate(-6, 12) rotate(-32)")
      .style("text-anchor", "end")
      .append("title")
      .text((slug: string) => seriesBySlug.get(slug) ?? labelBySlug.get(slug) ?? slug);

    root
      .append("text")
      .attr("class", "fun-lab__axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -(margin.top + ih / 2))
      .attr("y", -margin.left + 24)
      .attr("text-anchor", "middle")
      .text("Wins");

    const barRadius = readBarRadius(chartContainer);

    const groups = (root
      .append("g")
      .attr("class", "fun-lab__showdown-groups")
      .selectAll("g.fun-lab__showdown-group")
      .data(entries)
      .join("g") as Selection<SVGGElement, CatsDogsColumnEntry, SVGGElement, unknown>)
      .attr("class", "fun-lab__showdown-group")
      .attr("transform", (entry: CatsDogsColumnEntry) => `translate(${x0(entry.slug) ?? 0}, 0)`);

    groups.each(function (entry: CatsDogsColumnEntry) {
      const group = select(this as SVGGElement);
      const data: CatsDogsBarDatum[] = sides.map(side => ({
        side,
        value: side === "cats" ? entry.catWins : entry.dogWins,
        entry,
      }));

      const rects = (group
        .selectAll("rect.fun-lab__showdown-bar")
        .data(data)
        .join("rect") as Selection<SVGRectElement, CatsDogsBarDatum, SVGGElement, CatsDogsColumnEntry>)
        .attr("class", (d: CatsDogsBarDatum) => `fun-lab__showdown-bar fun-lab__showdown-bar--${d.side}`)
        .attr("role", "presentation")
        .attr("x", (d: CatsDogsBarDatum) => x1(d.side) ?? 0)
        .attr("width", x1.bandwidth())
        .attr("y", (d: CatsDogsBarDatum) => y(d.value))
        .attr("height", (d: CatsDogsBarDatum) => ih - y(d.value))
        .attr("rx", barRadius)
        .attr("ry", barRadius)
        .attr("fill", (d: CatsDogsBarDatum) => (d.side === "cats" ? catColor : dogColor));

      rects.select("title").remove();
      rects
        .append("title")
        .text((d: CatsDogsBarDatum) => {
          const sideLabel = d.side === "cats" ? "Cat mascots" : "Dog mascots";
          const programLabel = d.side === "cats" ? formatProgramLabel(d.entry.matchup.cat) : formatProgramLabel(d.entry.matchup.dog);
          return `${sideLabel} — ${programLabel}: ${numberFormatter.format(d.value)} wins in ${d.entry.matchup.series}.`;
        });

      (group
        .selectAll("text.fun-lab__showdown-value")
        .data(data)
        .join("text") as Selection<SVGTextElement, CatsDogsBarDatum, SVGGElement, CatsDogsColumnEntry>)
        .attr("class", "fun-lab__showdown-value")
        .attr("text-anchor", "middle")
        .attr("x", (d: CatsDogsBarDatum) => (x1(d.side) ?? 0) + x1.bandwidth() / 2)
        .attr("y", (d: CatsDogsBarDatum) => {
          const target = y(d.value) - 10;
          return Math.max(18, target);
        })
        .text((d: CatsDogsBarDatum) => numberFormatter.format(d.value));
    });
  });
}

function renderCatsDogsLegend(
  legend: HTMLElement,
  matchups: CatsDogsMatchup[],
  colors: { cat: string; dog: string },
): void {
  legend.innerHTML = "";

  if (matchups.length === 0) {
    legend.textContent = "No rivalry details available yet.";
    return;
  }

  const doc = legend.ownerDocument ?? document;
  const totals = computeCatsDogsTotals(matchups);
  const margin = totals.catWins - totals.dogWins;

  const createItem = (label: string, wins: number, color: string, descriptor: "Cats" | "Dogs") => {
    const wrapper = doc.createElement("div");
    wrapper.className = "fun-lab__showdown-legend-item";
    wrapper.dataset.side = descriptor.toLowerCase();

    const swatch = doc.createElement("span");
    swatch.className = "fun-lab__showdown-swatch";
    swatch.style.setProperty("--swatch-color", color);
    wrapper.appendChild(swatch);

    const term = doc.createElement("dt");
    term.textContent = label;
    wrapper.appendChild(term);

    const detail = doc.createElement("dd");
    const note =
      margin === 0
        ? "Level on wins"
        : descriptor === "Cats"
          ? margin > 0
            ? `+${numberFormatter.format(margin)} edge`
            : `${numberFormatter.format(Math.abs(margin))} back`
          : margin < 0
            ? `+${numberFormatter.format(Math.abs(margin))} edge`
            : `${numberFormatter.format(margin)} back`;
    detail.textContent = `${numberFormatter.format(wins)} wins • ${note}`;
    wrapper.appendChild(detail);

    return wrapper;
  };

  legend.appendChild(createItem("Cat mascots", totals.catWins, colors.cat, "Cats"));
  legend.appendChild(createItem("Dog mascots", totals.dogWins, colors.dog, "Dogs"));
}

function renderCatsDogsFootnote(footnote: HTMLElement, payload: CatsDogsPayload): void {
  const lines: string[] = [];
  if (payload.generated_at) {
    const generated = formatGeneratedAt(payload.generated_at).replace(/^Generated/, "Records updated");
    lines.push(generated);
  }
  if (payload.notes && payload.notes.length > 0) {
    lines.push(...payload.notes);
  }
  if (lines.length === 0) {
    lines.push("Records reflect the latest counts available from team releases.");
  }
  footnote.textContent = lines.join(" • ");
}

async function loadArenaFeature(context: ArenaFeatureContext): Promise<void> {
  const { summary, chart, table, handle } = context;
  summary.textContent = "Parsing home-court name trends…";
  chart.textContent = "Crunching arena taxonomy…";

  const expanded = new Set<string>();
  let activeGroup: string | null = null;

  try {
    const payload = await fetchArenaGroupingReport();
    if (payload.totalPrograms <= 0 || payload.groups.length === 0 || payload.records.length === 0) {
      summary.textContent = "No arena naming data available yet.";
      chart.textContent = "No arena naming data available yet.";
      renderArenaTable(table, [], [], new Map(), 0, expanded, null);
      return;
    }

    const groups = [...payload.groups];
    const records = [...payload.records].sort((a, b) => {
      if (a.groupSlug === b.groupSlug) {
        return a.team.localeCompare(b.team, "en-US");
      }
      return a.groupLabel.localeCompare(b.groupLabel, "en-US");
    });

    const chartControls = renderChart(groups, payload.totalPrograms, chart, handle, {
      chartId: "fun-lab-arena-share",
      title: "Arena name type share",
      description: "Donut chart showing the share of arena name types across Division I programs.",
      segmentLabel: "name type",
    });

    const applyGroupFilter = (next: string | null) => {
      const previous = activeGroup;
      activeGroup = next;
      if (next) {
        expanded.clear();
        expanded.add(next);
      } else if (previous) {
        expanded.clear();
      }
      const filtered = next ? records.filter(record => record.groupSlug === next) : records;
      renderArenaTable(table, filtered, groups, chartControls.colorByCategory, payload.totalPrograms, expanded, next);
      chartControls.setActiveCategory(next);
      summary.textContent = describeArenaChartSummary(groups, payload.totalPrograms, next);
    };

    chartControls.onArcToggle(slug => {
      const next = activeGroup === slug ? null : slug;
      applyGroupFilter(next);
    });

    applyGroupFilter(null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    summary.textContent = "We couldn’t load the arena name type index.";
    chart.textContent = `Load error: ${message}`;
    renderArenaTable(table, [], [], new Map(), 0, expanded, null);
  }
}

async function loadCatsDogsFeature(context: CatsDogsFeatureContext): Promise<void> {
  const { section, summary, chart, legend, footnote, handle } = context;
  summary.textContent = "Sizing up rivalry bragging rights…";
  chart.textContent = "Sketching the cat-versus-dog scorecard…";
  legend.textContent = "Building rivalry ledger…";

  try {
    const payload = await fetchCatsDogsShowdowns();
    const sortedMatchups = [...payload.matchups].sort((a, b) => (a.rank - b.rank) || b.total_games - a.total_games);

    const catColor = resolveColor(3, { palette: "warm" });
    const dogColor = resolveColor(2, { palette: "cool" });

    section.style.setProperty("--fun-lab-cat", catColor);
    section.style.setProperty("--fun-lab-dog", dogColor);

    summary.textContent = describeCatsDogsSummary(sortedMatchups);

    const spotlightCount = Math.min(8, sortedMatchups.length);
    const spotlight = sortedMatchups.slice(0, spotlightCount);

    renderCatsDogsColumns(spotlight, chart, handle, {
      catColor,
      dogColor,
    });
    renderCatsDogsLegend(legend, spotlight, { cat: catColor, dog: dogColor });

    renderCatsDogsFootnote(footnote, payload);
    const chartNote =
      sortedMatchups.length > spotlight.length
        ? `Chart spotlights the top ${spotlight.length} rivalries by games played.`
        : `Chart includes every tracked rivalry.`;
    footnote.textContent = footnote.textContent ? `${footnote.textContent} • ${chartNote}` : chartNote;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    summary.textContent = "We couldn’t load the cat-versus-dog rivalry data.";
    chart.textContent = `Load error: ${message}`;
    legend.textContent = "No rivalry details available yet.";
    footnote.textContent = "";
  }
}

async function boot(): Promise<void> {
  if (
    !summaryEl ||
    !chartSummaryEl ||
    !chartRoot ||
    !tableEl ||
    !generatedEl ||
    !catsDogsSection ||
    !catsDogsSummaryEl ||
    !catsDogsChartEl ||
    !catsDogsLegendEl ||
    !catsDogsFootnoteEl ||
    !arenaSummaryEl ||
    !arenaChartEl ||
    !arenaTableEl
  ) {
    throw new Error("Fun Lab layout failed to mount");
  }

  if (!chartHandle || !catsDogsHandle || !arenaHandle) {
    throw new Error("Fun Lab chart containers failed to initialize");
  }

  const chartContainerHandle = chartHandle;
  const summaryNode = summaryEl;
  const chartSummaryNode = chartSummaryEl;
  const chartHost = chartRoot;
  const tableNode = tableEl;
  const generatedNode = generatedEl;
  const catsDogsSectionNode = catsDogsSection;
  const catsDogsSummaryNode = catsDogsSummaryEl;
  const catsDogsChartNode = catsDogsChartEl;
  const catsDogsLegendNode = catsDogsLegendEl;
  const catsDogsFootnoteNode = catsDogsFootnoteEl;
  const arenaSummaryNode = arenaSummaryEl;
  const arenaChartNode = arenaChartEl;
  const arenaTableNode = arenaTableEl;
  const arenaChartHandle = arenaHandle;

  let activeCategory: string | null = null;

  try {
    const data = await fetchMascotIndex();
    summaryNode.textContent = describeSummary(data);
    generatedNode.textContent = formatGeneratedAt(data.generated_at);

    const categories = [...data.categories].sort((a, b) => b.count - a.count);
    const chartControls = renderChart(categories, data.total_programs, chartHost, chartContainerHandle);

    const sortedRecords = [...data.records].sort((a, b) => {
      if (a.category === b.category) {
        return a.full_name.localeCompare(b.full_name, "en-US");
      }
      return a.category_label.localeCompare(b.category_label, "en-US");
    });

    const handleCategoryToggle = (slug: string) => {
      const next = activeCategory === slug ? null : slug;
      applyCategoryFilter(next);
    };

    function applyCategoryFilter(next: string | null) {
      const previous = activeCategory;
      activeCategory = next;
      if (next) {
        expandedGroups.clear();
        expandedGroups.add(next);
      } else if (previous) {
        expandedGroups.clear();
      }
      const filteredRecords = next ? sortedRecords.filter(record => record.category === next) : sortedRecords;
      renderGroupedTable(
        tableNode,
        filteredRecords,
        categories,
        chartControls.colorByCategory,
        data.total_programs,
        expandedGroups,
        next,
      );
      chartControls.setActiveCategory(next);
      chartSummaryNode.textContent = describeChartSummary(categories, data.total_programs, next);
    }

    chartControls.onArcToggle(handleCategoryToggle);
    applyCategoryFilter(null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    summaryNode.textContent = "We couldn’t load the mascot index. Try refreshing to replay the experiment.";
    chartSummaryNode.textContent = `Load error: ${message}`;
    chartHost.textContent = "No chart data";
    const body = tableNode.tBodies[0] ?? tableNode.createTBody();
    body.innerHTML = "";
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = tableNode.tHead?.rows[0]?.cells.length ?? 5;
    cell.className = "fun-lab__cell fun-lab__cell--empty";
    cell.textContent = "No programs match this filter yet.";
  }

  await Promise.all([
    loadCatsDogsFeature({
      section: catsDogsSectionNode,
      summary: catsDogsSummaryNode,
      chart: catsDogsChartNode,
      legend: catsDogsLegendNode,
      footnote: catsDogsFootnoteNode,
      handle: catsDogsHandle,
    }),
    loadArenaFeature({
      summary: arenaSummaryNode,
      chart: arenaChartNode,
      table: arenaTableNode,
      handle: arenaChartHandle,
    }),
  ]);
}

void boot();
