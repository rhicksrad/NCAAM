import { setChartDefaults } from "../lib/charts/defaults.js";
import { renderConferenceDirectory } from "../lib/players/conferences.js";
import { getPlayersLeaderboard, loadPlayersLeaderboard, type PlayerLeaderboardRow } from "../lib/players/data.js";
import { renderLeaderboard } from "../charts/leaderboard.js";
import { METRIC_DOMAINS, type Metric } from "../charts/theme.js";
import { requireOk } from "../lib/health.js";

type ColorMode = "value" | "rank";

type LeaderboardState = {
  metric: Metric;
  colorMode: ColorMode;
  data: PlayerLeaderboardRow[];
};

const METRIC_LABELS: Record<Metric, string> = {
  ppg: "Points per game",
  rpg: "Rebounds per game",
  apg: "Assists per game",
};

const COLOR_MODE_LABELS: Record<ColorMode, string> = {
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
            <select id="metricSel">
              <option value="ppg">PPG</option>
              <option value="rpg">RPG</option>
              <option value="apg">APG</option>
            </select>
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

const leaderboardRoot = document.getElementById("leaderboardRoot") as HTMLElement | null;
const metricSelect = document.querySelector<HTMLSelectElement>("#metricSel");
const colorSelect = document.querySelector<HTMLSelectElement>("#colorSel");
const leaderboardMeta = document.getElementById("players-leaderboard-meta");
const leaderboardTitle = document.getElementById("players-leaderboard-title");
const conferenceDirectory = document.getElementById("players-conference-directory") as HTMLElement | null;
const conferenceMeta = document.getElementById("players-conference-meta");

function updateMeta(state: LeaderboardState): void {
  if (leaderboardTitle) {
    leaderboardTitle.textContent = `Top 50 ${METRIC_LABELS[state.metric]} leaders`;
  }

  if (leaderboardMeta) {
    const domain = METRIC_DOMAINS[state.metric];
    leaderboardMeta.textContent = `Sorted by rank · Range ${domain[0]}–${domain[1]} ${state.metric.toUpperCase()} · ${COLOR_MODE_LABELS[state.colorMode]}`;
  }
}

function mountLeaderboard(state: LeaderboardState): void {
  if (!leaderboardRoot) return;

  renderLeaderboard({
    el: leaderboardRoot,
    data: state.data,
    metric: state.metric,
    colorMode: state.colorMode,
  });

  updateMeta(state);
}

function wireControls(state: LeaderboardState): void {
  if (metricSelect) {
    metricSelect.value = state.metric;
    metricSelect.addEventListener("change", () => {
      const next = metricSelect.value as Metric;
      if (!METRIC_DOMAINS[next]) return;
      state.metric = next;
      mountLeaderboard(state);
    });
  } else {
    console.warn("Missing #metricSel control");
  }

  if (colorSelect) {
    colorSelect.value = state.colorMode;
    colorSelect.addEventListener("change", () => {
      state.colorMode = (colorSelect.value as ColorMode) ?? "value";
      mountLeaderboard(state);
    });
  } else {
    console.warn("Missing #colorSel control");
  }
}

async function boot(): Promise<void> {
  if (leaderboardRoot) {
    leaderboardRoot.textContent = "Loading leaderboard…";
  }

  try {
    await Promise.all([
      loadPlayersLeaderboard(),
      requireOk("data/players_index.json", "Players"),
    ]);

    const state: LeaderboardState = {
      metric: "ppg",
      colorMode: "value",
      data: getPlayersLeaderboard(),
    };

    wireControls(state);
    mountLeaderboard(state);
  } catch (error) {
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
