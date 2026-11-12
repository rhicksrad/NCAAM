import "../lib/chrome.js";
import { dataset } from "../lib/data.js";
import { $, html, mount, param, setParams, type Markup } from "../lib/dom.js";
import { failure, logo } from "../lib/ui.js";

// slug, name, team, teamId, conf, gp, mpg, ppg, rpg, apg, spg, bpg, tov, fg, fg3, ft, seasons
type Row = [string, string, string, string | null, string, number, number, number, number, number, number, number, number, number | null, number | null, number | null, number];
type Doc = { season: string; rows: Row[] };
type Career = { name: string; seasons: Array<[string, string, string, number, number, ...Array<number | null>]> };

const COLS: Array<{ i: number; key: string; label: string; title: string; pct?: boolean }> = [
  { i: 5, key: "gp", label: "GP", title: "Games played" },
  { i: 6, key: "mpg", label: "Min", title: "Minutes per game" },
  { i: 7, key: "ppg", label: "Pts", title: "Points per game" },
  { i: 8, key: "rpg", label: "Reb", title: "Rebounds per game" },
  { i: 9, key: "apg", label: "Ast", title: "Assists per game" },
  { i: 10, key: "spg", label: "Stl", title: "Steals per game" },
  { i: 11, key: "bpg", label: "Blk", title: "Blocks per game" },
  { i: 12, key: "tov", label: "TO", title: "Turnovers per game" },
  { i: 13, key: "fg", label: "FG%", title: "Field goal percentage", pct: true },
  { i: 14, key: "fg3", label: "3P%", title: "Three-point percentage", pct: true },
  { i: 15, key: "ft", label: "FT%", title: "Free throw percentage", pct: true },
];
const HEADLINERS = ["ppg", "rpg", "apg", "spg", "bpg"];
const PAGE = 50;

let doc: Doc;
let sortKey = COLS.some((c) => c.key === param("sort")) ? (param("sort") as string) : "ppg";
let dir: 1 | -1 = -1;
let query = param("q") ?? "";
let conf = param("conf") ?? "";
let page = 0;
let regulars = true;
const open = new Set<string>();
const careers = new Map<string, Career>();

const fmt = (v: number | null, pct?: boolean) => (v === null || v === undefined ? "–" : pct ? (v * 100).toFixed(1) : v % 1 === 0 && v > 40 ? String(v) : v.toFixed(1));
const col = (key: string) => COLS.find((c) => c.key === key)!;

function qualified(r: Row): boolean {
  return !regulars || (r[5] >= 15 && r[6] >= 15);
}

function filtered(): Row[] {
  const q = query.trim().toLowerCase();
  const c = col(sortKey);
  return doc.rows
    .filter((r) => qualified(r) && (!conf || r[4] === conf) && (!q || r[1].toLowerCase().includes(q) || r[2].toLowerCase().includes(q)))
    .sort((a, b) => (((a[c.i] as number | null) ?? -1) - ((b[c.i] as number | null) ?? -1)) * dir || a[1].localeCompare(b[1]));
}

function leaders(): Markup {
  return html`<div class="leader-strip">
    ${HEADLINERS.map((key) => {
      const c = col(key);
      const top = doc.rows.filter((r) => r[5] >= 15).sort((a, b) => (b[c.i] as number) - (a[c.i] as number))[0];
      if (!top) return "";
      return html`<button class="leader" type="button" data-sort="${key}">
        <span class="leader__stat">${c.title}</span>
        <span class="leader__val">${fmt(top[c.i] as number)}</span>
        <span class="leader__who">${top[1]}<small>${top[2]}</small></span>
      </button>`;
    })}
  </div>`;
}

function careerRow(slug: string): Markup {
  const career = careers.get(slug);
  const span = COLS.length + 2;
  if (!career) return html`<tr class="career"><td colspan="${span}"><p class="loading">Pulling the file…</p></td></tr>`;
  return html`<tr class="career"><td colspan="${span}">
    <table>
      <caption>${career.name}, season by season</caption>
      <thead><tr><th class="l">Season</th><th class="l">Team</th><th>GP</th><th>GS</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th>Stl</th><th>Blk</th><th>TO</th><th>FG%</th><th>3P%</th><th>FT%</th></tr></thead>
      <tbody>
        ${career.seasons.map(
          (s) => html`<tr><td class="l">${s[0]}</td><td class="l">${s[1]} <small>${s[2]}</small></td><td>${s[3]}</td><td>${s[4] ?? "–"}</td>${s
            .slice(5)
            .map((v, i) => html`<td>${fmt(v as number | null, i >= 7)}</td>`)}</tr>`,
        )}
      </tbody>
    </table>
  </td></tr>`;
}

function paint(): void {
  const rows = filtered();
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  page = Math.min(page, pages - 1);
  const slice = rows.slice(page * PAGE, (page + 1) * PAGE);
  $("#players-sub").textContent = `${doc.season} stat sheet: ${doc.rows.length.toLocaleString()} players on file. Tap a row for a player's whole career.`;
  mount(
    "#players-root",
    html`${leaders()}
      <section class="sheet">
        <div class="sheet__scroll"><table>
          <thead><tr><th class="l">#</th><th class="l">Player</th>${COLS.map(
            (c) => html`<th ${c.key === sortKey ? html`aria-sort="${dir === -1 ? "descending" : "ascending"}"` : ""}><button type="button" data-sort="${c.key}" title="${c.title}">${c.label}</button></th>`,
          )}</tr></thead>
          <tbody>
            ${
              slice.length
                ? slice.map(
                    (r, i) => html`<tr data-slug="${r[0]}" tabindex="0" aria-expanded="${open.has(r[0]) ? "true" : "false"}">
                        <td class="l pos">${page * PAGE + i + 1}</td>
                        <td class="l"><span class="who">${logo({ id: r[3] ?? "", abbr: r[2], name: r[2] })}<span>${r[1]} <small>${r[2]} · ${r[4]}</small></span></span></td>
                        ${COLS.map((c) => html`<td class="${c.key === sortKey ? "hot" : ""}">${c.key === "gp" && r[c.i] !== null ? Math.round(r[c.i] as number) : fmt(r[c.i] as number | null, c.pct)}</td>`)}
                      </tr>${open.has(r[0]) ? careerRow(r[0]) : ""}`,
                  )
                : html`<tr><td class="l" colspan="${COLS.length + 2}">Nobody matches. Loosen the filters.</td></tr>`
            }
          </tbody>
        </table></div>
        <div class="pager">
          <button type="button" data-page="-1" ${page === 0 ? html`disabled` : ""}>Prev</button>
          <span>${rows.length.toLocaleString()} players · page ${page + 1} of ${pages}</span>
          <button type="button" data-page="1" ${page >= pages - 1 ? html`disabled` : ""}>Next</button>
        </div>
        <p class="sheet__note">Per-game numbers from Sports Reference for ${doc.season}. The current season isn't in a free feed yet; live rosters are on each team page.</p>
      </section>`,
  );
}

function toggle(slug: string): void {
  if (open.has(slug)) open.delete(slug);
  else {
    open.add(slug);
    if (!careers.has(slug)) {
      dataset<Career>(`players/${slug}`)
        .then((c) => {
          careers.set(slug, c);
          paint();
        })
        .catch(() => {
          open.delete(slug);
          paint();
        });
    }
  }
  paint();
}

function wire(): void {
  const confs = [...new Set(doc.rows.map((r) => r[4]))].filter(Boolean).sort();
  mount(
    "#players-tools",
    html`<div class="field"><label for="p-q">Find</label><input id="p-q" type="search" placeholder="Player or school" autocomplete="off" value="${query}"></div>
      <div class="field"><label for="p-conf">Conference</label><select id="p-conf"><option value="">All</option>${confs.map(
        (c) => html`<option ${c === conf ? html`selected` : ""}>${c}</option>`,
      )}</select></div>
      <div class="segmented" id="p-reg" role="group" aria-label="Who counts"><button type="button" data-value="1" aria-pressed="true">Regulars</button><button type="button" data-value="0" aria-pressed="false">Everyone</button></div>`,
  );
  $("#p-q").addEventListener("input", (e) => {
    query = (e.target as HTMLInputElement).value;
    if (query.trim()) regulars = false;
    syncReg();
    page = 0;
    setParams({ q: query.trim() || null });
    paint();
  });
  $("#p-conf").addEventListener("change", (e) => {
    conf = (e.target as HTMLSelectElement).value;
    page = 0;
    setParams({ conf: conf || null });
    paint();
  });
  $("#p-reg").addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("button[data-value]");
    if (!b) return;
    regulars = b.dataset.value === "1";
    syncReg();
    page = 0;
    paint();
  });
  const root = $("#players-root");
  root.addEventListener("click", (e) => {
    const target = e.target as Element;
    const sort = target.closest<HTMLElement>("[data-sort]");
    if (sort) {
      const key = sort.dataset.sort ?? "ppg";
      dir = key === sortKey && !sort.classList.contains("leader") ? (dir === -1 ? 1 : -1) : -1;
      sortKey = key;
      page = 0;
      setParams({ sort: key === "ppg" ? null : key });
      paint();
      return;
    }
    const pager = target.closest<HTMLButtonElement>("button[data-page]");
    if (pager) {
      page += Number(pager.dataset.page);
      paint();
      root.querySelector(".sheet")?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    const row = target.closest<HTMLElement>("tr[data-slug]");
    if (row?.dataset.slug) toggle(row.dataset.slug);
  });
  root.addEventListener("keydown", (e) => {
    const row = (e.target as Element).closest<HTMLElement>("tr[data-slug]");
    if (row?.dataset.slug && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      toggle(row.dataset.slug);
    }
  });
}

function syncReg(): void {
  for (const b of document.querySelectorAll<HTMLButtonElement>("#p-reg button")) b.setAttribute("aria-pressed", String((b.dataset.value === "1") === regulars));
}

dataset<Doc>("players")
  .then((d) => {
    doc = d;
    if (query.trim()) regulars = false;
    wire();
    syncReg();
    paint();
  })
  .catch((error) => mount("#players-root", failure("the stat sheet", error)));
