import { NCAAM, type Team } from "../lib/sdk/ncaam.js";
import { getConferenceMap } from "../lib/sdk/directory.js";
import {
  getTeamAccentColors,
  getTeamLogoUrl,
  getTeamMonogram,
} from "../lib/ui/logos.js";

type TeamLocation = {
  team: string;
  arena: string;
  latitude: number;
  longitude: number;
  elevation_ft?: number | null;
};

type TeamSummary = {
  team: string;
  seasons: number;
  firstYear: number | null;
  lastYear: number | null;
  conferences: string[];
  averages: {
    wins: number | null;
    losses: number | null;
    adjO: number | null;
    adjD: number | null;
    barthag: number | null;
    tempo: number | null;
  };
  postseason: {
    appearances: number;
    bestFinish: string | null;
  };
  bestSeason: {
    year: number | null;
    wins: number | null;
    losses: number | null;
    postseason: string | null;
    seed: number | null;
    wab: number | null;
    adjO: number | null;
    adjD: number | null;
    barthag: number | null;
  } | null;
  recentSeason: {
    year: number | null;
    wins: number | null;
    losses: number | null;
    postseason: string | null;
    seed: number | null;
    wab: number | null;
    adjO: number | null;
    adjD: number | null;
    barthag: number | null;
  } | null;
};

type TeamCardData = Team & {
  conference: string;
  logoUrl?: string;
  accentPrimary: string;
  accentSecondary: string;
  monogram: string;
  location?: TeamLocation;
  stats?: TeamSummary;
};

const app = document.getElementById("app")!;
app.innerHTML = `<div class="stack" data-gap="lg">
  <section class="teams-map card">
    <div class="teams-map__header">
      <div class="teams-map__intro">
        <h2 class="teams-map__title">Division I home map</h2>
        <p class="teams-map__subtitle">Hover or focus to preview each program's arena and click to jump to its card.</p>
      </div>
      <span class="teams-map__count" aria-live="polite"></span>
    </div>
    <div id="team-map" class="teams-map__viewport" role="presentation"></div>
  </section>
  <section class="teams-directory stack" data-gap="sm">
    <input id="team-search" class="search" type="search" placeholder="Filter name or conference" aria-label="Filter teams by name or conference" autocomplete="off">
    <div id="list" class="conference-groups"></div>
  </section>
</div>`;

const input = app.querySelector("#team-search") as HTMLInputElement;
const list = app.querySelector("#list") as HTMLElement;
const mapRoot = app.querySelector("#team-map") as HTMLElement | null;
const mapCount = app.querySelector(".teams-map__count") as HTMLElement | null;

const dataUrl = (path: string) => new URL(path, import.meta.url).toString();

const [teamsResponse, conferenceMap, locationRecords, teamSummaries] = await Promise.all([
  NCAAM.teams(1, 400),
  getConferenceMap(),
  fetch(dataUrl("../../data/team_home_locations.json"))
    .then(res => {
      if (!res.ok) throw new Error(`Failed to load team home locations (${res.status})`);
      return res.json() as Promise<TeamLocation[]>;
    })
    .catch(() => []),
  fetch(dataUrl("../../data/cbb/cbb-summary.json"))
    .then(res => {
      if (!res.ok) throw new Error(`Failed to load team stat summaries (${res.status})`);
      return res.json() as Promise<Record<string, TeamSummary>>;
    })
    .catch(() => ({} as Record<string, TeamSummary>)),
]);

const locationTransforms = [
  (value: string) => value.replace(/\u2013/g, "-"),
  (value: string) => value.replace(/&/g, "and"),
  (value: string) => value.replace(/A\s*&\s*M/gi, "A and M"),
  (value: string) => value.replace(/\bUniv\.?\b/gi, "University"),
  (value: string) => value.replace(/\bU\.?\b/gi, "University"),
  (value: string) => value.replace(/\bIntl\.?\b/gi, "International"),
  (value: string) => value.replace(/\bInt\.?\b/gi, "International"),
  (value: string) => value.replace(/\bMt\.?\b/gi, "Mount"),
  (value: string) => value.replace(/\bCal St\.?\b/gi, "California State"),
  (value: string) => value.replace(/\bApp St\b/gi, "Appalachian State"),
  (value: string) => value.replace(/\bGa\.?\b/gi, "Georgia"),
  (value: string) => value.replace(/\bN\.?\b/gi, "North"),
  (value: string) => value.replace(/\bS\.?\b/gi, "South"),
  (value: string) => value.replace(/\bE\.?\b/gi, "East"),
  (value: string) => value.replace(/\bW\.?\b/gi, "West"),
  (value: string) => value.replace(/\bSt\.?\b/gi, "State"),
  (value: string) => value.replace(/\bSt\.?\b/gi, "Saint"),
];

function normalizeLabel(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "");
}

function buildLocationKeys(label: string) {
  const queue = [label];
  const seen = new Set<string>();
  for (let i = 0; i < queue.length; i += 1) {
    const value = queue[i];
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    for (const transform of locationTransforms) {
      const next = transform(value);
      if (!seen.has(next)) {
        queue.push(next);
      }
    }
  }
  const keys = new Set<string>();
  for (const value of seen) {
    const normalized = normalizeLabel(value);
    if (normalized) {
      keys.add(normalized);
    }
  }
  return Array.from(keys);
}

function getSchoolName(team: Team) {
  const { full_name, name } = team;
  if (full_name?.toLowerCase().endsWith(name.toLowerCase())) {
    return full_name.slice(0, full_name.length - name.length).trim();
  }
  return team.college ?? full_name;
}

function buildTeamKeys(team: Team) {
  const base = [
    team.college,
    getSchoolName(team),
    team.full_name,
    team.full_name.replace(/\bmen's\s+/i, ""),
  ];
  const keys = new Set<string>();
  for (const value of base) {
    if (!value) {
      continue;
    }
    const prepared = value.replace(/\u2013/g, "-");
    keys.add(normalizeLabel(prepared));
    keys.add(normalizeLabel(prepared.replace(/State University/i, "State")));
    keys.add(normalizeLabel(prepared.replace(/University of /i, "")));
  }
  return Array.from(keys).filter(Boolean);
}

const locationIndex = new Map<string, TeamLocation>();
for (const record of locationRecords) {
  const keys = buildLocationKeys(record.team);
  for (const key of keys) {
    if (!locationIndex.has(key)) {
      locationIndex.set(key, record);
    }
  }
}
const locationKeys = Array.from(locationIndex.keys());

const summaryIndex = new Map<string, TeamSummary>();
for (const [label, summary] of Object.entries(teamSummaries)) {
  const keys = buildLocationKeys(label);
  for (const key of keys) {
    if (!summaryIndex.has(key)) {
      summaryIndex.set(key, summary);
    }
  }
}
const summaryKeys = Array.from(summaryIndex.keys());

const data: TeamCardData[] = teamsResponse.data.map(team => {
  const conference = team.conference ?? (() => {
    const lookup = team.conference_id ? conferenceMap.get(team.conference_id) : undefined;
    return lookup?.short_name ?? lookup?.name;
  })();
  const [accentPrimary, accentSecondary] = getTeamAccentColors(team);
  const keys = buildTeamKeys(team);
  let location: TeamLocation | undefined;
  let stats: TeamSummary | undefined;
  for (const key of keys) {
    const hit = locationIndex.get(key);
    if (hit) {
      location = hit;
      break;
    }
  }
  if (!location) {
    for (const key of keys) {
      const fallbackKey = locationKeys.find(locKey => locKey.endsWith(key) || key.endsWith(locKey));
      if (fallbackKey) {
        location = locationIndex.get(fallbackKey);
        break;
      }
    }
  }
  for (const key of keys) {
    const hit = summaryIndex.get(key);
    if (hit) {
      stats = hit;
      break;
    }
  }
  if (!stats) {
    for (const key of keys) {
      const fallbackKey = summaryKeys.find(summaryKey => summaryKey.endsWith(key) || key.endsWith(summaryKey));
      if (fallbackKey) {
        stats = summaryIndex.get(fallbackKey);
        break;
      }
    }
  }
  return {
    ...team,
    conference: conference ?? "N/A",
    logoUrl: getTeamLogoUrl(team),
    accentPrimary,
    accentSecondary,
    monogram: getTeamMonogram(team),
    location,
    stats,
  };
});

const integerFormatter = new Intl.NumberFormat();
const oneDecimalFormatter = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const twoDecimalFormatter = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const threeDecimalFormatter = new Intl.NumberFormat(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

function formatNumber(value: number | null | undefined, formatter: Intl.NumberFormat) {
  return value == null ? null : formatter.format(value);
}

function formatRecord(wins: number | null | undefined, losses: number | null | undefined, { decimals = 0 } = {}) {
  const formatter = decimals > 0 ? oneDecimalFormatter : integerFormatter;
  const winsLabel = wins == null ? null : formatter.format(wins);
  const lossesLabel = losses == null ? null : formatter.format(losses);
  if (winsLabel && lossesLabel) {
    return `${winsLabel}-${lossesLabel}`;
  }
  if (winsLabel) {
    return `${winsLabel}-?`;
  }
  if (lossesLabel) {
    return `?- ${lossesLabel}`;
  }
  return null;
}

function formatSeasonRange(stats?: TeamSummary) {
  if (!stats) {
    return null;
  }
  const { firstYear, lastYear, seasons } = stats;
  let label: string | null = null;
  if (firstYear && lastYear && firstYear !== lastYear) {
    label = `${firstYear}–${lastYear}`;
  } else if (firstYear) {
    label = String(firstYear);
  } else if (lastYear) {
    label = String(lastYear);
  }
  if (label && seasons) {
    return `${label} · ${integerFormatter.format(seasons)} season${seasons === 1 ? "" : "s"}`;
  }
  if (seasons) {
    return `${integerFormatter.format(seasons)} season${seasons === 1 ? "" : "s"}`;
  }
  return label;
}

type SeasonSnapshot = TeamSummary["bestSeason"];

function formatSeasonSummary(season: SeasonSnapshot) {
  if (!season) {
    return null;
  }
  const parts: string[] = [];
  if (season.year != null) {
    parts.push(String(season.year));
  }
  const record = formatRecord(season.wins, season.losses);
  if (record) {
    parts.push(record);
  }
  if (season.postseason) {
    parts.push(season.postseason);
  }
  if (season.seed != null) {
    parts.push(`Seed ${integerFormatter.format(season.seed)}`);
  }
  if (season.wab != null) {
    const wab = formatNumber(season.wab, twoDecimalFormatter);
    if (wab) {
      parts.push(`${wab} WAB`);
    }
  }
  if (season.barthag != null) {
    const barthag = formatNumber(season.barthag, threeDecimalFormatter);
    if (barthag) {
      parts.push(`${barthag} BARTHAG`);
    }
  }
  return parts.join(" · ");
}

function renderStat(label: string, value: string | null | undefined) {
  const display = typeof value === "string" ? value.trim() : value;
  const content = display != null && display !== "" ? display : "—";
  return `<div class="team-card__stat"><dt>${label}</dt><dd>${content}</dd></div>`;
}

function renderTeamStats(team: TeamCardData) {
  const stats = team.stats;
  if (!stats) {
    return `<p class="team-card__stats team-card__stats--empty">No archived efficiency data for this program.</p>`;
  }
  const seasons = formatSeasonRange(stats);
  const averageRecord = formatRecord(stats.averages.wins, stats.averages.losses, { decimals: 1 });
  const efficiencyParts: string[] = [];
  const adjO = formatNumber(stats.averages.adjO, oneDecimalFormatter);
  const adjD = formatNumber(stats.averages.adjD, oneDecimalFormatter);
  if (adjO && adjD) {
    efficiencyParts.push(`${adjO} / ${adjD} AdjO·AdjD`);
  } else if (adjO) {
    efficiencyParts.push(`${adjO} AdjO`);
  } else if (adjD) {
    efficiencyParts.push(`${adjD} AdjD`);
  }
  const barthag = formatNumber(stats.averages.barthag, threeDecimalFormatter);
  if (barthag) {
    efficiencyParts.push(`${barthag} BARTHAG`);
  }
  const tempo = formatNumber(stats.averages.tempo, oneDecimalFormatter);
  if (tempo) {
    efficiencyParts.push(`${tempo} tempo`);
  }
  const efficiency = efficiencyParts.join(" · ") || null;
  const postseasonSummary = stats.postseason.appearances > 0
    ? `${integerFormatter.format(stats.postseason.appearances)} NCAA bid${stats.postseason.appearances === 1 ? "" : "s"}${stats.postseason.bestFinish ? ` · Best: ${stats.postseason.bestFinish}` : ""}`
    : (stats.postseason.bestFinish ? `Best finish: ${stats.postseason.bestFinish}` : null);
  const bestSeason = formatSeasonSummary(stats.bestSeason);
  const recentSeason = formatSeasonSummary(stats.recentSeason);

  return `<dl class="team-card__stats">
    ${renderStat("Seasons tracked", seasons)}
    ${renderStat("Average record", averageRecord)}
    ${renderStat("Average efficiency", efficiency)}
    ${renderStat("Tournament resume", postseasonSummary)}
    ${renderStat("Best season", bestSeason)}
    ${renderStat("Most recent season", recentSeason)}
  </dl>`;
}

const teamsWithLocations = data.filter(team => team.location);
if (mapCount) {
  mapCount.textContent = teamsWithLocations.length > 0
    ? `${teamsWithLocations.length} home arenas mapped`
    : "Home location data unavailable";
}

const scriptCache = new Map<string, Promise<unknown>>();

async function loadScript(src: string, globalName: string) {
  const existing = (window as unknown as Record<string, unknown>)[globalName];
  if (existing) {
    return existing;
  }
  if (scriptCache.has(src)) {
    return scriptCache.get(src)!;
  }
  const promise = new Promise<unknown>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => {
      const globalValue = (window as unknown as Record<string, unknown>)[globalName];
      if (globalValue) {
        resolve(globalValue);
      } else {
        reject(new Error(`Failed to load ${globalName} from ${src}`));
      }
    };
    el.onerror = () => reject(new Error(`Failed to load script ${src}`));
    document.head.appendChild(el);
  });
  scriptCache.set(src, promise);
  return promise;
}

function render(q = "") {
  const ql = q.trim().toLowerCase();
  const openSet = new Set<string>(
    Array.from(list.querySelectorAll<HTMLDetailsElement>("details[open]"))
      .map(details => details.dataset.conference || "")
      .filter(Boolean)
  );

  const groups = new Map<string, TeamCardData[]>();

  for (const team of data) {
    const haystack = `${team.full_name} ${team.name} ${team.conference ?? ""}`.toLowerCase();
    if (ql && !haystack.includes(ql)) {
      continue;
    }

    const conference = team.conference ?? "N/A";
    if (!groups.has(conference)) {
      groups.set(conference, []);
    }
    groups.get(conference)!.push(team);
  }

  if (groups.size === 0) {
    list.innerHTML = `<p class="empty-state">No teams match your search.</p>`;
    return;
  }

  const sections = Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([conference, teams]) => {
      teams.sort((a, b) => a.full_name.localeCompare(b.full_name));
      const isOpen = openSet.has(conference) || ql.length > 0;
      return `<details class="conference" data-conference="${conference}"${isOpen ? " open" : ""}>
  <summary><span>${conference}</span><span class="count">${teams.length}</span></summary>
  <div class="group grid cols-3">
    ${teams
      .map(team => {
        const logo = team.logoUrl
          ? `<img class="team-card__logo-image" src="${team.logoUrl}" alt="${team.full_name} logo" loading="lazy" decoding="async">`
          : `<span class="team-card__logo-placeholder" aria-hidden="true" style="--team-accent:${team.accentPrimary}; --team-accent-secondary:${team.accentSecondary};">${team.monogram}</span>`;
        const meta = team.abbreviation ? `${team.conference} · ${team.abbreviation}` : team.conference;
        const stats = renderTeamStats(team);
        return `<article class="card team-card" tabindex="-1" data-team-id="${team.id}" id="team-${team.id}">
  <div class="team-card__logo">${logo}</div>
  <div class="team-card__body">
    <strong class="team-card__name">${team.full_name}</strong>
    <span class="team-card__meta">${meta}</span>
    ${stats}
  </div>
</article>`;
      })
      .join("")}
  </div>
</details>`;
    });

  list.innerHTML = sections.join("");
}

render();
input.addEventListener("input", () => render(input.value));

function ensureCard(teamId: number) {
  let card = list.querySelector<HTMLElement>(`.team-card[data-team-id="${teamId}"]`);
  if (card || !input.value) {
    return card;
  }
  input.value = "";
  render();
  card = list.querySelector<HTMLElement>(`.team-card[data-team-id="${teamId}"]`);
  return card ?? undefined;
}

let highlightTimer: number | undefined;

function openTeamCard(teamId: number, { focus }: { focus?: boolean } = {}) {
  const card = ensureCard(teamId);
  if (!card) {
    return;
  }
  const details = card.closest("details");
  if (details && !details.open) {
    details.open = true;
  }
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  if (focus) {
    card.focus({ preventScroll: true });
  }
  card.classList.add("team-card--active");
  if (highlightTimer) {
    window.clearTimeout(highlightTimer);
  }
  highlightTimer = window.setTimeout(() => {
    card.classList.remove("team-card--active");
  }, 1600);
}

async function renderMap(teams: TeamCardData[]) {
  if (!mapRoot || teams.length === 0) {
    return;
  }

  mapRoot.innerHTML = "";
  const tooltip = document.createElement("div");
  tooltip.className = "teams-map__tooltip";
  tooltip.setAttribute("role", "status");
  tooltip.hidden = true;
  mapRoot.appendChild(tooltip);

  const [d3, topojson, topo] = await Promise.all([
    loadScript(new URL("../../vendor/d3.v7.min.js", import.meta.url).toString(), "d3") as Promise<typeof import("d3")>,
    loadScript(new URL("../../vendor/topojson-client.v3.min.js", import.meta.url).toString(), "topojson"),
    fetch(dataUrl("../../data/us-states-10m.json")).then(res => {
      if (!res.ok) throw new Error(`Failed to load US map (${res.status})`);
      return res.json();
    }),
  ]);

  const topoData = topo as { objects: Record<string, unknown> };
  const topoClient = topojson as { feature: (src: unknown, obj: { type: string }) => { features?: unknown[] } };
  const states = topoClient.feature(topoData, topoData.objects.states as { type: string }) as { features?: unknown[] };

  const width = 960;
  const height = 600;
  const projection = (d3 as typeof import("d3")).geoAlbersUsa().fitExtent([[24, 24], [width - 24, height - 40]], states as unknown as any);
  const path = (d3 as typeof import("d3")).geoPath(projection);

  const svg = (d3 as typeof import("d3")).select(mapRoot)
    .append("svg")
    .attr("class", "teams-map__svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Map of Division I men's basketball home arenas");

  svg.append("g")
    .selectAll("path")
    .data((states.features ?? []) as unknown[])
    .join("path")
    .attr("class", "teams-map__state")
    .attr("d", path as unknown as (d: unknown) => string);

  const points = svg.append("g");

  const showTooltip = (circle: SVGCircleElement, label: string) => {
    const mapBounds = mapRoot.getBoundingClientRect();
    const circleBounds = circle.getBoundingClientRect();
    tooltip.textContent = label;
    tooltip.style.left = `${circleBounds.left + circleBounds.width / 2 - mapBounds.left}px`;
    tooltip.style.top = `${circleBounds.top - mapBounds.top}px`;
    tooltip.hidden = false;
  };

  const hideTooltip = () => {
    tooltip.hidden = true;
  };

  points.selectAll("circle")
    .data(teams)
    .join("circle")
    .attr("class", "teams-map__dot")
    .attr("tabindex", 0)
    .attr("data-team-id", (team: TeamCardData) => String(team.id))
    .attr("r", 5)
    .each(function (this: SVGCircleElement, team: TeamCardData) {
      const { location } = team;
      if (!location) {
        return;
      }
      const coords = projection([location.longitude, location.latitude]);
      if (!coords) {
        (this as SVGCircleElement).style.display = "none";
        return;
      }
      (d3 as typeof import("d3")).select(this)
        .attr("cx", coords[0])
        .attr("cy", coords[1])
        .attr("fill", team.accentPrimary)
        .attr("stroke", "rgba(255,255,255,0.9)")
        .attr("stroke-width", 1.2);
    })
    .on("pointerenter", function (this: SVGCircleElement, event: PointerEvent, team: TeamCardData) {
      if (!team.location) {
        return;
      }
      (this as SVGCircleElement).classList.add("is-hovered");
      showTooltip(this as SVGCircleElement, `${team.full_name} · ${team.location.arena}`);
    })
    .on("pointermove", function (this: SVGCircleElement, event: PointerEvent, team: TeamCardData) {
      if (!team.location || tooltip.hidden) {
        return;
      }
      showTooltip(this as SVGCircleElement, `${team.full_name} · ${team.location.arena}`);
    })
    .on("pointerleave", function (this: SVGCircleElement) {
      (this as SVGCircleElement).classList.remove("is-hovered");
      hideTooltip();
    })
    .on("focus", function (this: SVGCircleElement, event: FocusEvent, team: TeamCardData) {
      if (!team.location) {
        return;
      }
      (this as SVGCircleElement).classList.add("is-hovered");
      showTooltip(this as SVGCircleElement, `${team.full_name} · ${team.location.arena}`);
    })
    .on("blur", function (this: SVGCircleElement) {
      (this as SVGCircleElement).classList.remove("is-hovered");
      hideTooltip();
    })
    .on("click", function (this: SVGCircleElement, event: MouseEvent, team: TeamCardData) {
      event.preventDefault();
      openTeamCard(team.id, { focus: true });
    })
    .on("keydown", function (this: SVGCircleElement, event: KeyboardEvent, team: TeamCardData) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openTeamCard(team.id, { focus: true });
      }
    });
}

renderMap(teamsWithLocations).catch(() => {
  if (mapRoot) {
    mapRoot.innerHTML = `<p class="teams-map__fallback">Interactive map unavailable right now.</p>`;
  }
});
