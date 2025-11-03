import { buildProgramLabelKeys, buildTeamKeys } from "../lib/data/program-keys.js";
import { getDivisionOneProgramIndex, isDivisionOneProgram, } from "../lib/data/division-one.js";
import { NCAAM } from "../lib/sdk/ncaam.js";
import { getConferenceMap } from "../lib/sdk/directory.js";
import { getTeamAccentColors, getTeamLogoUrl, getTeamMonogram, } from "../lib/ui/logos.js";
const app = document.getElementById("app");
app.innerHTML = `<div class="stack" data-gap="lg">
  <section class="teams-map card stack" data-gap="md">
    <div class="teams-map__header">
      <div class="teams-map__intro">
        <h2 class="teams-map__title">Division I home map</h2>
        <p class="teams-map__subtitle">Hover or focus to preview each program's arena and click to jump to its card.</p>
      </div>
      <span class="teams-map__count" aria-live="polite"></span>
    </div>
    <div id="team-map" class="teams-map__viewport" role="presentation"></div>
  </section>
  <section class="teams-directory card stack" data-gap="md">
    <header class="stack" data-gap="xs">
      <h2 class="section-title">Conference &amp; team directory</h2>
      <p class="section-summary">Filter by name or conference to jump between program cards.</p>
    </header>
    <input id="team-search" class="search" type="search" placeholder="Filter name or conference" aria-label="Filter teams by name or conference" autocomplete="off">
    <div id="list" class="conference-groups stack" data-gap="sm"></div>
  </section>
</div>`;
const input = app.querySelector("#team-search");
const list = app.querySelector("#list");
const mapRoot = app.querySelector("#team-map");
const mapCount = app.querySelector(".teams-map__count");
const dataUrl = (path) => new URL(path, import.meta.url).toString();
const [teamsResponse, conferenceMap, locationRecordsRaw, teamSummariesRaw, divisionOneIndex] = await Promise.all([
    NCAAM.teams(1, 600),
    getConferenceMap(),
    fetch(dataUrl("../../data/team_home_locations.json"))
        .then(res => {
        if (!res.ok)
            throw new Error(`Failed to load team home locations (${res.status})`);
        return res.json();
    })
        .catch(() => []),
    fetch(dataUrl("../../data/cbb/cbb-summary.json"))
        .then(res => {
        if (!res.ok)
            throw new Error(`Failed to load team stat summaries (${res.status})`);
        return res.json();
    })
        .catch(() => ({})),
    getDivisionOneProgramIndex(),
]);
const locationRecords = locationRecordsRaw.filter(record => isDivisionOneProgram(record.team, divisionOneIndex));
const teamSummaries = Object.fromEntries(Object.entries(teamSummariesRaw).filter(([label]) => isDivisionOneProgram(label, divisionOneIndex)));
const divisionOneTeams = teamsResponse.data.filter(team => {
    const keys = buildTeamKeys(team);
    return keys.some(key => divisionOneIndex.keys.has(key));
});
const locationIndex = new Map();
for (const record of locationRecords) {
    const keys = buildProgramLabelKeys(record.team);
    for (const key of keys) {
        if (!locationIndex.has(key)) {
            locationIndex.set(key, record);
        }
    }
}
const locationKeys = Array.from(locationIndex.keys());
const summaryIndex = new Map();
for (const [label, summary] of Object.entries(teamSummaries)) {
    const keys = buildProgramLabelKeys(label);
    for (const key of keys) {
        if (!summaryIndex.has(key)) {
            summaryIndex.set(key, summary);
        }
    }
}
const summaryKeys = Array.from(summaryIndex.keys());
const data = divisionOneTeams.map(team => {
    const conference = team.conference ?? (() => {
        const lookup = team.conference_id ? conferenceMap.get(team.conference_id) : undefined;
        return lookup?.short_name ?? lookup?.name;
    })();
    const [accentPrimary, accentSecondary] = getTeamAccentColors(team);
    const keys = buildTeamKeys(team);
    let location;
    let stats;
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
function formatNumber(value, formatter) {
    return value == null ? null : formatter.format(value);
}
function formatRecord(wins, losses, { decimals = 0 } = {}) {
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
function formatSeasonRange(stats) {
    if (!stats) {
        return null;
    }
    const { firstYear, lastYear, seasons } = stats;
    let label = null;
    if (firstYear && lastYear && firstYear !== lastYear) {
        label = `${firstYear}–${lastYear}`;
    }
    else if (firstYear) {
        label = String(firstYear);
    }
    else if (lastYear) {
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
function formatSeasonSummary(season) {
    if (!season) {
        return null;
    }
    const parts = [];
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
function renderStat(label, value) {
    const display = typeof value === "string" ? value.trim() : value;
    const content = display != null && display !== "" ? display : "—";
    return `<div class="team-card__stat"><dt>${label}</dt><dd>${content}</dd></div>`;
}
function renderTeamStats(team) {
    const stats = team.stats;
    if (!stats) {
        return `<p class="team-card__stats team-card__stats--empty">No archived efficiency data for this program.</p>`;
    }
    const seasons = formatSeasonRange(stats);
    const averageRecord = formatRecord(stats.averages.wins, stats.averages.losses, { decimals: 1 });
    const efficiencyParts = [];
    const adjO = formatNumber(stats.averages.adjO, oneDecimalFormatter);
    const adjD = formatNumber(stats.averages.adjD, oneDecimalFormatter);
    if (adjO && adjD) {
        efficiencyParts.push(`${adjO} / ${adjD} AdjO·AdjD`);
    }
    else if (adjO) {
        efficiencyParts.push(`${adjO} AdjO`);
    }
    else if (adjD) {
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
const scriptCache = new Map();
async function loadScript(src, globalName) {
    const existing = window[globalName];
    if (existing) {
        return existing;
    }
    if (scriptCache.has(src)) {
        return scriptCache.get(src);
    }
    const promise = new Promise((resolve, reject) => {
        const el = document.createElement("script");
        el.src = src;
        el.async = true;
        el.onload = () => {
            const globalValue = window[globalName];
            if (globalValue) {
                resolve(globalValue);
            }
            else {
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
    const openSet = new Set(Array.from(list.querySelectorAll("details[open]"))
        .map(details => details.dataset.conference || "")
        .filter(Boolean));
    const groups = new Map();
    for (const team of data) {
        const haystack = `${team.full_name} ${team.name} ${team.conference ?? ""}`.toLowerCase();
        if (ql && !haystack.includes(ql)) {
            continue;
        }
        const conference = team.conference ?? "N/A";
        if (!groups.has(conference)) {
            groups.set(conference, []);
        }
        groups.get(conference).push(team);
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
        return `<details class="conference-card card" data-conference="${conference}"${isOpen ? " open" : ""}>
  <summary class="conference-card__summary">
    <span class="conference-card__label">${conference}</span>
    <span class="conference-card__meta">
      <span class="conference-card__count" aria-label="${teams.length} teams">${teams.length}</span>
      <span class="conference-card__chevron" aria-hidden="true"></span>
    </span>
  </summary>
  <div class="conference-card__body">
    <div class="conference-card__group grid cols-3">
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
  </div>
</details>`;
    });
    list.innerHTML = sections.join("");
}
render();
input.addEventListener("input", () => render(input.value));
function ensureCard(teamId) {
    let card = list.querySelector(`.team-card[data-team-id="${teamId}"]`);
    if (card || !input.value) {
        return card;
    }
    input.value = "";
    render();
    card = list.querySelector(`.team-card[data-team-id="${teamId}"]`);
    return card ?? undefined;
}
let highlightTimer;
function openTeamCard(teamId, { focus } = {}) {
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
async function renderMap(teams) {
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
        loadScript(new URL("../../vendor/d3.v7.min.js", import.meta.url).toString(), "d3"),
        loadScript(new URL("../../vendor/topojson-client.v3.min.js", import.meta.url).toString(), "topojson"),
        fetch(dataUrl("../../data/us-states-10m.json")).then(res => {
            if (!res.ok)
                throw new Error(`Failed to load US map (${res.status})`);
            return res.json();
        }),
    ]);
    const topoData = topo;
    const topoClient = topojson;
    const states = topoClient.feature(topoData, topoData.objects.states);
    const width = 960;
    const height = 600;
    const projection = d3.geoAlbersUsa().fitExtent([[24, 24], [width - 24, height - 40]], states);
    const path = d3.geoPath(projection);
    const svg = d3.select(mapRoot)
        .append("svg")
        .attr("class", "teams-map__svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "img")
        .attr("aria-label", "Map of Division I men's basketball home arenas");
    svg.append("g")
        .selectAll("path")
        .data((states.features ?? []))
        .join("path")
        .attr("class", "teams-map__state")
        .attr("d", path);
    const points = svg.append("g");
    const showTooltip = (circle, label) => {
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
        .attr("data-team-id", (team) => String(team.id))
        .attr("r", 5)
        .each(function (team) {
        const { location } = team;
        if (!location) {
            return;
        }
        const coords = projection([location.longitude, location.latitude]);
        if (!coords) {
            this.style.display = "none";
            return;
        }
        d3.select(this)
            .attr("cx", coords[0])
            .attr("cy", coords[1])
            .attr("fill", team.accentPrimary)
            .attr("stroke", "rgba(255,255,255,0.9)")
            .attr("stroke-width", 1.2);
    })
        .on("pointerenter", function (event, team) {
        if (!team.location) {
            return;
        }
        this.classList.add("is-hovered");
        showTooltip(this, `${team.full_name} · ${team.location.arena}`);
    })
        .on("pointermove", function (event, team) {
        if (!team.location || tooltip.hidden) {
            return;
        }
        showTooltip(this, `${team.full_name} · ${team.location.arena}`);
    })
        .on("pointerleave", function () {
        this.classList.remove("is-hovered");
        hideTooltip();
    })
        .on("focus", function (event, team) {
        if (!team.location) {
            return;
        }
        this.classList.add("is-hovered");
        showTooltip(this, `${team.full_name} · ${team.location.arena}`);
    })
        .on("blur", function () {
        this.classList.remove("is-hovered");
        hideTooltip();
    })
        .on("click", function (event, team) {
        event.preventDefault();
        openTeamCard(team.id, { focus: true });
    })
        .on("keydown", function (event, team) {
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
