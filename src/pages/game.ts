import { BASE } from "../lib/config.js";
import { NCAAM, type Game, type Play } from "../lib/sdk/ncaam.js";
import {
  getTeamAccentColors,
  getTeamLogoUrl,
  getTeamMonogram,
} from "../lib/ui/logos.js";

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

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatScore(value: number | null | undefined): string {
  return isNumber(value) ? String(value) : "—";
}

function formatDateLabel(dateString: string | null): string {
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

function formatPeriod(period: number | null | undefined): string | null {
  if (!isNumber(period) || period <= 0) {
    return null;
  }
  if (period === 1) return "1st";
  if (period === 2) return "2nd";
  if (period === 3) return "3rd";
  if (period === 4) return "4th";
  if (period > 4) {
    const overtime = period - 4;
    return overtime === 1 ? "OT" : `${overtime}OT`;
  }
  return null;
}

function describeStatus(game: Game): { label: string; variant?: string } {
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

function buildLineScore(game: Game) {
  const segments = [
    { label: "H1", away: game.away_score_h1, home: game.home_score_h1 },
    { label: "H2", away: game.away_score_h2, home: game.home_score_h2 },
  ];
  if (isNumber(game.away_score_ot) || isNumber(game.home_score_ot)) {
    segments.push({ label: "OT", away: game.away_score_ot, home: game.home_score_ot });
  }
  return segments.filter(segment => isNumber(segment.away) || isNumber(segment.home));
}

function renderTeamLogo(team: Game["home_team"]): string {
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
  const style = escapeAttr(
    `--team-accent-primary: ${accentPrimary}; --team-accent-secondary: ${accentSecondary};`,
  );
  return `<span class="game-card__team-logo game-card__team-logo--fallback" role="img" aria-label="${safeLabel}" style="${style}">${monogram}</span>`;
}

function renderTeamRow(
  team: Game["home_team"],
  score: number | null | undefined,
  isLeading: boolean,
  side: "home" | "away",
): string {
  const name = team.full_name ?? team.name;
  const abbr = team.abbreviation ?? (side === "home" ? "HOME" : "AWAY");
  return `<div class="game-card__team game-card__team--${side}${isLeading ? " is-leading" : ""}">
    ${renderTeamLogo(team)}
    <span class="game-card__team-abbr" aria-hidden="true">${abbr}</span>
    <span class="game-card__team-name">${name}</span>
    <span class="game-card__team-score">${formatScore(score)}</span>
  </div>`;
}

function renderLineScore(game: Game): string {
  const segments = buildLineScore(game);
  if (segments.length === 0) {
    return "";
  }
  const awayLabel = game.visitor_team.abbreviation ?? "Away";
  const homeLabel = game.home_team.abbreviation ?? "Home";
  const rows = segments
    .map(
      segment => `<div class="game-card__line-score-row">
      <span>${segment.label}</span>
      <span>${formatScore(segment.away)}</span>
      <span>${formatScore(segment.home)}</span>
    </div>`,
    )
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

function parseGameId(): number | null {
  if (typeof location === "undefined") {
    return null;
  }
  const params = new URLSearchParams(location.search);
  const raw = params.get("game_id");
  if (!raw) {
    return null;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}

function updateHero(game: Game): void {
  if (typeof document === "undefined") {
    return;
  }
  const heroHeading = document.querySelector<HTMLElement>(".hero h1");
  const heroLede = document.querySelector<HTMLElement>(".hero__lede");
  const awayName = game.visitor_team.full_name ?? game.visitor_team.name ?? "Away";
  const homeName = game.home_team.full_name ?? game.home_team.name ?? "Home";
  if (heroHeading) {
    heroHeading.textContent = `${awayName} at ${homeName}`;
  }
  if (heroLede) {
    const status = describeStatus(game).label;
    const dateLabel = formatDateLabel(game.date);
    const summaryParts = [status, dateLabel].filter(part => part && part.length > 0);
    heroLede.textContent = summaryParts.join(" • ") || "Live scoring and possession breakdown.";
  }
}

function updateDocumentTitle(game: Game): void {
  if (typeof document === "undefined") {
    return;
  }
  const awayName = game.visitor_team.full_name ?? game.visitor_team.name ?? "Away";
  const homeName = game.home_team.full_name ?? game.home_team.name ?? "Home";
  const status = describeStatus(game).label;
  const titleParts = [`${awayName} at ${homeName}`, status, "NCAAM Hub"];
  document.title = titleParts.filter(Boolean).join(" · ");
}

const app = document.getElementById("app");
if (!app) {
  throw new Error("Missing game app container");
}

app.innerHTML = `<div class="game-detail stack" data-gap="lg" aria-live="polite" aria-busy="true"></div>`;

const containerNode = app.querySelector(".game-detail");
if (!(containerNode instanceof HTMLDivElement)) {
  throw new Error("Missing game detail container");
}
const container = containerNode;

function setBusy(isBusy: boolean) {
  container.setAttribute("aria-busy", isBusy ? "true" : "false");
}

function renderStatusCard(title: string, message: string) {
  container.innerHTML = `<section class="card stack" data-gap="sm">
    <h2 class="section-title">${escapeHtml(title)}</h2>
    <p class="section-summary">${escapeHtml(message)}</p>
  </section>`;
}

function renderLoading() {
  renderStatusCard("Loading game", "Fetching live data from the worker proxy…");
}

function renderInvalidSelection() {
  renderStatusCard("Select a game", "Use the games page to choose a matchup and view its live recap.");
}

function renderNotFound() {
  renderStatusCard("Game unavailable", "We couldn't find that matchup. Try returning to the games page and picking a different game.");
}

function renderError() {
  renderStatusCard("Something went wrong", "We hit a snag while loading this game. Please try again in a moment.");
}

function renderScoreboard(game: Game): string {
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
  return `<section class="card game-card" data-status="${game.status ?? ""}">
    <div class="game-card__header">
      <span class="game-card__time">${headerLabel}</span>
      ${badge}
    </div>
    <div class="game-card__body">
      ${renderTeamRow(game.visitor_team, awayScore, awayLeading, "away")}
      ${renderTeamRow(game.home_team, homeScore, homeLeading, "home")}
    </div>
    ${renderLineScore(game)}
  </section>`;
}

function renderPlayItem(play: Play, awayLabel: string, homeLabel: string): string {
  const metaSegments: string[] = [];
  const period = formatPeriod(play.period);
  if (period) {
    metaSegments.push(`<span>${escapeHtml(period)}</span>`);
  }
  const clock = typeof play.clock === "string" ? play.clock.trim() : "";
  if (clock) {
    metaSegments.push(`<span class="play-feed__clock">${escapeHtml(clock)}</span>`);
  }
  const teamAbbr = play.team?.abbreviation ?? play.team?.name ?? "";
  if (teamAbbr) {
    metaSegments.push(`<span class="play-feed__team">${escapeHtml(teamAbbr)}</span>`);
  }
  const meta = metaSegments.length ? `<div class="play-feed__meta">${metaSegments.join("")}</div>` : "";
  const description = play.text ? escapeHtml(play.text) : "Play update unavailable.";
  const hasScore = isNumber(play.home_score) || isNumber(play.away_score);
  const score = hasScore
    ? `<div class="play-feed__score" aria-label="Score">${escapeHtml(
        `${awayLabel} ${formatScore(play.away_score)} – ${formatScore(play.home_score)} ${homeLabel}`,
      )}</div>`
    : "";
  const scoringAttr = play.scoring_play ? " data-scoring-play=\"true\"" : "";
  return `<li class="play-feed__item"${scoringAttr}>
    ${meta}
    <p class="play-feed__text">${description}</p>
    ${score}
  </li>`;
}

function renderPlaysSection(game: Game, plays: Play[]): string {
  const awayLabel = game.visitor_team.abbreviation ?? game.visitor_team.name ?? "Away";
  const homeLabel = game.home_team.abbreviation ?? game.home_team.name ?? "Home";
  if (plays.length === 0) {
    return `<section class="card play-feed">
      <header class="play-feed__header">
        <h2 class="section-title">Play-by-play</h2>
        <p class="section-summary">Play-by-play data isn't available for this matchup yet.</p>
      </header>
      <p class="play-feed__empty">Check back once the game tips off for a live possession log.</p>
    </section>`;
  }
  const items = plays.map(play => renderPlayItem(play, awayLabel, homeLabel)).join("");
  return `<section class="card play-feed">
    <header class="play-feed__header">
      <h2 class="section-title">Play-by-play</h2>
      <p class="section-summary">Possession-by-possession updates direct from the Cloudflare worker proxy.</p>
    </header>
    <ol class="play-feed__list">${items}</ol>
  </section>`;
}

function renderGame(game: Game, plays: Play[]) {
  const backHref = escapeAttr(`${BASE}games.html`);
  container.innerHTML = `<a class="game-detail__back-link" href="${backHref}">← Back to games</a>
    ${renderScoreboard(game)}
    ${renderPlaysSection(game, plays)}`;
}

async function loadGame(gameId: number) {
  setBusy(true);
  renderLoading();
  try {
    const [game, playsResponse] = await Promise.all([NCAAM.game(gameId), NCAAM.plays(gameId)]);
    if (!game) {
      renderNotFound();
      return;
    }
    const plays = Array.isArray(playsResponse?.data) ? [...playsResponse.data] : [];
    plays.sort((a, b) => a.order - b.order);
    renderGame(game, plays);
    updateHero(game);
    updateDocumentTitle(game);
  } catch (error) {
    console.error("Failed to load game detail", error);
    renderError();
  } finally {
    setBusy(false);
  }
}

const gameId = parseGameId();
if (gameId === null) {
  setBusy(false);
  renderInvalidSelection();
} else {
  void loadGame(gameId);
}
