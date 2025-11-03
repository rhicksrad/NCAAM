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
        <span class="feature-card__eyebrow">Feature 01</span>
        <h2 class="feature-card__title">Top 10 leaders in every tracked category</h2>
        <p id="players-leaderboard-intro" class="feature-card__meta">Loading the latest stat leaders…</p>
      </header>
      <div id="players-leaderboard-grid" class="players-leaderboard-grid" aria-live="polite"></div>
    </section>
    <section class="players-feature stack" data-gap="md">
      <header class="feature-card card stack" data-gap="xs">
        <span class="feature-card__eyebrow">Feature 02</span>
        <h2 class="feature-card__title">Conference rosters &amp; per-game production</h2>
        <p id="players-conference-intro" class="feature-card__meta">Dive into every conference, team, and player.</p>
      </header>
      <div id="players-conference-directory" class="players-conference-directory" aria-live="polite"></div>
    </section>
  </div>
`;

const leaderboardGrid = document.getElementById("players-leaderboard-grid") as HTMLElement | null;
const leaderboardIntro = document.getElementById("players-leaderboard-intro") as HTMLElement | null;
const conferenceDirectory = document.getElementById("players-conference-directory") as HTMLElement | null;
const conferenceIntro = document.getElementById("players-conference-intro") as HTMLElement | null;

async function boot(): Promise<void> {
  if (leaderboardGrid) {
    await renderLeaderboardFeature(leaderboardGrid, leaderboardIntro);
  }

  if (conferenceDirectory) {
    await renderConferenceDirectory(conferenceDirectory, conferenceIntro);
  }
}

void boot();
