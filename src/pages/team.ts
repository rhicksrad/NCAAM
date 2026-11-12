import "../lib/chrome.js";
import { dataset, snapshot, type TeamEntry } from "../lib/data.js";
import { $, html, mount, param, type Markup } from "../lib/dom.js";
import { espn, type RosterPlayer, type ScheduleGame, type TeamDetail } from "../lib/espn.js";
import { historyChart, POST_LABEL, type HistRow } from "../lib/charts.js";
import { failure, fmtDay, fmtTime, gameHref, logo, logoUrl, teamHref, teamStyle } from "../lib/ui.js";

type Extras = { teams: Record<string, { arena?: string; elev?: number; height?: number; hist?: HistRow[] }> };
type PlayersDoc = { season: string; rows: Array<[string, string, string, string | null, string, number, number, number, number, number, ...unknown[]]> };

const id = param("id") ?? "";
const root = $("#team-root");

function hero(entry: TeamEntry | undefined, detail: TeamDetail | undefined, facts: Markup | ""): Markup {
  const team = detail?.team ?? entry;
  if (!team) return html``;
  const colors = { color: team.color || entry?.color || "", alt: team.alt || entry?.alt || "" };
  return html`<section class="team-hero" style="${teamStyle(colors)}">
    <div class="wrap team-hero__in">
      <div>
        <h1>${detail?.rank ? html`<span class="sr">Number ${detail.rank} </span>` : ""}${team.name}<small>${
          detail?.rank ? `No. ${detail.rank} · ` : ""
        }${team.mascot}${entry?.confName ? ` · ${entry.confName.replace(/ Conference$/, "")}` : ""}</small></h1>
        <p class="team-facts">
          ${detail?.record ? html`<span><b>${detail.record}</b>this season</span>` : ""}
          ${detail?.standing ? html`<span>${detail.standing}</span>` : ""}
          ${facts}
        </p>
      </div>
      <img class="team-hero__logo" src="${logoUrl(team.id, 320)}" data-team="${team.id}" data-abbr="${team.abbr}" alt="${team.name} logo" width="160" height="160">
    </div>
  </section>`;
}

function scheduleSheet(games: ScheduleGame[]): Markup {
  if (!games.length) return html`<div class="empty-state"><h2>No schedule yet</h2><p>ESPN hasn't posted this team's games.</p></div>`;
  const wins = games.filter((g) => g.won === true).length;
  const losses = games.filter((g) => g.won === false).length;
  return html`<section class="sheet">
    <div class="sheet__head"><h2>Schedule</h2><small>${wins}-${losses} so far, ${games.filter((g) => g.state === "pre").length} to play</small></div>
    <div class="sheet__scroll"><table>
      <thead><tr><th class="l">Date</th><th class="l">Opponent</th><th>Result</th></tr></thead>
      <tbody>
        ${games.map(
          (g) => html`<tr>
            <td class="l">${fmtDay(g.date)}</td>
            <td class="l"><a class="who" href="${teamHref(g.opponent.id)}">${logo(g.opponent)}<span><small>${g.neutral ? "vs" : g.home ? "vs" : "at"}</small> ${
              g.oppRank ? html`<span class="rk">${g.oppRank}</span>` : ""
            }${g.opponent.name}</span></a></td>
            <td>${
              g.won !== null
                ? html`<a href="${gameHref(g.id)}"><span class="${g.won ? "res-w" : "res-l"}">${g.won ? "W" : "L"}</span> ${g.us}-${g.them}</a>`
                : g.state === "in"
                  ? html`<a href="${gameHref(g.id)}" class="down">Live ${g.us}-${g.them}</a>`
                  : html`<a href="${gameHref(g.id)}">${/TBD/i.test(g.detail) ? "TBD" : fmtTime(g.date)}</a>${g.tv ? html` <small>${g.tv}</small>` : ""}`
            }</td>
          </tr>`,
        )}
      </tbody>
    </table></div>
  </section>`;
}

const CLASS: Record<string, string> = { Freshman: "Fr", Sophomore: "So", Junior: "Jr", Senior: "Sr", Graduate: "Gr", "Redshirt Freshman": "RFr", "Redshirt Sophomore": "RSo", "Redshirt Junior": "RJr", "Redshirt Senior": "RSr" };

function rosterSheet(players: RosterPlayer[]): Markup {
  if (!players.length) return html``;
  return html`<section class="sheet">
    <div class="sheet__head"><h2>Roster</h2><small>${players.length} players</small></div>
    <div class="sheet__scroll"><table>
      <thead><tr><th class="l">#</th><th class="l">Player</th><th>Pos</th><th>Ht</th><th>Wt</th><th class="l">Yr</th></tr></thead>
      <tbody>
        ${players.map(
          (p) => html`<tr><td class="l pos">${p.jersey}</td><td class="l"><span class="who"><span>${p.name}${
            p.from ? html` <small>${p.from}</small>` : ""
          }</span></span></td><td>${p.pos}</td><td>${p.height}</td><td>${p.weight}</td><td class="l">${CLASS[p.year] ?? p.year}</td></tr>`,
        )}
      </tbody>
    </table></div>
  </section>`;
}

function historyBlock(hist: HistRow[] | undefined, name: string): Markup {
  if (!hist || hist.length < 3) return html``;
  const best = [...hist].sort((a, b) => b[6] - a[6] || b[5] - a[5])[0]!;
  const trips = hist.filter((r) => r[6] > 0).length;
  return html`<section>
    <div class="chalk">
      <h2 style="font-size:1.5rem;margin-bottom:.3rem">Since ${hist[0]![0] - 1}</h2>
      <p style="font-size:.9rem;margin-bottom:.6rem">Points better (or worse) than an average team per 100 possessions. Rings mark NCAA tournament trips; filled dots are Final Fours.</p>
      ${historyChart(hist)}
      <p class="chalk-readout">${name} made the tournament in <b>${trips}</b> of ${hist.length} seasons on file. High-water mark: <b>${best[0] - 1}-${String(best[0]).slice(2)}</b>, ${
        best[1]
      }-${best[2] - best[1]}${best[6] ? html`, ${POST_LABEL[best[6]]}${best[7] ? ` as a ${best[7]} seed` : ""}` : ""}.</p>
    </div>
  </section>`;
}

function lastYear(doc: PlayersDoc, teamId: string): Markup {
  const rows = doc.rows.filter((r) => r[3] === teamId).sort((a, b) => b[7] - a[7]).slice(0, 6);
  if (!rows.length) return html``;
  return html`<section class="sheet">
    <div class="sheet__head"><h2>${doc.season} scorers</h2><small>Sports Reference</small></div>
    <div class="sheet__scroll"><table>
      <thead><tr><th class="l">Player</th><th>GP</th><th>Pts</th><th>Reb</th><th>Ast</th></tr></thead>
      <tbody>${rows.map((r) => html`<tr><td class="l"><a class="who" href="./players.html?q=${r[1]}">${r[1]}</a></td><td>${r[5]}</td><td class="hot">${r[7].toFixed(1)}</td><td>${r[8].toFixed(1)}</td><td>${r[9].toFixed(1)}</td></tr>`)}</tbody>
    </table></div>
  </section>`;
}

async function boot(): Promise<void> {
  if (!/^\d+$/.test(id)) {
    mount(root, html`<div class="wrap page"><div class="empty-state"><h2>Which team?</h2><p>Pick one from <a href="./teams.html">the directory</a>.</p></div></div>`);
    return;
  }
  const settle = <T>(p: Promise<T>) => p.then((value) => ({ value }), (error: unknown) => ({ error }));
  const entryP = snapshot("teams").then((s) => s.data.find((t) => t.id === id)).catch(() => undefined);
  const extrasP = dataset<Extras>("team-extras").then((d) => d.teams[id]).catch(() => undefined);
  const detailP = settle(espn.team(id));
  const scheduleP = settle(espn.schedule(id));
  const rosterP = settle(espn.roster(id));

  // First paint from what we already hold locally.
  const [entry, extras] = await Promise.all([entryP, extrasP]);
  const facts = html`${extras?.arena ? html`<span>${extras.arena}${extras.elev ? `, ${extras.elev.toLocaleString()} ft up` : ""}</span>` : ""}${
    extras?.height ? html`<span>Average height ${Math.floor(extras.height / 12)}′${(extras.height % 12).toFixed(1)}″</span>` : ""
  }`;
  if (entry) {
    document.title = `${entry.name} ${entry.mascot} — Field House`;
    mount(root, html`${hero(entry, undefined, facts)}<div class="wrap"><p class="loading" role="status">Opening the locker room…</p></div>`);
  }

  const [detail, schedule, roster] = await Promise.all([detailP, scheduleP, rosterP]);
  const d = "value" in detail ? detail.value : undefined;
  if (!entry && !d) {
    mount(root, html`<div class="wrap page">${failure("that team", "error" in detail ? detail.error : "unknown team")}</div>`);
    return;
  }
  const name = d?.team.name ?? entry?.name ?? "";
  document.title = `${name} ${d?.team.mascot ?? entry?.mascot ?? ""} — Field House`;
  mount(
    root,
    html`${hero(entry, d, facts)}
      <div class="wrap team-cols">
        <div>${"value" in schedule ? scheduleSheet(schedule.value) : failure("the schedule", schedule.error)}</div>
        <div>
          ${historyBlock(extras?.hist, name)}
          ${"value" in roster ? rosterSheet(roster.value) : ""}
          <div id="team-last-year"></div>
        </div>
      </div>`,
  );
  dataset<PlayersDoc>("players")
    .then((doc) => mount("#team-last-year", lastYear(doc, id)))
    .catch(() => undefined);
}

void boot();
