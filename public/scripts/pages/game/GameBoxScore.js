function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function formatName(player) {
    const full = player.fullName ??
        [player.firstName, player.lastName].filter(Boolean).join(" ");
    const jersey = player.jerseyNumber ? `#${player.jerseyNumber}` : null;
    const parts = [full || "Player", player.position ? `(${player.position})` : null]
        .filter(Boolean)
        .join(" ");
    return jersey ? `${jersey} ${parts}` : parts;
}
function formatMinutes(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return "—";
    }
    const wholeSeconds = Math.round(seconds);
    const minutes = Math.floor(wholeSeconds / 60);
    const remainder = Math.max(0, wholeSeconds % 60);
    return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}
function formatPair(made, attempts) {
    return `${made ?? 0}-${attempts ?? 0}`;
}
function renderPlayerRow(player) {
    const name = escapeHtml(formatName(player));
    const minutes = formatMinutes(player.seconds);
    return `<tr>
    <th scope="row">${name}</th>
    <td>${escapeHtml(minutes)}</td>
    <td>${escapeHtml(formatPair(player.fgm, player.fga))}</td>
    <td>${escapeHtml(formatPair(player.tpm, player.tpa))}</td>
    <td>${escapeHtml(formatPair(player.ftm, player.fta))}</td>
    <td>${player.oreb}</td>
    <td>${player.dreb}</td>
    <td>${player.reb}</td>
    <td>${player.ast}</td>
    <td>${player.stl}</td>
    <td>${player.blk}</td>
    <td>${player.tov}</td>
    <td>${player.pf}</td>
    <td>${player.pts}</td>
  </tr>`;
}
function renderTotalsRow(label, totals) {
    const minutes = formatMinutes(totals.seconds);
    return `<tr class="box-score__totals">
    <th scope="row">${escapeHtml(label)}</th>
    <td>${escapeHtml(minutes)}</td>
    <td>${escapeHtml(formatPair(totals.fgm, totals.fga))}</td>
    <td>${escapeHtml(formatPair(totals.tpm, totals.tpa))}</td>
    <td>${escapeHtml(formatPair(totals.ftm, totals.fta))}</td>
    <td>${totals.oreb}</td>
    <td>${totals.dreb}</td>
    <td>${totals.reb}</td>
    <td>${totals.ast}</td>
    <td>${totals.stl}</td>
    <td>${totals.blk}</td>
    <td>${totals.tov}</td>
    <td>${totals.pf}</td>
    <td>${totals.pts}</td>
  </tr>`;
}
function renderPlayersSection(players) {
    return players.map(renderPlayerRow).join("");
}
function renderBenchSection(bench) {
    if (bench.length === 0) {
        return "";
    }
    return `<tr class="box-score__group"><th scope="row" colspan="14">Bench</th></tr>${renderPlayersSection(bench)}`;
}
function renderTeamTable(teamBox, teamLabel) {
    const starters = renderPlayersSection(teamBox.starters);
    const bench = renderBenchSection(teamBox.bench);
    const totals = renderTotalsRow("Team Totals", teamBox.totals);
    const hasPlayers = teamBox.players.length > 0;
    const body = hasPlayers
        ? `${starters}${bench}${totals}`
        : `<tr><td colspan="14">Box score data is still loading for this team.</td></tr>`;
    return `<div class="box-score__team">
    <h3 class="box-score__team-name">${escapeHtml(teamLabel)}</h3>
    <div class="table-shell box-score__table">
      <table>
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">MIN</th>
            <th scope="col">FG</th>
            <th scope="col">3PT</th>
            <th scope="col">FT</th>
            <th scope="col">OREB</th>
            <th scope="col">DREB</th>
            <th scope="col">REB</th>
            <th scope="col">AST</th>
            <th scope="col">STL</th>
            <th scope="col">BLK</th>
            <th scope="col">TO</th>
            <th scope="col">PF</th>
            <th scope="col">PTS</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </div>`;
}
export function renderGameBoxScore({ game, boxScore, isLoading, error }) {
    if (isLoading) {
        return `<section class="card box-score">
      <header class="box-score__header">
        <h2 class="section-title">Box score</h2>
        <p class="section-summary">Crunching possession data…</p>
      </header>
      <p class="box-score__status">Generating derived stats from the play-by-play feed.</p>
    </section>`;
    }
    if (error) {
        return `<section class="card box-score">
      <header class="box-score__header">
        <h2 class="section-title">Box score</h2>
        <p class="section-summary">We couldn't load the derived box score.</p>
      </header>
      <p class="box-score__status">${escapeHtml(error)}</p>
    </section>`;
    }
    if (!game || !boxScore) {
        return `<section class="card box-score">
      <header class="box-score__header">
        <h2 class="section-title">Box score</h2>
        <p class="section-summary">Derived totals appear once play-by-play arrives.</p>
      </header>
      <p class="box-score__status">Box score data isn't available for this matchup yet.</p>
    </section>`;
    }
    const homeLabel = game.home_team?.full_name ?? game.home_team?.name ?? "Home";
    const awayLabel = game.visitor_team?.full_name ?? game.visitor_team?.name ?? "Away";
    const hasAnyPlayers = boxScore.home.players.length > 0 || boxScore.away.players.length > 0;
    if (!hasAnyPlayers) {
        return `<section class="card box-score">
      <header class="box-score__header">
        <h2 class="section-title">Box score</h2>
        <p class="section-summary">Derived totals appear once play-by-play arrives.</p>
      </header>
      <p class="box-score__status">We're waiting on possession data before showing player lines.</p>
    </section>`;
    }
    return `<section class="card box-score">
    <header class="box-score__header">
      <h2 class="section-title">Box score</h2>
      <p class="section-summary">Derived from live play-by-play via the Cloudflare worker.</p>
    </header>
    <div class="box-score__content">
      ${renderTeamTable(boxScore.away, awayLabel)}
      ${renderTeamTable(boxScore.home, homeLabel)}
    </div>
  </section>`;
}
