import { BASE } from "../lib/config.js";
import { NCAAM } from "../lib/sdk/ncaam.js";
import { getTeamAccentColors, getTeamLogoUrl, getTeamMonogram, } from "../lib/ui/logos.js";
const REFRESH_INTERVAL_MS = 30_000;
const REFRESH_WINDOW_MS = 6 * 60 * 60 * 1000;
const dateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
});
const STATUS_COMPLETE = /^(?:post|final|complete|completed|cancelled|canceled|postponed)$/i;
const STATUS_SCHEDULED = /^(?:pre|scheduled)$/i;
const LIVE_STATUS = /(?:live|inprogress|halftime)/i;
function escapeAttr(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
function toLocalISODate(value) {
    const date = new Date(value.getTime());
    date.setHours(0, 0, 0, 0);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60_000);
    return local.toISOString().slice(0, 10);
}
function startOfWeek(date) {
    const result = new Date(date.getTime());
    result.setHours(0, 0, 0, 0);
    const day = result.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + diff);
    return result;
}
function endOfWeek(start) {
    const result = new Date(start.getTime());
    result.setHours(0, 0, 0, 0);
    result.setDate(result.getDate() + 6);
    return result;
}
function formatDateLabel(dateString) {
    if (!dateString) {
        return "";
    }
    const timestamp = Date.parse(dateString);
    if (Number.isNaN(timestamp)) {
        return "";
    }
    const value = new Date(timestamp);
    return `${dateFormatter.format(value)} • ${timeFormatter.format(value)}`;
}
function isNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
function formatScore(value) {
    return isNumber(value) ? String(value) : "—";
}
function formatPeriod(period) {
    if (!isNumber(period) || period <= 0) {
        return null;
    }
    if (period === 1)
        return "1st";
    if (period === 2)
        return "2nd";
    if (period === 3)
        return "3rd";
    if (period === 4)
        return "4th";
    if (period > 4) {
        const overtime = period - 4;
        return overtime === 1 ? "OT" : `${overtime}OT`;
    }
    return null;
}
function describeStatus(game) {
    const rawStatus = game.status ?? "";
    const status = rawStatus.toLowerCase();
    if (STATUS_COMPLETE.test(status)) {
        return { label: "Final" };
    }
    if (status === "halftime") {
        return { label: "Halftime", variant: "arc" };
    }
    if (LIVE_STATUS.test(status)) {
        const period = formatPeriod(game.period);
        return { label: period ? `Live • ${period}` : "Live", variant: "arc" };
    }
    if (STATUS_SCHEDULED.test(status)) {
        return { label: "Scheduled" };
    }
    if (!rawStatus) {
        return { label: "" };
    }
    return { label: rawStatus.replace(/\b\w/g, char => char.toUpperCase()) };
}
function buildLineScore(game) {
    const segments = [
        { label: "H1", away: game.away_score_h1, home: game.home_score_h1 },
        { label: "H2", away: game.away_score_h2, home: game.home_score_h2 },
    ];
    if (isNumber(game.away_score_ot) || isNumber(game.home_score_ot)) {
        segments.push({ label: "OT", away: game.away_score_ot, home: game.home_score_ot });
    }
    return segments.filter(segment => isNumber(segment.away) || isNumber(segment.home));
}
function shouldPollGame(game) {
    const status = (game.status ?? "").toLowerCase();
    if (STATUS_COMPLETE.test(status)) {
        return false;
    }
    const date = game.date ? Date.parse(game.date) : Number.NaN;
    if (!Number.isNaN(date)) {
        const now = Date.now();
        if (date - now > REFRESH_WINDOW_MS) {
            return false;
        }
    }
    return true;
}
function renderTeamLogo(team) {
    const label = team.full_name ?? team.name ?? "Team";
    const logoUrl = getTeamLogoUrl(team);
    if (logoUrl) {
        const safeUrl = escapeAttr(logoUrl);
        const alt = escapeAttr(`${label} logo`);
        return `<span class="game-card__team-logo">
      <img class="game-card__team-logo-image" src="${safeUrl}" alt="${alt}" loading="lazy" decoding="async">
    </span>`;
    }
    const [accentPrimary, accentSecondary] = getTeamAccentColors(team);
    const monogram = getTeamMonogram(team);
    const safeLabel = escapeAttr(`${label} logo`);
    const style = escapeAttr(`--team-accent-primary: ${accentPrimary}; --team-accent-secondary: ${accentSecondary};`);
    return `<span class="game-card__team-logo game-card__team-logo--fallback" role="img" aria-label="${safeLabel}" style="${style}">${monogram}</span>`;
}
function renderTeamRow(team, score, isLeading, side) {
    const name = team.full_name ?? team.name;
    const abbr = team.abbreviation ?? (side === "home" ? "HOME" : "AWAY");
    return `<div class="game-card__team game-card__team--${side}${isLeading ? " is-leading" : ""}">
    ${renderTeamLogo(team)}
    <span class="game-card__team-abbr" aria-hidden="true">${abbr}</span>
    <span class="game-card__team-name">${name}</span>
    <span class="game-card__team-score">${formatScore(score)}</span>
  </div>`;
}
function renderLineScore(game) {
    const segments = buildLineScore(game);
    if (segments.length === 0) {
        return "";
    }
    const awayLabel = game.visitor_team.abbreviation ?? "Away";
    const homeLabel = game.home_team.abbreviation ?? "Home";
    const rows = segments
        .map(segment => `<div class="game-card__line-score-row">
      <span>${segment.label}</span>
      <span>${formatScore(segment.away)}</span>
      <span>${formatScore(segment.home)}</span>
    </div>`)
        .join("");
    return `<div class="game-card__line-score" role="presentation">
    <div class="game-card__line-score-row game-card__line-score-row--labels">
      <span></span>
      <span>${awayLabel}</span>
      <span>${homeLabel}</span>
    </div>
    ${rows}
  </div>`;
}
function renderGameCard(game) {
    const headerLabel = formatDateLabel(game.date);
    const status = describeStatus(game);
    const homeScore = game.home_score;
    const awayScore = game.away_score;
    const hasScores = isNumber(homeScore) && isNumber(awayScore);
    const homeLeading = hasScores ? (homeScore ?? 0) > (awayScore ?? 0) : false;
    const awayLeading = hasScores ? (awayScore ?? 0) > (homeScore ?? 0) : false;
    const badge = status.label
        ? `<span class="badge"${status.variant ? ` data-variant="${status.variant}"` : ""}>${status.label}</span>`
        : "";
    const href = escapeAttr(`${BASE}game.html?game_id=${encodeURIComponent(String(game.id))}`);
    return `<li class="card game-card" data-status="${game.status ?? ""}">
    <a class="game-card__link" href="${href}">
      <div class="game-card__header">
        <span class="game-card__time">${headerLabel}</span>
        ${badge}
      </div>
      <div class="game-card__body">
        ${renderTeamRow(game.visitor_team, awayScore, awayLeading, "away")}
        ${renderTeamRow(game.home_team, homeScore, homeLeading, "home")}
      </div>
      ${renderLineScore(game)}
    </a>
  </li>`;
}
const app = document.getElementById("app");
app.innerHTML = `<div class="page stack" data-gap="lg">
  <header class="page-intro stack" data-gap="xs">
    <span class="page-label">Scoreboard</span>
    <h1>Games</h1>
    <p class="page-summary">Track Division I matchups with live updates direct from the Cloudflare worker proxy.</p>
  </header>
  <section id="controls" class="card games-controls">
    <div class="games-controls__inputs">
      <label class="games-controls__field">
        <span class="games-controls__label">Start</span>
        <input type="date" id="start" name="start">
      </label>
      <label class="games-controls__field">
        <span class="games-controls__label">End</span>
        <input type="date" id="end" name="end">
      </label>
    </div>
    <div class="games-controls__actions">
      <button id="load" class="button" data-variant="primary" type="button">Update</button>
      <span class="games-controls__hint">Tip-off times shown in your local time zone.</span>
    </div>
  </section>
  <section>
    <ul id="games-list" class="games-grid" aria-live="polite" aria-busy="false"></ul>
  </section>
</div>`;
const startInputRef = app.querySelector("#start");
const endInputRef = app.querySelector("#end");
const loadButtonRef = app.querySelector("#load");
const listRef = app.querySelector("#games-list");
if (!startInputRef) {
    throw new Error("Missing start date input");
}
if (!endInputRef) {
    throw new Error("Missing end date input");
}
if (!loadButtonRef) {
    throw new Error("Missing games refresh button");
}
if (!listRef) {
    throw new Error("Missing games list container");
}
const startInput = startInputRef;
const endInput = endInputRef;
const loadButton = loadButtonRef;
const list = listRef;
const now = new Date();
const defaultStart = startOfWeek(now);
const defaultEnd = endOfWeek(defaultStart);
startInput.value = toLocalISODate(defaultStart);
endInput.value = toLocalISODate(defaultEnd);
let liveTimer = null;
let isFetching = false;
function clearLiveTimer() {
    if (liveTimer !== null) {
        window.clearInterval(liveTimer);
        liveTimer = null;
    }
}
function scheduleLiveRefresh(games) {
    if (!games.some(shouldPollGame)) {
        clearLiveTimer();
        return;
    }
    if (liveTimer !== null) {
        return;
    }
    liveTimer = window.setInterval(() => {
        if (isFetching) {
            return;
        }
        void loadGames({ showLoader: false });
    }, REFRESH_INTERVAL_MS);
}
function renderLoading() {
    list.innerHTML = `<li class="card game-card game-card--loading">
    <div class="game-card__header">
      <span class="game-card__time">Loading games</span>
    </div>
    <p class="game-card__message">Fetching the latest schedule…</p>
  </li>`;
}
function renderEmpty() {
    list.innerHTML = `<li class="card game-card game-card--empty">
    <div class="game-card__header">
      <span class="game-card__time">No games in this range</span>
    </div>
    <p class="game-card__message">Try adjusting the dates to explore more matchups.</p>
  </li>`;
}
function renderErrorMessage() {
    list.innerHTML = `<li class="card game-card game-card--error">
    <div class="game-card__header">
      <span class="game-card__time">Unable to load games</span>
    </div>
    <p class="game-card__message">Please try again in a moment.</p>
  </li>`;
}
function renderGames(games) {
    if (games.length === 0) {
        renderEmpty();
        return;
    }
    const markup = games.map(renderGameCard).join("");
    list.innerHTML = markup;
}
const loadGames = async ({ showLoader = true } = {}) => {
    if (isFetching) {
        return;
    }
    const startDate = startInput.value;
    const endDate = endInput.value;
    if (!startDate || !endDate) {
        renderEmpty();
        return;
    }
    const startMs = Date.parse(startDate);
    const endMs = Date.parse(endDate);
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs < startMs) {
        renderErrorMessage();
        return;
    }
    isFetching = true;
    loadButton.disabled = true;
    clearLiveTimer();
    list.setAttribute("aria-busy", "true");
    if (showLoader) {
        renderLoading();
    }
    try {
        const { data } = await NCAAM.games(1, 200, startDate, endDate);
        const games = Array.isArray(data) ? [...data] : [];
        games.sort((a, b) => {
            const aDate = a.date ? Date.parse(a.date) : Number.NaN;
            const bDate = b.date ? Date.parse(b.date) : Number.NaN;
            if (Number.isNaN(aDate) && Number.isNaN(bDate))
                return 0;
            if (Number.isNaN(aDate))
                return 1;
            if (Number.isNaN(bDate))
                return -1;
            return aDate - bDate;
        });
        renderGames(games);
        scheduleLiveRefresh(games);
    }
    catch (error) {
        console.error("Failed to load games", error);
        renderErrorMessage();
    }
    finally {
        list.setAttribute("aria-busy", "false");
        isFetching = false;
        loadButton.disabled = false;
    }
};
loadButton.addEventListener("click", () => {
    void loadGames({ showLoader: true });
});
[startInput, endInput].forEach(input => {
    input.addEventListener("change", () => {
        void loadGames({ showLoader: true });
    });
    input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            void loadGames({ showLoader: true });
        }
    });
});
await loadGames({ showLoader: true });
