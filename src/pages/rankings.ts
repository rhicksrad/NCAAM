import "../lib/chrome.js";
import { feed, snapshot, type FeedInfo } from "../lib/data.js";
import { $, html, mount, onSegment, param, raw, segmented, setParams } from "../lib/dom.js";
import { espn, type Poll } from "../lib/espn.js";
import { failure, fmtStamp, logo, logoUrl, staleNote, teamHref, teamStyle } from "../lib/ui.js";

let polls: Poll[] = [];
let pick = param("poll") ?? "ap";
let info: FeedInfo = { live: false, at: "", stale: false };

function move(rank: number, prev: number) {
  if (!prev) return html`<span class="up">New</span>`;
  const d = prev - rank;
  return d === 0 ? html`<span class="flat">–</span>` : d > 0 ? html`<span class="up">▲ ${d}</span>` : html`<span class="down">▼ ${-d}</span>`;
}

function paint(): void {
  const poll = polls.find((p) => p.id === pick) ?? polls[0];
  if (!poll) {
    mount("#rankings-root", html`<div class="empty-state"><h2>No poll yet</h2><p>The voters haven't turned in a ballot.</p></div>`);
    return;
  }
  if (polls.length > 1) {
    mount(
      "#rankings-tools",
      html`<div class="segmented" id="poll-pick" role="group" aria-label="Poll">${segmented(
        polls.map((p) => ({ value: p.id, label: p.short.replace(/ Poll$/, "") })),
        poll.id,
      )}</div>`,
    );
    onSegment($("#poll-pick"), (value) => {
      pick = value;
      setParams({ poll: value === "ap" ? null : value });
      paint();
    });
  }
  $("#rankings-sub").textContent = `${poll.name}, ${poll.week}.`;
  const maxPoints = Math.max(...poll.ranks.map((r) => r.points), 1);
  const hasVotes = poll.ranks.some((r) => r.points > 0);
  mount(
    "#rankings-root",
    html`${staleNote(info)}
      <div class="rafters" aria-hidden="true">
        ${poll.ranks.slice(0, 5).map(
          (r, i) => html`<a class="banner" href="${teamHref(r.team.id)}" tabindex="-1" style="${teamStyle(r.team)};--i:${i}">
            <span class="banner__rank">${r.rank}</span>
            <img class="banner__logo" src="${logoUrl(r.team.id, 120)}" data-team="${r.team.id}" data-abbr="${r.team.abbr}" alt="" width="54" height="54">
            <span class="banner__name">${r.team.name}</span>
            <span class="banner__rec">${r.record}</span>
          </a>`,
        )}
      </div>
      <div class="sheet">
        <div class="sheet__head"><h2>${poll.name}</h2><small>${poll.updated ? `Released ${fmtStamp(poll.updated)}` : ""}</small></div>
        <div class="sheet__scroll">
          <table>
            <thead><tr><th class="l">#</th><th class="l">Team</th><th>Record</th>${hasVotes ? raw("<th>Points</th><th>1st</th>") : ""}<th>Last wk</th><th>Move</th></tr></thead>
            <tbody>
              ${poll.ranks.map(
                (r) => html`<tr>
                  <td class="l pos">${r.rank}</td>
                  <td class="l"><a class="who" href="${teamHref(r.team.id)}">${logo(r.team)}<span>${r.team.name} <small>${r.team.mascot}</small></span></a></td>
                  <td>${r.record}</td>
                  ${
                    hasVotes
                      ? html`<td title="${Math.round((r.points / maxPoints) * 100)}% of the leader's points">${r.points ? r.points.toLocaleString() : ""}</td><td>${
                          r.firstPlace || ""
                        }</td>`
                      : ""
                  }
                  <td>${r.prev || "NR"}</td>
                  <td>${move(r.rank, r.prev)}</td>
                </tr>`,
              )}
            </tbody>
          </table>
        </div>
      </div>
      ${
        poll.others.length
          ? html`<p class="also"><b>Knocking on the door:</b> ${poll.others
              .slice(0, 20)
              .map((o, i) => html`${i ? ", " : ""}<a href="${teamHref(o.team.id)}">${o.team.name}</a> ${o.points}`)}</p>`
          : ""
      }
      ${
        poll.dropped.length
          ? html`<p class="also"><b>Fell out:</b> ${poll.dropped.map((t, i) => html`${i ? ", " : ""}<a href="${teamHref(t.id)}">${t.name}</a>`)}</p>`
          : ""
      }`,
  );
}

feed<Poll[]>({
  saved: () => snapshot("rankings"),
  live: () => espn.rankings(),
  render(data, meta) {
    polls = data.filter((p) => p.ranks.length);
    info = meta;
    paint();
  },
  fail: (error) => mount("#rankings-root", failure("the rankings", error)),
});
