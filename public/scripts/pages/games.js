import { BASE } from "../lib/config.js";
import { getGamePlayByPlay } from "../lib/api/ncaam.js";
import { NCAAM } from "../lib/sdk/ncaam.js";
import { getTeamAccentColors, getTeamLogoUrl, getTeamMonogram, } from "../lib/ui/logos.js";
import { requireOk } from "../lib/health.js";
const DEFAULT_TIME_ZONE = "America/New_York";
const LAST_PLAY_PLACEHOLDER = "Loading last play…";
const DATE_DISPLAY = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: DEFAULT_TIME_ZONE,
});
const TIME_DISPLAY = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: DEFAULT_TIME_ZONE,
});
const ISO_DATE_DISPLAY = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: DEFAULT_TIME_ZONE,
});
function isLiveStatus(status) {
    const label = typeof status.label === "string" ? status.label.trim().toLowerCase() : "";
    return label === "live";
}
const ESCAPE_ATTR = /[&<>"']/g;
const ESCAPE_HTML = /[&<>]/g;
const ESCAPE_REPLACEMENTS = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};
function escapeAttr(value) {
    return value.replace(ESCAPE_ATTR, char => ESCAPE_REPLACEMENTS[char] ?? char);
}
function escapeHtml(value) {
    return value.replace(ESCAPE_HTML, char => ESCAPE_REPLACEMENTS[char] ?? char);
}
function toTimeZoneISODate(date) {
    return ISO_DATE_DISPLAY.format(date);
}
function ensureISODate(value) {
    const trimmed = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return null;
    }
    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed)) {
        return null;
    }
    return trimmed;
}
function addDaysToISODate(value, days) {
    const normalized = ensureISODate(value);
    if (!normalized) {
        return null;
    }
    const base = new Date(`${normalized}T00:00:00Z`);
    const time = base.getTime();
    if (Number.isNaN(time)) {
        return null;
    }
    base.setUTCDate(base.getUTCDate() + days);
    return base.toISOString().slice(0, 10);
}
function toEasternISODateString(value) {
    if (!value) {
        return null;
    }
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
        return null;
    }
    return toTimeZoneISODate(new Date(timestamp));
}
function getDefaultSelection() {
    const today = new Date();
    const formatted = toTimeZoneISODate(today);
    const normalized = ensureISODate(formatted) ?? formatted;
    return { start: normalized, end: normalized };
}
function formatDateLabel(dateString) {
    if (!dateString) {
        return "Tip-off TBD";
    }
    const timestamp = Date.parse(dateString);
    if (Number.isNaN(timestamp)) {
        return "Tip-off TBD";
    }
    const value = new Date(timestamp);
    return `${DATE_DISPLAY.format(value)} • ${TIME_DISPLAY.format(value)}`;
}
function isFiniteScore(value) {
    return typeof value === "number" && Number.isFinite(value);
}
function formatScore(value) {
    return isFiniteScore(value) ? String(value) : "—";
}
function describeStatus(game) {
    const statusText = typeof game.status === "string" ? game.status.trim() : "";
    const normalized = statusText.toLowerCase();
    if (!statusText) {
        return { label: "" };
    }
    const compact = normalized.replace(/[^a-z]/g, "");
    if (/^(final|complete|completed|post|postponed|cancelled|canceled)$/.test(compact)) {
        return { label: "Final" };
    }
    if (compact === "halftime") {
        return { label: "Halftime", variant: "arc", detail: "Halftime" };
    }
    if (/^(scheduled|pre)$/.test(compact)) {
        return { label: "Scheduled" };
    }
    if (/^(live|inprogress)$/.test(compact) ||
        compact.includes("live") ||
        normalized === "in") {
        const detail = [formatPeriod(game.period), extractClock(game)]
            .filter(Boolean)
            .join(" • ");
        return { label: "Live", variant: "arc", detail: detail || null };
    }
    const prettified = statusText.replace(/\b\w/g, char => char.toUpperCase());
    return { label: prettified, detail: prettified };
}
function getTeamShortLabel(team, fallback) {
    if (!team) {
        return fallback;
    }
    const abbr = typeof team.abbreviation === "string" ? team.abbreviation.trim() : "";
    if (abbr) {
        return abbr;
    }
    const name = typeof team.name === "string" ? team.name.trim() : "";
    if (name) {
        return name;
    }
    const fullName = typeof team.full_name === "string" ? team.full_name.trim() : "";
    return fullName || fallback;
}
function formatPlayClock(play) {
    if (!play) {
        return null;
    }
    const segments = [];
    const period = formatPeriod(play.period);
    if (period) {
        segments.push(period);
    }
    const rawClock = typeof play.clock === "string" ? play.clock.trim() : "";
    if (rawClock) {
        segments.push(rawClock);
    }
    return segments.length ? segments.join(" • ") : null;
}
function buildPlaySummary(game, plays) {
    if (!Array.isArray(plays) || plays.length === 0) {
        return null;
    }
    let last = null;
    for (let index = plays.length - 1; index >= 0; index -= 1) {
        const candidate = plays[index];
        if (candidate && typeof candidate.description === "string" && candidate.description.trim()) {
            last = candidate;
            break;
        }
    }
    if (!last) {
        return null;
    }
    const homeLabel = getTeamShortLabel(game.home_team, "HOME");
    const awayLabel = getTeamShortLabel(game.visitor_team, "AWAY");
    const hasScore = isFiniteScore(last.homeScore) || isFiniteScore(last.awayScore);
    const scoreboard = hasScore
        ? `${awayLabel} ${formatScore(last.awayScore)} – ${formatScore(last.homeScore)} ${homeLabel}`
        : null;
    return {
        description: last.description.trim(),
        scoreboard,
        clockLabel: formatPlayClock(last),
    };
}
function buildLastPlayText(summary, fallbackMessage, includeScoreboard = true) {
    if (summary) {
        const segments = [summary.description];
        if (includeScoreboard && summary.scoreboard) {
            segments.push(summary.scoreboard);
        }
        return segments.join(" • ");
    }
    if (fallbackMessage) {
        return fallbackMessage;
    }
    return "Play-by-play data unavailable.";
}
function getNumericGameId(game) {
    if (!game || game.id == null) {
        return null;
    }
    const numeric = Number.parseInt(String(game.id), 10);
    return Number.isNaN(numeric) ? null : numeric;
}
function shouldFetchPlaySummary(game) {
    const statusText = typeof game.status === "string" ? game.status.trim().toLowerCase() : "";
    const compact = statusText.replace(/[^a-z]/g, "");
    if (!compact) {
        return true;
    }
    if (/^(scheduled|pregame|upcoming|tbd|tba)$/.test(compact)) {
        return false;
    }
    if (/^(cancelled|canceled|postponed)$/.test(compact)) {
        return false;
    }
    return true;
}
function formatPeriod(period) {
    if (!isFiniteScore(period) || period <= 0) {
        return null;
    }
    if (period === 1)
        return "1st Half";
    if (period === 2)
        return "2nd Half";
    if (period > 2) {
        const overtime = period - 2;
        return overtime === 1 ? "OT" : `${overtime}OT`;
    }
    return null;
}
function extractClock(game) {
    const dynamic = game;
    const candidates = [
        "display_clock",
        "clock",
        "status_clock",
        "time_remaining",
        "time_left",
        "status_time",
    ];
    for (const key of candidates) {
        if (!(key in dynamic)) {
            continue;
        }
        const value = dynamic[key];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return null;
}
function parseProgressLabel(label) {
    if (!label) {
        return { period: null, clock: null };
    }
    const segments = label
        .split("•")
        .map(segment => segment.trim())
        .filter(Boolean);
    if (segments.length === 0) {
        return { period: null, clock: null };
    }
    if (segments.length === 1) {
        return { period: segments[0], clock: null };
    }
    return { period: segments[0], clock: segments.slice(1).join(" • ") };
}
function renderTeamLogo(team, label) {
    const logoUrl = getTeamLogoUrl(team);
    if (logoUrl) {
        const safeSrc = escapeAttr(logoUrl);
        const safeAlt = escapeAttr(`${label} logo`);
        return `<span class="game-card__team-logo"><img class="game-card__team-logo-image" src="${safeSrc}" alt="${safeAlt}" loading="lazy" decoding="async"></span>`;
    }
    const [primary, secondary] = getTeamAccentColors(team);
    const monogram = getTeamMonogram(team);
    const safeLabel = escapeAttr(`${label} logo`);
    const style = escapeAttr(`--team-accent-primary: ${primary}; --team-accent-secondary: ${secondary};`);
    const safeMonogram = escapeHtml(monogram);
    return `<span class="game-card__team-logo game-card__team-logo--fallback" role="img" aria-label="${safeLabel}" style="${style}">${safeMonogram}</span>`;
}
function renderTeamRow(team, score, isHome, isLeading) {
    const name = escapeHtml(team.full_name ?? team.name ?? "Team");
    const abbr = escapeHtml(team.abbreviation ?? (isHome ? "HOME" : "AWAY"));
    const rowLabel = team.full_name ?? team.name ?? (isHome ? "Home" : "Away");
    const logo = renderTeamLogo(team, rowLabel);
    return `<div class="game-card__team game-card__team--${isHome ? "home" : "away"}${isLeading ? " is-leading" : ""}">${logo}<span class="game-card__team-abbr" aria-hidden="true">${abbr}</span><span class="game-card__team-name">${name}</span><span class="game-card__team-score">${formatScore(score)}</span></div>`;
}
function renderGameCard(game) {
    const href = `${BASE}game.html?game_id=${encodeURIComponent(String(game.id))}`;
    const safeHref = escapeAttr(href);
    const status = describeStatus(game);
    const timeLabel = formatDateLabel(game.date);
    const isLive = isLiveStatus(status);
    const defaultMeta = escapeAttr(timeLabel);
    const initialMeta = escapeHtml(isLive ? LAST_PLAY_PLACEHOLDER : timeLabel);
    const homeScore = game.home_score;
    const awayScore = game.away_score;
    const hasScores = isFiniteScore(homeScore) && isFiniteScore(awayScore);
    const homeLeading = hasScores && Number(homeScore) > Number(awayScore);
    const awayLeading = hasScores && Number(awayScore) > Number(homeScore);
    const statusDetail = !isLive && status.detail
        ? `<span class="game-card__status" data-role="game-status-detail">${escapeHtml(status.detail)}</span>`
        : "";
    const badge = status.label
        ? `<span class="badge"${status.variant ? ` data-variant="${escapeAttr(status.variant)}"` : ""}>${escapeHtml(status.label)}</span>`
        : "";
    const initialClock = status.detail ?? status.label ?? "—";
    const safeInitialClock = escapeHtml(initialClock || "—");
    const progressDetail = parseProgressLabel(status.detail ?? null);
    const initialPeriod = formatPeriod(game.period) ?? progressDetail.period ?? "";
    const initialClockRemaining = extractClock(game) ?? progressDetail.clock ?? "";
    const safeInitialPeriod = escapeHtml(initialPeriod || (isLive ? status.label ?? "Live" : ""));
    const safeInitialClockRemaining = escapeHtml(initialClockRemaining || (isLive ? "—" : ""));
    const safeGameState = escapeAttr(isLive ? "live" : "default");
    const safeGameId = escapeAttr(String(game.id));
    return `<li class="card game-card" data-status="${escapeAttr(game.status ?? "")}" data-game-state="${safeGameState}" data-game-id="${safeGameId}"><a class="game-card__link" href="${safeHref}"><div class="game-card__header"><div class="game-card__meta"><div class="game-card__progress" data-role="game-progress"${isLive ? "" : " hidden"}><span class="game-card__progress-period" data-role="game-progress-period">${safeInitialPeriod}</span><span class="game-card__progress-clock" data-role="game-progress-clock">${safeInitialClockRemaining}</span></div><span class="game-card__time" data-role="game-meta" data-default-meta="${defaultMeta}" data-live-placeholder="${escapeAttr(LAST_PLAY_PLACEHOLDER)}">${initialMeta}</span>${statusDetail}</div>${badge}</div><div class="game-card__body">${renderTeamRow(game.visitor_team, awayScore, false, awayLeading)}${renderTeamRow(game.home_team, homeScore, true, homeLeading)}</div><div class="game-card__footer"><span class="game-card__clock" data-role="game-clock" aria-live="polite">${safeInitialClock}</span><p class="game-card__last-play" data-role="game-last-play-container" aria-live="polite"><span class="game-card__last-play-label">Last play</span><span class="game-card__last-play-text" data-role="game-last-play">${escapeHtml(LAST_PLAY_PLACEHOLDER)}</span></p></div></a></li>`;
}
function renderLoading(list) {
    list.innerHTML = `<li class="card game-card game-card--loading"><div class="game-card__header"><div class="game-card__meta"><span class="game-card__time">Loading games</span></div></div><p class="game-card__message">Fetching the latest schedule…</p></li>`;
}
function renderEmpty(list) {
    list.innerHTML = `<li class="card game-card game-card--empty"><div class="game-card__header"><div class="game-card__meta"><span class="game-card__time">No games in this range</span></div></div><p class="game-card__message">Try another range to explore more matchups.</p></li>`;
}
function renderError(list) {
    list.innerHTML = `<li class="card game-card game-card--error"><div class="game-card__header"><div class="game-card__meta"><span class="game-card__time">Unable to load games</span></div></div><p class="game-card__message">Please try again in a moment.</p></li>`;
}
function renderGames(list, games) {
    if (games.length === 0) {
        renderEmpty(list);
        return;
    }
    list.innerHTML = games.map(renderGameCard).join("");
}
const app = document.getElementById("app");
if (!app) {
    throw new Error("Missing #app root element");
}
await requireOk("data/division-one-programs.json", "Games");
app.innerHTML = `<div class="page stack" data-gap="lg"><section class="card games-hero"><div class="games-hero__body"><div class="games-hero__intro stack" data-gap="xs"><span class="page-label">Scoreboard</span><h1>Games</h1><p class="page-summary">Pick any date range to track Division I matchups in Eastern Time.</p></div><form id="games-controls" class="games-hero__form games-controls" autocomplete="off"><div class="games-controls__inputs"><label class="games-controls__field"><span class="games-controls__label">Start date</span><input type="date" id="start-date" name="start" required></label><label class="games-controls__field"><span class="games-controls__label">End date</span><input type="date" id="end-date" name="end" required></label></div><div class="games-controls__actions"><button id="load" class="button" data-variant="primary" type="submit">Update</button></div><p class="games-controls__hint">Tip-off times shown in Eastern Time (ET).</p></form></div></section><section><ul id="games-list" class="games-grid" aria-live="polite" aria-busy="false"></ul></section></div>`;
const formEl = app.querySelector("#games-controls");
const startInputEl = app.querySelector("#start-date");
const endInputEl = app.querySelector("#end-date");
const loadButtonEl = app.querySelector("#load");
const listEl = app.querySelector("#games-list");
if (!formEl || !startInputEl || !endInputEl || !loadButtonEl || !listEl) {
    throw new Error("Failed to initialise games page controls");
}
const form = formEl;
const startInput = startInputEl;
const endInput = endInputEl;
const loadButton = loadButtonEl;
const list = listEl;
function applyDateSelection(selection) {
    const normalizedStart = selection.start ? ensureISODate(selection.start) : null;
    startInput.value = normalizedStart ?? selection.start ?? "";
    const normalizedEnd = selection.end ? ensureISODate(selection.end) : null;
    endInput.value = normalizedEnd ?? selection.end ?? "";
}
function getSelectedRange() {
    const normalizedStart = ensureISODate(startInput.value);
    const normalizedEnd = ensureISODate(endInput.value);
    startInput.value = normalizedStart ?? "";
    endInput.value = normalizedEnd ?? "";
    if (!normalizedStart && !normalizedEnd) {
        return null;
    }
    if (normalizedStart && normalizedEnd && normalizedStart > normalizedEnd) {
        startInput.value = normalizedEnd;
        endInput.value = normalizedStart;
        return { start: normalizedEnd, end: normalizedStart };
    }
    if (normalizedStart && !normalizedEnd) {
        endInput.value = normalizedStart;
        return { start: normalizedStart, end: normalizedStart };
    }
    if (!normalizedStart && normalizedEnd) {
        startInput.value = normalizedEnd;
        return { start: normalizedEnd, end: normalizedEnd };
    }
    return { start: normalizedStart ?? null, end: normalizedEnd ?? null };
}
let activeRequest = 0;
let activeSummaryToken = 0;
function updateGameCardSummary(list, game, status, summaryToken, requestId, summary, fallbackMessage) {
    if (requestId !== activeRequest || summaryToken !== activeSummaryToken) {
        return;
    }
    const id = getNumericGameId(game);
    if (id === null) {
        return;
    }
    const card = list.querySelector(`.game-card[data-game-id="${id}"]`);
    if (!card) {
        return;
    }
    const progressEl = card.querySelector('[data-role="game-progress"]');
    const periodEl = card.querySelector('[data-role="game-progress-period"]');
    const clockProgressEl = card.querySelector('[data-role="game-progress-clock"]');
    const metaEl = card.querySelector('[data-role="game-meta"]');
    const clockEl = card.querySelector('[data-role="game-clock"]');
    const playEl = card.querySelector('[data-role="game-last-play"]');
    const playContainer = card.querySelector('[data-role="game-last-play-container"]');
    const isLive = isLiveStatus(status);
    card.setAttribute("data-game-state", isLive ? "live" : "default");
    const metaDefault = metaEl?.getAttribute("data-default-meta") ?? null;
    if (progressEl) {
        if (isLive) {
            progressEl.removeAttribute("hidden");
            const progress = parseProgressLabel(summary?.clockLabel ?? status.detail ?? null);
            const periodText = progress.period ?? formatPeriod(game.period) ?? status.label ?? "Live";
            const clockText = progress.clock ?? extractClock(game) ?? "";
            if (periodEl) {
                periodEl.textContent = periodText || "Live";
            }
            if (clockProgressEl) {
                clockProgressEl.textContent = clockText || "—";
            }
        }
        else {
            progressEl.setAttribute("hidden", "");
            if (periodEl) {
                periodEl.textContent = "";
            }
            if (clockProgressEl) {
                clockProgressEl.textContent = "";
            }
        }
    }
    if (clockEl) {
        const clockText = summary?.clockLabel ?? status.detail ?? status.label ?? "—";
        clockEl.textContent = clockText || "—";
    }
    if (metaEl) {
        if (isLive) {
            const fallback = summary ? undefined : fallbackMessage ?? metaEl.getAttribute("data-live-placeholder") ?? undefined;
            metaEl.textContent = buildLastPlayText(summary, fallback, false);
        }
        else if (metaDefault) {
            metaEl.textContent = metaDefault;
        }
    }
    if (playEl) {
        playEl.textContent = buildLastPlayText(summary, fallbackMessage);
    }
    if (playContainer) {
        if (isLive) {
            playContainer.setAttribute("hidden", "");
        }
        else {
            playContainer.removeAttribute("hidden");
        }
    }
}
async function hydrateGameSummaries(list, games, requestId) {
    const summaryToken = ++activeSummaryToken;
    if (requestId !== activeRequest) {
        return;
    }
    const queue = [];
    for (const game of games) {
        const status = describeStatus(game);
        if (!shouldFetchPlaySummary(game)) {
            updateGameCardSummary(list, game, status, summaryToken, requestId, null, "Play-by-play updates will appear once the game tips off.");
            continue;
        }
        queue.push({ game, status });
    }
    if (queue.length === 0) {
        return;
    }
    let index = 0;
    const concurrency = Math.min(4, queue.length);
    async function worker() {
        while (index < queue.length) {
            const current = index;
            index += 1;
            const entry = queue[current];
            if (!entry) {
                continue;
            }
            const { game, status } = entry;
            try {
                const plays = await getGamePlayByPlay(game.id);
                if (requestId !== activeRequest || summaryToken !== activeSummaryToken) {
                    return;
                }
                const summary = buildPlaySummary(game, plays);
                updateGameCardSummary(list, game, status, summaryToken, requestId, summary, summary
                    ? undefined
                    : "Play-by-play updates are not available yet.");
            }
            catch (error) {
                console.error(`Failed to load play-by-play for game ${game.id}`, error);
                updateGameCardSummary(list, game, status, summaryToken, requestId, null, "Unable to load play-by-play right now.");
            }
        }
    }
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
}
async function loadGames(showLoader) {
    const selection = getSelectedRange();
    if (!selection || !selection.start || !selection.end) {
        renderEmpty(list);
        return;
    }
    const { start, end } = selection;
    const requestId = ++activeRequest;
    list.setAttribute("aria-busy", "true");
    loadButton.disabled = true;
    if (showLoader) {
        renderLoading(list);
    }
    try {
        const fetchStart = start;
        const fetchEnd = addDaysToISODate(end, 1) ?? end;
        const { data } = await NCAAM.games(1, 200, fetchStart, fetchEnd);
        if (requestId !== activeRequest) {
            return;
        }
        const games = Array.isArray(data) ? [...data] : [];
        const filtered = games.filter(game => {
            const gameDay = toEasternISODateString(game.date);
            if (!gameDay) {
                return false;
            }
            return gameDay >= start && gameDay <= end;
        });
        filtered.sort((a, b) => {
            const aTime = a.date ? Date.parse(a.date) : Number.NaN;
            const bTime = b.date ? Date.parse(b.date) : Number.NaN;
            if (Number.isNaN(aTime) && Number.isNaN(bTime))
                return 0;
            if (Number.isNaN(aTime))
                return 1;
            if (Number.isNaN(bTime))
                return -1;
            return aTime - bTime;
        });
        renderGames(list, filtered);
        void hydrateGameSummaries(list, filtered, requestId);
    }
    catch (error) {
        if (requestId !== activeRequest) {
            return;
        }
        console.error("Failed to load games", error);
        renderError(list);
    }
    finally {
        if (requestId === activeRequest) {
            list.setAttribute("aria-busy", "false");
            loadButton.disabled = false;
        }
    }
}
const initialSelection = getDefaultSelection();
applyDateSelection(initialSelection);
void loadGames(true);
form.addEventListener("submit", event => {
    event.preventDefault();
    void loadGames(true);
});
function handleInputChange() {
    void loadGames(true);
}
startInput.addEventListener("change", handleInputChange);
endInput.addEventListener("change", handleInputChange);
function handleInputKeydown(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        form.requestSubmit();
    }
}
startInput.addEventListener("keydown", handleInputKeydown);
endInput.addEventListener("keydown", handleInputKeydown);
