import { setChartDefaults } from "../lib/charts/defaults.js";
import { renderConferenceDirectory } from "../lib/players/conferences.js";
import { getPlayersLeaderboard, loadPlayersLeaderboard } from "../lib/players/data.js";
import { renderLeaderboard } from "../charts/leaderboard.js";
import { METRIC_DOMAINS, setMetricDomain } from "../charts/theme.js";
import { requireOk } from "../lib/health.js";
import { PLAYER_LEADERBOARD_METRICS, PLAYER_LEADERBOARD_METRIC_KEYS, formatMetricValue, } from "../lib/players/leaderboard-metrics.js";
const METRIC_KEYS = PLAYER_LEADERBOARD_METRIC_KEYS;
const METRIC_OPTIONS_HTML = METRIC_KEYS
    .map((metricKey) => {
    const config = PLAYER_LEADERBOARD_METRICS[metricKey];
    const label = config?.shortLabel ?? metricKey.toUpperCase();
    return `<option value="${metricKey}">${label}</option>`;
})
    .join("");
const isMetric = (value) => Object.prototype.hasOwnProperty.call(PLAYER_LEADERBOARD_METRICS, value);
const DEFAULT_METRIC = (isMetric("ppg") ? "ppg" : METRIC_KEYS[0]) ?? "ppg";
const COLOR_MODE_LABELS = {
    value: "Color shows average using a sequential ramp.",
    rank: "Color shows rank tiers across the top 50.",
};
const app = document.getElementById("app");
if (!app) {
    throw new Error("Players page requires an #app container");
}
setChartDefaults();
app.classList.add("players-page-container");
app.innerHTML = `
  <div class="players-page stack" data-gap="xl">
    <section class="players-feature stack" data-gap="md">
      <header class="feature-card card stack" data-gap="xs">
        <h2 id="players-leaderboard-title" class="feature-card__title">Top 50 stat leaders</h2>
        <p id="players-leaderboard-meta" class="feature-card__meta">Loading the latest player stat leaders…</p>
      </header>
      <div class="leaderboard-panel card">
        <div class="leaderboard-panel__controls">
          <label class="leaderboard-panel__control">
            <span>Metric</span>
            <select id="metricSel">${METRIC_OPTIONS_HTML}</select>
          </label>
          <label class="leaderboard-panel__control">
            <span>Color</span>
            <select id="colorSel">
              <option value="value">Averages</option>
              <option value="rank">Rank tiers</option>
            </select>
          </label>
        </div>
        <div id="leaderboardRoot" class="leaderboard-panel__canvas" aria-live="polite"></div>
      </div>
    </section>
    <section class="players-feature stack" data-gap="md">
      <header class="feature-card card stack" data-gap="xs">
        <h2 class="feature-card__title">2025-26 conference rosters and player production</h2>
        <p id="players-conference-meta" class="feature-card__meta">33 conferences, 400 teams tracked for 2025-26.</p>
      </header>
      <div id="players-conference-directory" class="players-conference-directory" aria-live="polite"></div>
    </section>
  </div>
`;
const leaderboardRoot = document.getElementById("leaderboardRoot");
const metricSelect = document.querySelector("#metricSel");
const colorSelect = document.querySelector("#colorSel");
const leaderboardMeta = document.getElementById("players-leaderboard-meta");
const leaderboardTitle = document.getElementById("players-leaderboard-title");
const conferenceDirectory = document.getElementById("players-conference-directory");
const conferenceMeta = document.getElementById("players-conference-meta");
function updateMeta(state) {
    const config = PLAYER_LEADERBOARD_METRICS[state.metric];
    if (leaderboardTitle) {
        const label = config?.label ?? state.metric.toUpperCase();
        leaderboardTitle.textContent = `Top 50 ${label} leaders`;
    }
    if (leaderboardMeta) {
        const domain = METRIC_DOMAINS[state.metric] ?? config?.defaultDomain ?? [0, 1];
        const [domainMin, domainMax] = domain;
        const formatRange = (value) => {
            const formatted = formatMetricValue(state.metric, value);
            if (formatted)
                return formatted;
            if (Number.isFinite(value)) {
                return Number(value).toFixed(1);
            }
            return "--";
        };
        const shortLabel = config?.shortLabel ?? state.metric.toUpperCase();
        leaderboardMeta.textContent =
            `Sorted by rank · Range ${formatRange(domainMin)}–${formatRange(domainMax)} ${shortLabel} · ${COLOR_MODE_LABELS[state.colorMode]}`;
    }
}
function refreshMetricDomains(rows) {
    METRIC_KEYS.forEach((metric) => {
        const config = PLAYER_LEADERBOARD_METRICS[metric];
        const defaultDomain = config?.defaultDomain ?? [0, 1];
        const values = rows
            .map((row) => row[metric])
            .filter((value) => Number.isFinite(value));
        if (!values.length) {
            return;
        }
        const maxValue = Math.max(...values);
        const minValue = Math.min(...values);
        const start = Math.min(0, minValue);
        const candidateEnd = Math.max(start, maxValue);
        const end = candidateEnd > start ? candidateEnd : defaultDomain[1];
        setMetricDomain(metric, [start, end]);
    });
}
function mountLeaderboard(state) {
    if (!leaderboardRoot)
        return;
    renderLeaderboard({
        el: leaderboardRoot,
        data: state.data,
        metric: state.metric,
        colorMode: state.colorMode,
    });
    updateMeta(state);
}
function wireControls(state) {
    if (metricSelect) {
        metricSelect.value = state.metric;
        metricSelect.addEventListener("change", () => {
            const nextValue = metricSelect.value;
            if (!isMetric(nextValue))
                return;
            state.metric = nextValue;
            mountLeaderboard(state);
        });
    }
    else {
        console.warn("Missing #metricSel control");
    }
    if (colorSelect) {
        colorSelect.value = state.colorMode;
        colorSelect.addEventListener("change", () => {
            state.colorMode = colorSelect.value ?? "value";
            mountLeaderboard(state);
        });
    }
    else {
        console.warn("Missing #colorSel control");
    }
}
async function boot() {
    if (leaderboardRoot) {
        leaderboardRoot.textContent = "Loading leaderboard…";
    }
    try {
        await Promise.all([
            loadPlayersLeaderboard(),
            requireOk("data/players_index.json", "Players"),
        ]);
        const state = {
            metric: DEFAULT_METRIC,
            colorMode: "value",
            data: getPlayersLeaderboard(),
        };
        refreshMetricDomains(state.data);
        wireControls(state);
        mountLeaderboard(state);
    }
    catch (error) {
        console.error(error);
        if (leaderboardRoot) {
            leaderboardRoot.innerHTML = `<p class="leaderboard-panel__error">We couldn't load the leaderboard. Please try again later.</p>`;
        }
        if (leaderboardMeta) {
            leaderboardMeta.textContent = "Unable to load player stat leaders right now.";
        }
    }
    if (conferenceDirectory) {
        await renderConferenceDirectory(conferenceDirectory, conferenceMeta);
    }
}
void boot();
