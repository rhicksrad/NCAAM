import { renderConferenceDirectory } from "../lib/players/conferences.js";
import { renderLeaderboardFeature } from "../lib/players/leaderboards.js";
const app = document.getElementById("app");
if (!app) {
    throw new Error("Players page requires an #app container");
}
app.innerHTML = `
  <div class="players-page stack" data-gap="xl">
    <section class="players-feature stack" data-gap="md">
      <header class="feature-card card stack" data-gap="xs">
        <h2 id="players-leaderboard-title" class="feature-card__title">Top 10 stat leaders</h2>
        <p id="players-leaderboard-meta" class="feature-card__meta">Loading the latest stat leaders…</p>
      </header>
      <div id="players-leaderboard-grid" class="players-leaderboard-grid" aria-live="polite"></div>
    </section>
    <section class="players-feature stack" data-gap="md">
      <header class="feature-card card stack" data-gap="xs">
        <h2 class="feature-card__title">Conference rosters and player production</h2>
        <p id="players-conference-meta" class="feature-card__meta">Dive into every conference, team, and player.</p>
      </header>
      <div id="players-conference-directory" class="players-conference-directory" aria-live="polite"></div>
    </section>
  </div>
`;
const leaderboardGrid = document.getElementById("players-leaderboard-grid");
const leaderboardMeta = document.getElementById("players-leaderboard-meta");
const leaderboardTitle = document.getElementById("players-leaderboard-title");
const conferenceDirectory = document.getElementById("players-conference-directory");
const conferenceMeta = document.getElementById("players-conference-meta");
async function boot() {
    if (leaderboardGrid) {
        await renderLeaderboardFeature(leaderboardGrid, leaderboardMeta, leaderboardTitle);
    }
    if (conferenceDirectory) {
        await renderConferenceDirectory(conferenceDirectory, conferenceMeta);
    }
}
void boot();
