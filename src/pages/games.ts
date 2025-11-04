import { BASE } from "../lib/config.js";
import { NCAAM, type Game } from "../lib/sdk/ncaam.js";
import {
  getTeamAccentColors,
  getTeamLogoUrl,
  getTeamMonogram,
} from "../lib/ui/logos.js";

const DEFAULT_TIME_ZONE = "America/New_York";

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

type DateSelection = {
  day: string | null;
};

type StatusDescriptor = {
  label: string;
  variant?: string;
  detail?: string | null;
};

const ESCAPE_ATTR = /[&<>"']/g;
const ESCAPE_HTML = /[&<>]/g;
const ESCAPE_REPLACEMENTS: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeAttr(value: string): string {
  return value.replace(ESCAPE_ATTR, char => ESCAPE_REPLACEMENTS[char] ?? char);
}

function escapeHtml(value: string): string {
  return value.replace(ESCAPE_HTML, char => ESCAPE_REPLACEMENTS[char] ?? char);
}

function toTimeZoneISODate(date: Date): string {
  return ISO_DATE_DISPLAY.format(date);
}

function ensureISODate(value: string): string | null {
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

function addDaysToISODate(value: string, days: number): string | null {
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

function toEasternISODateString(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return toTimeZoneISODate(new Date(timestamp));
}

function getDefaultSelection(): DateSelection {
  const today = new Date();
  const formatted = toTimeZoneISODate(today);
  return { day: ensureISODate(formatted) ?? formatted };
}

function formatDateLabel(dateString: string | null | undefined): string {
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

function isFiniteScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatScore(value: unknown): string {
  return isFiniteScore(value) ? String(value) : "—";
}

function describeStatus(game: Game): StatusDescriptor {
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

  if (/^(live|inprogress)$/.test(compact) || compact.includes("live")) {
    const detail = [formatPeriod(game.period), extractClock(game)]
      .filter(Boolean)
      .join(" • ");
    return { label: "Live", variant: "arc", detail: detail || null };
  }

  const prettified = statusText.replace(/\b\w/g, char => char.toUpperCase());
  return { label: prettified, detail: prettified };
}

function formatPeriod(period: Game["period"]): string | null {
  if (!isFiniteScore(period) || period <= 0) {
    return null;
  }
  if (period === 1) return "1st Half";
  if (period === 2) return "2nd Half";
  if (period > 2) {
    const overtime = period - 2;
    return overtime === 1 ? "OT" : `${overtime}OT`;
  }
  return null;
}

function extractClock(game: Game): string | null {
  const dynamic = game as Record<string, unknown>;
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

function renderTeamLogo(team: Game["home_team"], label: string): string {
  const logoUrl = getTeamLogoUrl(team);
  if (logoUrl) {
    const safeSrc = escapeAttr(logoUrl);
    const safeAlt = escapeAttr(`${label} logo`);
    return `<span class="game-card__team-logo"><img class="game-card__team-logo-image" src="${safeSrc}" alt="${safeAlt}" loading="lazy" decoding="async"></span>`;
  }

  const [primary, secondary] = getTeamAccentColors(team);
  const monogram = getTeamMonogram(team);
  const safeLabel = escapeAttr(`${label} logo`);
  const style = escapeAttr(
    `--team-accent-primary: ${primary}; --team-accent-secondary: ${secondary};`,
  );
  const safeMonogram = escapeHtml(monogram);
  return `<span class="game-card__team-logo game-card__team-logo--fallback" role="img" aria-label="${safeLabel}" style="${style}">${safeMonogram}</span>`;
}

function renderTeamRow(
  team: Game["home_team"],
  score: unknown,
  isHome: boolean,
  isLeading: boolean,
): string {
  const name = escapeHtml(team.full_name ?? team.name ?? "Team");
  const abbr = escapeHtml(team.abbreviation ?? (isHome ? "HOME" : "AWAY"));
  const rowLabel = team.full_name ?? team.name ?? (isHome ? "Home" : "Away");
  const logo = renderTeamLogo(team, rowLabel);
  return `<div class="game-card__team game-card__team--${isHome ? "home" : "away"}${
    isLeading ? " is-leading" : ""
  }">${logo}<span class="game-card__team-abbr" aria-hidden="true">${abbr}</span><span class="game-card__team-name">${name}</span><span class="game-card__team-score">${formatScore(
    score,
  )}</span></div>`;
}

function renderGameCard(game: Game): string {
  const href = `${BASE}game.html?game_id=${encodeURIComponent(String(game.id))}`;
  const safeHref = escapeAttr(href);
  const timeLabel = escapeHtml(formatDateLabel(game.date));
  const status = describeStatus(game);
  const homeScore = game.home_score;
  const awayScore = game.away_score;
  const hasScores = isFiniteScore(homeScore) && isFiniteScore(awayScore);
  const homeLeading = hasScores && Number(homeScore) > Number(awayScore);
  const awayLeading = hasScores && Number(awayScore) > Number(homeScore);
  const statusDetail = status.detail ? `<span class="game-card__status">${escapeHtml(status.detail)}</span>` : "";
  const badge = status.label
    ? `<span class="badge"${status.variant ? ` data-variant="${escapeAttr(status.variant)}"` : ""}>${escapeHtml(status.label)}</span>`
    : "";

  return `<li class="card game-card" data-status="${escapeAttr(game.status ?? "")}"><a class="game-card__link" href="${safeHref}"><div class="game-card__header"><div class="game-card__meta"><span class="game-card__time">${timeLabel}</span>${statusDetail}</div>${badge}</div><div class="game-card__body">${renderTeamRow(
    game.visitor_team,
    awayScore,
    false,
    awayLeading,
  )}${renderTeamRow(game.home_team, homeScore, true, homeLeading)}</div></a></li>`;
}

function renderLoading(list: HTMLUListElement) {
  list.innerHTML = `<li class="card game-card game-card--loading"><div class="game-card__header"><div class="game-card__meta"><span class="game-card__time">Loading games</span></div></div><p class="game-card__message">Fetching the latest schedule…</p></li>`;
}

function renderEmpty(list: HTMLUListElement) {
  list.innerHTML = `<li class="card game-card game-card--empty"><div class="game-card__header"><div class="game-card__meta"><span class="game-card__time">No games on this date</span></div></div><p class="game-card__message">Try another day to explore more matchups.</p></li>`;
}

function renderError(list: HTMLUListElement) {
  list.innerHTML = `<li class="card game-card game-card--error"><div class="game-card__header"><div class="game-card__meta"><span class="game-card__time">Unable to load games</span></div></div><p class="game-card__message">Please try again in a moment.</p></li>`;
}

function renderGames(list: HTMLUListElement, games: Game[]) {
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

app.innerHTML = `<div class="page stack" data-gap="lg"><section class="card games-hero"><div class="games-hero__body"><div class="games-hero__intro stack" data-gap="xs"><span class="page-label">Scoreboard</span><h1>Games</h1><p class="page-summary">Pick any date to track Division I matchups in Eastern Time.</p></div><form id="games-controls" class="games-hero__form games-controls" autocomplete="off"><div class="games-controls__inputs"><label class="games-controls__field"><span class="games-controls__label">Date</span><input type="date" id="date" name="date" required></label></div><div class="games-controls__actions"><button id="load" class="button" data-variant="primary" type="submit">Update</button></div><p class="games-controls__hint">Tip-off times shown in Eastern Time (ET).</p></form></div></section><section><ul id="games-list" class="games-grid" aria-live="polite" aria-busy="false"></ul></section></div>`;

const formEl = app.querySelector<HTMLFormElement>("#games-controls");
const dateInputEl = app.querySelector<HTMLInputElement>("#date");
const loadButtonEl = app.querySelector<HTMLButtonElement>("#load");
const listEl = app.querySelector<HTMLUListElement>("#games-list");

if (!formEl || !dateInputEl || !loadButtonEl || !listEl) {
  throw new Error("Failed to initialise games page controls");
}

const form = formEl;
const dateInput = dateInputEl;
const loadButton = loadButtonEl;
const list = listEl;

function applyDateSelection(selection: DateSelection): void {
  if (selection.day) {
    const normalized = ensureISODate(selection.day);
    dateInput.value = normalized ?? selection.day;
  }
}

function getSelectedDay(): string | null {
  const normalized = ensureISODate(dateInput.value);
  if (normalized) {
    dateInput.value = normalized;
    return normalized;
  }
  dateInput.value = "";
  return null;
}

let activeRequest = 0;

async function loadGames(showLoader: boolean): Promise<void> {
  const selectedDay = getSelectedDay();

  if (!selectedDay) {
    renderEmpty(list);
    return;
  }

  const requestId = ++activeRequest;
  list.setAttribute("aria-busy", "true");
  loadButton.disabled = true;

  if (showLoader) {
    renderLoading(list);
  }

  try {
    const fetchStart = selectedDay;
    const fetchEnd = addDaysToISODate(selectedDay, 1) ?? selectedDay;
    const { data } = await NCAAM.games(1, 200, fetchStart, fetchEnd);
    if (requestId !== activeRequest) {
      return;
    }
    const games = Array.isArray(data) ? [...data] : [];
    const filtered = games.filter(game => {
      const gameDay = toEasternISODateString(game.date);
      return gameDay === selectedDay;
    });
    filtered.sort((a, b) => {
      const aTime = a.date ? Date.parse(a.date) : Number.NaN;
      const bTime = b.date ? Date.parse(b.date) : Number.NaN;
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return aTime - bTime;
    });
    renderGames(list, filtered);
  } catch (error) {
    if (requestId !== activeRequest) {
      return;
    }
    console.error("Failed to load games", error);
    renderError(list);
  } finally {
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

dateInput.addEventListener("change", () => {
  void loadGames(true);
});

dateInput.addEventListener("keydown", event => {
  if ((event as KeyboardEvent).key === "Enter") {
    event.preventDefault();
    form.requestSubmit();
  }
});
