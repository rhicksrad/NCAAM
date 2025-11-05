import { setChartDefaults } from "../lib/charts/defaults.js";
import { buildProgramLabelKeys, buildTeamKeys } from "../lib/data/program-keys.js";
import { getDivisionOneProgramIndex, isDivisionOneProgram, } from "../lib/data/division-one.js";
import { NCAAM } from "../lib/sdk/ncaam.js";
import { getConferenceMap } from "../lib/sdk/directory.js";
import { geoAlbersUsa, geoPath, select } from "../lib/vendor/d3-bundle.js";
import { getConferenceLogoUrl, getConferenceMonogram, getTeamAccentColors, getTeamLogoUrl, getTeamMonogram, } from "../lib/ui/logos.js";
import { requireOk } from "../lib/health.js";
const app = document.getElementById("app");
setChartDefaults();
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
      <p class="section-footnote"><strong>BARTHAG</strong> is Bart Torvik's predictive power rating — higher values indicate stronger all-around teams.</p>
    </header>
    <input id="team-search" class="search" type="search" placeholder="Filter name or conference" aria-label="Filter teams by name or conference" autocomplete="off">
    <div id="list" class="conference-groups stack" data-gap="sm"></div>
  </section>
  <section class="teams-leaderboard stack" data-gap="md">
    <header class="feature-card card stack" data-gap="xs">
      <h2 class="feature-card__title">Program efficiency leaderboards</h2>
      <p id="teams-leaderboard-meta" class="feature-card__meta">Compiling program efficiency leaderboards…</p>
    </header>
    <div id="teams-leaderboard" class="teams-leaderboard__grid" aria-live="polite"></div>
  </section>
</div>`;
const input = app.querySelector("#team-search");
const list = app.querySelector("#list");
const mapRoot = app.querySelector("#team-map");
const mapCount = app.querySelector(".teams-map__count");
const leaderboardRoot = app.querySelector("#teams-leaderboard");
const leaderboardMeta = app.querySelector("#teams-leaderboard-meta");
const [teamsResponse, conferenceMap, locationRecordsRaw, teamSummariesRaw, divisionOneIndex] = await Promise.all([
    NCAAM.teams(1, 600),
    getConferenceMap(),
    requireOk("data/team_home_locations.json", "Teams")
        .then(res => res.json())
        .catch(error => {
        console.error(error);
        return [];
    }),
    requireOk("data/cbb/cbb-summary.json", "Teams")
        .then(res => res.json())
        .catch(error => {
        console.error(error);
        return {};
    }),
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
const conferenceIdentities = new Map();
function normalizeConferenceKey(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]+/g, "")
        .replace(/[^0-9A-Za-z\s]+/g, " ")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");
}
function ensureConferenceIdentity(team) {
    const conferenceRecord = team.conference_id != null ? conferenceMap.get(team.conference_id) : undefined;
    const rawConference = team.conference && team.conference !== "N/A" ? team.conference : null;
    const name = conferenceRecord?.name ?? rawConference ?? "Independent";
    const shortName = conferenceRecord?.short_name ?? (rawConference && rawConference !== name ? rawConference : null);
    const key = conferenceRecord ? `id-${conferenceRecord.id}` : `name-${normalizeConferenceKey(name || "conference")}`;
    const existing = conferenceIdentities.get(key);
    if (existing) {
        if (!existing.logoUrl) {
            const aliasSet = new Set([existing.name, existing.shortName ?? "", rawConference ?? ""]);
            const logoUrl = getConferenceLogoUrl(existing.name, {
                shortName: existing.shortName,
                aliases: Array.from(aliasSet).filter(Boolean),
            });
            if (logoUrl) {
                const updated = { ...existing, logoUrl };
                conferenceIdentities.set(key, updated);
                return updated;
            }
        }
        return existing;
    }
    const aliasSet = new Set([name, shortName ?? "", rawConference ?? ""]);
    const logoUrl = getConferenceLogoUrl(name, {
        shortName,
        aliases: Array.from(aliasSet).filter(Boolean),
    });
    const identity = {
        key,
        name,
        shortName,
        logoUrl,
        monogram: getConferenceMonogram(name),
    };
    conferenceIdentities.set(key, identity);
    return identity;
}
const data = divisionOneTeams.map(team => {
    const identity = ensureConferenceIdentity(team);
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
        conference: identity.name,
        conferenceKey: identity.key,
        conferenceShortName: identity.shortName,
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
const percentFormatter = new Intl.NumberFormat(undefined, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NAME_SCALE_MIN = 0.72;
const NAME_SCALE_MAX = 1;
const NAME_SCALE_START = 20;
const NAME_SCALE_END = 42;
const MIN_VISIBLE_RATIO = 0.085;
const CARD_TONE_CLASSES = [
    "stat-card--tone-1",
    "stat-card--tone-2",
    "stat-card--tone-3",
    "stat-card--tone-4",
];
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
function computeWinPercentage(wins, losses) {
    if (wins == null || losses == null) {
        return null;
    }
    const total = wins + losses;
    if (!Number.isFinite(total) || total <= 0) {
        return null;
    }
    return wins / total;
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
function renderLeaderboard(teams) {
    if (!leaderboardRoot) {
        return;
    }
    const teamsWithSummaries = teams.filter(team => team.stats?.averages != null);
    if (teamsWithSummaries.length === 0) {
        if (leaderboardMeta) {
            leaderboardMeta.textContent = "Efficiency leaderboard unavailable right now.";
        }
        leaderboardRoot.innerHTML = `<p class="stat-card stat-card--empty">Team efficiency data unavailable right now.</p>`;
        return;
    }
    const metricDefinitions = [
        {
            key: "record",
            title: "Best average record",
            seasonLabel: "Avg win %",
            ariaLabel: "Top 10 Division I programs by average win percentage",
            formatValue: (_team, averages) => {
                const averageRecord = formatRecord(averages.wins, averages.losses, { decimals: 1 });
                const winPct = computeWinPercentage(averages.wins, averages.losses);
                if (!averageRecord && winPct == null) {
                    return null;
                }
                if (winPct == null) {
                    return averageRecord;
                }
                const percentage = percentFormatter.format(winPct);
                return averageRecord ? `${averageRecord} (${percentage})` : percentage;
            },
            getValue: averages => {
                const winPct = computeWinPercentage(averages.wins, averages.losses);
                return winPct == null ? null : winPct;
            },
        },
        {
            key: "adjO",
            title: "Top offensive efficiency",
            seasonLabel: "Avg AdjO",
            ariaLabel: "Top 10 Division I programs by average offensive efficiency",
            formatValue: (_team, averages) => formatNumber(averages.adjO, oneDecimalFormatter),
            getValue: averages => averages.adjO ?? null,
        },
        {
            key: "adjD",
            title: "Top defensive efficiency",
            seasonLabel: "Avg AdjD ↓",
            ariaLabel: "Top 10 Division I programs by average defensive efficiency (lower is better)",
            sort: "asc",
            formatValue: (_team, averages) => formatNumber(averages.adjD, oneDecimalFormatter),
            getValue: averages => (averages.adjD == null ? null : averages.adjD),
        },
        {
            key: "barthag",
            title: "Program BARTHAG leaders",
            seasonLabel: "Avg BARTHAG",
            ariaLabel: "Top 10 Division I programs by average BARTHAG",
            formatValue: (_team, averages) => formatNumber(averages.barthag, threeDecimalFormatter),
            getValue: averages => averages.barthag ?? null,
        },
    ];
    const metricRankings = new Map();
    for (const metric of metricDefinitions) {
        const ranked = teamsWithSummaries
            .map(team => {
            const averages = team.stats?.averages;
            if (!averages) {
                return null;
            }
            const value = metric.getValue(averages);
            if (value == null) {
                return null;
            }
            const display = metric.formatValue(team, averages);
            if (!display) {
                return null;
            }
            return { team, value, display };
        })
            .filter((entry) => entry != null);
        if (ranked.length === 0) {
            continue;
        }
        ranked.sort((a, b) => {
            if (metric.sort === "asc") {
                return a.value === b.value
                    ? a.team.full_name.localeCompare(b.team.full_name)
                    : a.value - b.value;
            }
            if (b.value === a.value) {
                return a.team.full_name.localeCompare(b.team.full_name);
            }
            return b.value - a.value;
        });
        metricRankings.set(metric.key, ranked.slice(0, 10));
    }
    if (metricRankings.size === 0) {
        if (leaderboardMeta) {
            leaderboardMeta.textContent = "Efficiency leaderboard unavailable right now.";
        }
        leaderboardRoot.innerHTML = `<p class="stat-card stat-card--empty">Team efficiency data unavailable right now.</p>`;
        return;
    }
    const trackedLabel = integerFormatter.format(teamsWithSummaries.length);
    const barthagLeader = metricRankings.get("barthag")?.[0]?.team ?? null;
    const seasonRange = barthagLeader ? formatSeasonRange(barthagLeader.stats) ?? "tracked seasons" : "tracked seasons";
    if (leaderboardMeta) {
        leaderboardMeta.textContent = `${trackedLabel} Division I programs with Torvik efficiency archives. Separate top 10 lists highlight average record, offense, defense, and BARTHAG across ${seasonRange}.`;
    }
    leaderboardRoot.innerHTML = "";
    const doc = leaderboardRoot.ownerDocument;
    metricDefinitions.forEach((metric, cardIndex) => {
        const ranking = metricRankings.get(metric.key);
        if (!ranking || ranking.length === 0) {
            return;
        }
        const card = doc.createElement("article");
        card.className = "stat-card teams-leaderboard__card";
        const toneClass = CARD_TONE_CLASSES[cardIndex % CARD_TONE_CLASSES.length];
        card.classList.add(toneClass);
        const leader = ranking[0]?.team;
        if (leader?.accentPrimary) {
            card.style.setProperty("--chart-accent", leader.accentPrimary);
            const secondary = leader.accentSecondary ?? leader.accentPrimary;
            card.style.setProperty("--chart-accent-muted", `color-mix(in srgb, ${secondary} 55%, white 45%)`);
            card.style.setProperty("--chart-accent-track", `color-mix(in srgb, ${secondary} 22%, white 78%)`);
            card.style.setProperty("--chart-accent-stroke", `color-mix(in srgb, ${leader.accentPrimary} 78%, black 22%)`);
        }
        const header = doc.createElement("header");
        header.className = "stat-card__head";
        const title = doc.createElement("h3");
        title.className = "stat-card__title";
        title.textContent = metric.title;
        header.appendChild(title);
        const season = doc.createElement("span");
        season.className = "stat-card__season";
        season.textContent = metric.seasonLabel;
        header.appendChild(season);
        card.appendChild(header);
        const body = doc.createElement("div");
        body.className = "stat-card__body";
        card.appendChild(body);
        const chart = doc.createElement("div");
        chart.className = "stat-card__chart leaderboard-chart";
        chart.setAttribute("role", "group");
        chart.setAttribute("aria-label", metric.ariaLabel);
        body.appendChild(chart);
        const rows = doc.createElement("div");
        rows.className = "leaderboard-chart__rows";
        chart.appendChild(rows);
        const values = ranking.map(entry => entry.value);
        const maxValue = Math.max(...values);
        const minValue = Math.min(...values);
        const range = maxValue - minValue;
        const prefersLower = metric.sort === "asc";
        ranking.forEach((entry, index) => {
            const row = doc.createElement("div");
            row.className = "leaderboard-chart__row";
            row.dataset.rank = String(index + 1);
            const label = doc.createElement("div");
            label.className = "leaderboard-chart__label";
            row.appendChild(label);
            const rank = doc.createElement("span");
            rank.className = "leaderboard-chart__rank";
            rank.textContent = String(index + 1).padStart(2, "0");
            label.appendChild(rank);
            const identity = doc.createElement("div");
            identity.className = "leaderboard-chart__identity";
            label.appendChild(identity);
            const name = doc.createElement("span");
            name.className = "leaderboard-chart__name";
            name.textContent = entry.team.full_name;
            identity.appendChild(name);
            const conferenceLabel = resolveConferenceLabel(entry.team);
            if (conferenceLabel) {
                const conference = doc.createElement("span");
                conference.className = "leaderboard-chart__team";
                conference.textContent = conferenceLabel;
                identity.appendChild(conference);
            }
            const metrics = doc.createElement("div");
            metrics.className = "leaderboard-chart__metrics";
            row.appendChild(metrics);
            const meter = doc.createElement("div");
            meter.className = "leaderboard-chart__meter";
            let ratio;
            if (!Number.isFinite(range) || range <= 0) {
                ratio = 1;
            }
            else if (prefersLower) {
                ratio = (maxValue - entry.value) / range;
            }
            else {
                ratio = (entry.value - minValue) / range;
            }
            const safeRatio = ratio > 0 ? Math.max(ratio, MIN_VISIBLE_RATIO) : 0;
            meter.style.setProperty("--leaderboard-fill", `${Math.min(safeRatio, 1)}`);
            metrics.appendChild(meter);
            const value = doc.createElement("span");
            value.className = "leaderboard-chart__value";
            value.textContent = entry.display;
            metrics.appendChild(value);
            const scaleLabel = conferenceLabel ? `${entry.team.full_name} ${conferenceLabel}` : entry.team.full_name;
            const baseScale = computeNameScale(scaleLabel);
            row.style.setProperty("--name-scale", `${baseScale}`);
            if (conferenceLabel) {
                const teamScale = Math.max(NAME_SCALE_MIN, Math.min(NAME_SCALE_MAX, baseScale + 0.08));
                row.style.setProperty("--team-scale", `${teamScale}`);
            }
            rows.appendChild(row);
        });
        leaderboardRoot.appendChild(card);
    });
    if (!leaderboardRoot.childElementCount) {
        if (leaderboardMeta) {
            leaderboardMeta.textContent = "Efficiency leaderboard unavailable right now.";
        }
        leaderboardRoot.innerHTML = `<p class="stat-card stat-card--empty">Team efficiency data unavailable right now.</p>`;
    }
}
function resolveConferenceLabel(team) {
    if (!team.conference) {
        return null;
    }
    if (team.conferenceShortName && team.conferenceShortName !== team.conference) {
        return `${team.conferenceShortName} · ${team.conference}`;
    }
    return team.conference;
}
function computeNameScale(label) {
    const length = label.length;
    if (length <= NAME_SCALE_START) {
        return NAME_SCALE_MAX;
    }
    if (length >= NAME_SCALE_END) {
        return NAME_SCALE_MIN;
    }
    const progress = (length - NAME_SCALE_START) / (NAME_SCALE_END - NAME_SCALE_START);
    const scale = NAME_SCALE_MAX - progress * (NAME_SCALE_MAX - NAME_SCALE_MIN);
    return Number(scale.toFixed(3));
}
const teamsWithLocations = data.filter(team => team.location);
if (mapCount) {
    mapCount.textContent = teamsWithLocations.length > 0
        ? `${teamsWithLocations.length} home arenas mapped`
        : "Home location data unavailable";
}
renderLeaderboard(data);
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
        .map(details => details.dataset.conferenceKey || details.dataset.conference || "")
        .filter(Boolean));
    const groups = new Map();
    for (const team of data) {
        const haystack = `${team.full_name} ${team.name} ${team.conference ?? ""} ${team.conferenceShortName ?? ""}`.toLowerCase();
        if (ql && !haystack.includes(ql)) {
            continue;
        }
        const conferenceKey = team.conferenceKey;
        if (!groups.has(conferenceKey)) {
            groups.set(conferenceKey, []);
        }
        groups.get(conferenceKey).push(team);
    }
    if (groups.size === 0) {
        list.innerHTML = `<p class="empty-state">No teams match your search.</p>`;
        return;
    }
    const sections = Array.from(groups.entries())
        .sort(([a], [b]) => {
        const aIdentity = conferenceIdentities.get(a);
        const bIdentity = conferenceIdentities.get(b);
        const aName = aIdentity?.name ?? a;
        const bName = bIdentity?.name ?? b;
        return aName.localeCompare(bName);
    })
        .map(([conferenceKey, teams]) => {
        teams.sort((a, b) => a.full_name.localeCompare(b.full_name));
        const identity = conferenceIdentities.get(conferenceKey);
        const conferenceName = identity?.name ?? teams[0]?.conference ?? "Conference";
        const shortName = identity?.shortName && identity.shortName !== conferenceName ? identity.shortName : null;
        const logoMarkup = identity?.logoUrl
            ? `<img class="conference-identity__logo-image" src="${identity.logoUrl}" alt="${conferenceName} logo" loading="lazy" decoding="async">`
            : `<span class="conference-identity__logo-fallback">${identity?.monogram ?? getConferenceMonogram(conferenceName)}</span>`;
        const teamCountLabel = `${teams.length} team${teams.length === 1 ? "" : "s"}`;
        const isOpen = openSet.has(conferenceKey) || ql.length > 0;
        return `<details class="conference-card card" data-conference-key="${conferenceKey}" data-conference="${conferenceName}"${isOpen ? " open" : ""}>
  <summary class="conference-card__summary">
    <span class="conference-identity">
      <span class="conference-identity__logo">${logoMarkup}</span>
      <span class="conference-identity__text">
        <span class="conference-identity__name">${conferenceName}</span>
        ${shortName ? `<span class="conference-identity__subtext">${shortName}</span>` : ""}
      </span>
    </span>
    <span class="conference-card__meta">
      <span class="conference-card__count" aria-label="${teamCountLabel}">${teamCountLabel}</span>
      <span class="disclosure-indicator" aria-hidden="true"></span>
    </span>
  </summary>
  <div class="conference-card__body">
    <div class="conference-card__group grid cols-3">
    ${teams
            .map(team => {
            const logo = team.logoUrl
                ? `<img class="team-card__logo-image" src="${team.logoUrl}" alt="${team.full_name} logo" loading="lazy" decoding="async">`
                : `<span class="team-card__logo-placeholder" aria-hidden="true" style="--team-accent:${team.accentPrimary}; --team-accent-secondary:${team.accentSecondary};">${team.monogram}</span>`;
            const conferenceLabel = team.conferenceShortName && team.conferenceShortName !== team.conference
                ? `${team.conferenceShortName} · ${team.conference}`
                : team.conference;
            const meta = team.abbreviation ? `${conferenceLabel} · ${team.abbreviation}` : conferenceLabel;
            const infoParts = [];
            if (team.location?.arena) {
                infoParts.push(team.location.arena);
            }
            const infoLine = infoParts.join(" · ");
            const stats = renderTeamStats(team);
            return `<article class="card team-card" tabindex="-1" data-team-id="${team.id}" id="team-${team.id}">
  <div class="team-card__identity">
    <div class="team-card__logo">${logo}</div>
    <div class="team-card__body">
      <strong class="team-card__name">${team.full_name}</strong>
      <span class="team-card__meta">${meta}</span>
      ${infoLine ? `<span class="team-card__info">${infoLine}</span>` : ""}
    </div>
  </div>
  <div class="team-card__details">${stats}</div>
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
    tooltip.setAttribute("aria-live", "polite");
    tooltip.hidden = true;
    mapRoot.appendChild(tooltip);
    let activeTooltipTeamId = null;
    const renderTooltipContent = (team) => {
        if (activeTooltipTeamId === team.id) {
            return;
        }
        activeTooltipTeamId = team.id;
        tooltip.replaceChildren();
        const logo = document.createElement("span");
        logo.className = "teams-map__tooltip-logo";
        const fallbackMark = () => team.monogram || team.abbreviation || team.full_name.slice(0, 3).toUpperCase();
        if (team.logoUrl) {
            const img = document.createElement("img");
            img.src = team.logoUrl;
            img.alt = "";
            img.decoding = "async";
            img.loading = "lazy";
            img.addEventListener("error", () => {
                img.remove();
                const mark = document.createElement("span");
                mark.className = "teams-map__tooltip-logo-mark";
                mark.textContent = fallbackMark();
                logo.appendChild(mark);
            }, { once: true });
            logo.appendChild(img);
        }
        else {
            const mark = document.createElement("span");
            mark.className = "teams-map__tooltip-logo-mark";
            mark.textContent = fallbackMark();
            logo.appendChild(mark);
        }
        const text = document.createElement("span");
        text.className = "teams-map__tooltip-text";
        const name = document.createElement("span");
        name.className = "teams-map__tooltip-name";
        name.textContent = team.full_name;
        text.appendChild(name);
        if (team.location?.arena) {
            const arena = document.createElement("span");
            arena.className = "teams-map__tooltip-arena";
            arena.textContent = team.location.arena;
            text.appendChild(arena);
        }
        tooltip.append(logo, text);
    };
    const positionTooltip = (circle) => {
        const mapBounds = mapRoot.getBoundingClientRect();
        const circleBounds = circle.getBoundingClientRect();
        tooltip.style.left = `${circleBounds.left + circleBounds.width / 2 - mapBounds.left}px`;
        tooltip.style.top = `${circleBounds.top - mapBounds.top}px`;
    };
    const showTooltip = (circle, team) => {
        renderTooltipContent(team);
        tooltip.style.setProperty("--teams-map-tooltip-accent", team.accentPrimary);
        positionTooltip(circle);
        tooltip.hidden = false;
    };
    const [topojson, topo] = await Promise.all([
        loadScript(new URL("../../vendor/topojson-client.v3.min.js", import.meta.url).toString(), "topojson"),
        requireOk("data/us-states-10m.json", "Teams map").then(res => res.json()),
    ]);
    const topoData = topo;
    const topoClient = topojson;
    const states = topoClient.feature(topoData, topoData.objects.states);
    const width = 960;
    const height = 600;
    const projection = geoAlbersUsa().fitExtent([[24, 24], [width - 24, height - 40]], states);
    const path = geoPath(projection);
    const svg = select(mapRoot)
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
    const hideTooltip = () => {
        tooltip.hidden = true;
        activeTooltipTeamId = null;
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
        select(this)
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
        showTooltip(this, team);
    })
        .on("pointermove", function (event, team) {
        if (!team.location || tooltip.hidden) {
            return;
        }
        positionTooltip(this);
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
        showTooltip(this, team);
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
