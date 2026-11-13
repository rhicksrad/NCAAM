import "../lib/chrome.js";
import { dataset, snapshot, type PlayerRow } from "../lib/data.js";
import { $, html, mount, param, setParams, type Markup } from "../lib/dom.js";
import { playerSlug } from "../lib/slug.js";
import { failure, fmtStamp, logo } from "../lib/ui.js";

// Keys are expanded on load, so every row's first cell is a career file name.
type Row = [string, ...PlayerRow extends [unknown, ...infer R] ? R : never];
// The season in progress comes from ESPN and carries a time; the archive does not.
type Doc = { season: string; rows: Row[]; at?: string; past?: string };
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
/** Games and minutes give way on a phone so the sorted stat is on screen. */
const thin = (key: string) => ((key === "gp" || key === "mpg") && key !== sortKey ? "wide" : "");
const HEADLINERS = ["ppg", "rpg", "apg", "spg", "bpg"];
const PAGE = 50;

let doc: Doc;
let now: Doc | undefined;
let past: Doc | undefined;
let floor = (_r: Row) => 15;
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
  return !regulars || (r[5] >= floor(r) && r[6] >= 15);
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
      const top = doc.rows.filter((r) => r[5] >= floor(r)).sort((a, b) => (b[c.i] as number) - (a[c.i] as number))[0];
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
          (s) => html`<tr><td class="l">${s[0]}</td><td class="l">${s[1]} <small class="wide">${s[2]}</small></td><td>${s[3]}</td><td>${s[4] ?? "–"}</td>${s
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
  $("#players-sub").textContent = doc.at
    ? `${doc.season} so far: ${doc.rows.length.toLocaleString()} players have played. Tap a row for a player's whole career.`
    : `${doc.season} stat sheet: ${doc.rows.length.toLocaleString()} players on file. Tap a row for a player's whole career.`;
  mount(
    "#players-root",
    html`${leaders()}
      <section class="sheet">
        <div class="sheet__scroll"><table class="roll">
          <thead><tr><th class="l">#</th><th class="l">Player</th>${COLS.map(
            (c) => html`<th class="${thin(c.key)}" ${c.key === sortKey ? html`aria-sort="${dir === -1 ? "descending" : "ascending"}"` : ""}><button type="button" data-sort="${c.key}" title="${c.title}">${c.label}</button></th>`,
          )}</tr></thead>
          <tbody>
            ${
              slice.length
                ? slice.map(
                    (r, i) => html`<tr data-slug="${r[0]}">
                        <td class="l pos">${page * PAGE + i + 1}</td>
                        <td class="l"><span class="who">${logo({ id: r[3] ?? "", abbr: r[2], name: r[2] })}<span><button type="button" class="row-open" aria-expanded="${open.has(r[0]) ? "true" : "false"}">${r[1]}</button> <small>${r[2]} · ${r[4]}</small></span></span></td>
                        ${COLS.map((c) => html`<td class="${c.key === sortKey ? "hot" : thin(c.key)}">${c.key === "gp" && r[c.i] !== null ? Math.round(r[c.i] as number) : fmt(r[c.i] as number | null, c.pct)}</td>`)}
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
        <p class="sheet__note">${
          doc.at
            ? `Per-game averages from ESPN as of ${fmtStamp(doc.at)}, refreshed every few hours. "Regulars" have played half their team's games, at 15 minutes or more. Earlier seasons in each career are from Sports Reference.`
            : `Per-game numbers from Sports Reference for ${doc.season}.`
        }</p>
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

/** Show one season's sheet: the floor for "Regulars" is half the games the
 *  player's team has played, capped at 15, so it works in November too. */
function use(d: Doc): void {
  doc = d;
  const most = new Map<string, number>();
  for (const r of d.rows) most.set(r[2], Math.max(most.get(r[2]) ?? 0, r[5]));
  floor = (r) => Math.min(15, Math.ceil((most.get(r[2]) ?? 0) / 2));
  const confs = [...new Set(d.rows.map((r) => r[4]))].filter(Boolean).sort();
  // A conference from a link or the other season may not exist in this one.
  if (!confs.includes(conf)) conf = "";
  mount("#p-conf", html`<option value="">All</option>${confs.map((c) => html`<option ${c === conf ? html`selected` : ""}>${c}</option>`)}`);
  for (const b of document.querySelectorAll<HTMLButtonElement>("#p-season button")) {
    const mine = b.dataset.value === "now" ? now : past;
    b.textContent = b.dataset.value === "now" ? (now?.season ?? b.textContent) : (past?.season ?? now?.past ?? b.textContent);
    b.setAttribute("aria-pressed", String(mine === d));
  }
  setParams({ conf: conf || null, season: d === past && now ? d.season : null });
  page = 0;
  open.clear();
}

const archive = (): Promise<Doc> =>
  dataset<Doc>("players").then((d) => {
    // The common slug (name-1) is left out of the files to keep them light.
    for (const r of d.rows) r[0] ||= playerSlug(r[1]);
    return (past = d);
  });

function wire(): void {
  // The controls are in the page's own HTML so nothing moves when the data lands.
  ($("#p-q") as HTMLInputElement).value = query;
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
  const seasons = $("#p-season");
  // Last season's file is only fetched when someone asks for it.
  seasons.addEventListener("pointerenter", () => void archive().catch(() => undefined), { once: true });
  seasons.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("button[data-value]");
    if (!b) return;
    const want = b.dataset.value === "now" ? Promise.resolve(now) : past ? Promise.resolve(past) : archive();
    want
      .then((d) => {
        if (!d || d === doc) return;
        use(d);
        paint();
      })
      .catch((error) => mount("#players-root", failure("last season's stat sheet", error)));
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
    if (row?.dataset.slug) {
      toggle(row.dataset.slug);
      // The table was repainted; put the keyboard back where it was.
      root.querySelector<HTMLElement>(`tr[data-slug="${CSS.escape(row.dataset.slug)}"] .row-open`)?.focus({ preventScroll: true });
    }
  });
}

function syncReg(): void {
  for (const b of document.querySelectorAll<HTMLButtonElement>("#p-reg button")) b.setAttribute("aria-pressed", String((b.dataset.value === "1") === regulars));
}

async function boot(): Promise<void> {
  // This season first (baked from ESPN at each deploy); last season's archive
  // when a link asks for it or this season has no games yet.
  now = await snapshot("averages")
    .then((s) => {
      for (const r of s.data.rows) r[0] ||= playerSlug(r[1]);
      return { season: s.data.season, past: s.data.past, at: s.at, rows: s.data.rows as Row[] };
    })
    .catch(() => undefined);
  if (now && (!now.rows.length || now.season === now.past)) now = undefined;
  const asked = param("season");
  const first = now && (!asked || asked === now.season) ? now : await archive();
  ($("#p-season") as HTMLElement).hidden = !now;
  if (query.trim()) regulars = false;
  wire();
  use(first);
  syncReg();
  paint();
}

boot().catch((error) => mount("#players-root", failure("the stat sheet", error)));
