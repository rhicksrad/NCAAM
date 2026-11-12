import "../lib/chrome.js";
import { dataset } from "../lib/data.js";
import { $, html, mount, raw, type Markup } from "../lib/dom.js";
import { POST_LABEL } from "../lib/charts.js";
import { failure, fmtShortDay, ordinal, teamHref } from "../lib/ui.js";

// year, team, teamId, conf, w, g, adjO, adjD, barthag, tempo, post, seed, fg3, efg
type Eff = [number, string, string | null, string, number, number, number, number, number, number, number, number, number, number];
type EffDoc = { rows: Eff[] };
type Arena = [team: string, teamId: string | null, arena: string, x: number, y: number, elev: number, kind: string];
type ArenaDoc = { width: number; height: number; nation: string; borders: string; rows: Arena[] };
type MascotDoc = {
  families: Array<{ slug: string; label: string; count: number }>;
  categories: Array<{ slug: string; label: string; family: string; count: number }>;
  rows: Array<[college: string, teamId: string | null, mascot: string, category: string, conf: string]>;
};
type CatsDoc = {
  notes: string[];
  matchups: Array<{ series: string; total_games: number; total_games_display?: string; cat: { program: string; mascot: string; wins: number }; dog: { program: string; mascot: string; wins: number } }>;
};
type HeightDoc = { asOf: string; rows: Array<[team: string, teamId: string | null, inches: number, measured: number]> };

const exhibit = (no: string, id: string, title: string, lede: string, body: Markup) => html`<section class="exhibit" id="${id}">
  <header class="exhibit__head"><span class="exhibit__no" aria-hidden="true">${no}</span><h2>${title}</h2></header>
  <p class="exhibit__lede">${lede}</p>
  ${body}
</section>`;

/* ---------- 01: the efficiency chalkboard ---------- */
const X0 = 84, X1 = 132, Y0 = 82, Y1 = 126; // adjO, adjD domains
const CW = 900, CH = 520, PL = 44, PB = 34, PT = 12, PR = 12;
const cx = (o: number) => PL + ((o - X0) / (X1 - X0)) * (CW - PL - PR);
const cy = (d: number) => PT + ((d - Y0) / (Y1 - Y0)) * (CH - PT - PB);

function chalkboard(doc: EffDoc): Markup {
  const ticksX = [90, 100, 110, 120, 130];
  const ticksY = [90, 100, 110, 120];
  return html`<div class="chalk">
    <div class="chalk-ctl">
      <output id="eff-year" for="eff-range">2025</output>
      <button class="btn" id="eff-play" type="button" aria-pressed="false">Run the tape</button>
      <input id="eff-range" type="range" min="2013" max="2025" step="1" value="2025" aria-label="Season">
      <input id="eff-find" type="search" placeholder="Follow a team" list="eff-teams" aria-label="Follow a team">
      <datalist id="eff-teams">${[...new Set(doc.rows.map((r) => r[1]))].sort().map((t) => html`<option value="${t}"></option>`)}</datalist>
    </div>
    <svg viewBox="0 0 ${CW} ${CH}" id="eff-svg" role="img" aria-label="Offense against defense for every Division I team in the chosen season">
      ${ticksX.map((t) => html`<line class="axis" x1="${cx(t)}" x2="${cx(t)}" y1="${PT}" y2="${CH - PB}"/><text x="${cx(t)}" y="${CH - 12}" text-anchor="middle">${t}</text>`)}
      ${ticksY.map((t) => html`<line class="axis" x1="${PL}" x2="${CW - PR}" y1="${cy(t)}" y2="${cy(t)}"/><text x="${PL - 8}" y="${cy(t) + 4}" text-anchor="end">${t}</text>`)}
      <text class="cap" x="${CW - PR - 6}" y="${CH - PB - 10}" text-anchor="end">points scored per 100 possessions →</text>
      <text class="cap" x="${PL + 6}" y="${PT + 12}">↑ stingier defense (points allowed per 100)</text>
      <text x="${CW - PR - 6}" y="${PT + 14}" text-anchor="end" class="corner">CONTENDERS</text>
      <text x="${PL + 6}" y="${CH - PB - 8}" class="corner">LONG WINTER</text>
      <g id="eff-dots"></g>
    </svg>
    <p class="chalk-axes">Across: points scored per 100 possessions. Up: fewer points allowed.</p>
    <p class="chalk-readout" id="eff-read">Each chalk mark is a team. Up and to the right is where you want to be. Gold is the eventual champion. Hover or tap a mark.</p>
  </div>`;
}

function wireChalkboard(doc: EffDoc): void {
  const byYear = new Map<number, Eff[]>();
  for (const r of doc.rows) (byYear.get(r[0]) ?? byYear.set(r[0], []).get(r[0])!).push(r);
  const teams = [...new Set(doc.rows.map((r) => r[1]))];
  const index = new Map(teams.map((t, i) => [t, i]));
  const NS = "http://www.w3.org/2000/svg";
  const layer = $("#eff-dots") as unknown as SVGGElement;
  const dots = teams.map(() => {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("r", "4.5");
    c.setAttribute("class", "dot");
    c.style.transition = "transform .7s cubic-bezier(.2,.7,.2,1), opacity .4s";
    layer.append(c);
    return c;
  });
  let year = 2025;
  let follow = "";
  let current = new Map<string, Eff>();
  const read = $("#eff-read");

  const describe = (r: Eff) =>
    html`<b>${r[0] - 1}-${String(r[0]).slice(2)} ${r[1]}</b> (${r[3]}): ${r[4]}-${r[5] - r[4]}, scored ${r[6].toFixed(1)} and allowed ${r[7].toFixed(1)} per 100${
      r[10] ? html`. ${POST_LABEL[r[10]]}${r[11] ? ` as a ${r[11]} seed` : ""}` : ""
    }.${r[2] ? html` <a href="${teamHref(r[2])}">Team page</a>` : ""}`;

  const paint = () => {
    $("#eff-year").textContent = String(year);
    current = new Map((byYear.get(year) ?? []).map((r) => [r[1], r]));
    for (const [team, i] of index) {
      const dot = dots[i]!;
      const r = current.get(team);
      if (!r) {
        dot.style.opacity = "0";
        dot.style.pointerEvents = "none";
        continue;
      }
      dot.style.opacity = "1";
      dot.style.pointerEvents = "";
      dot.style.transform = `translate(${cx(Math.min(X1, Math.max(X0, r[6]))).toFixed(1)}px, ${cy(Math.min(Y1, Math.max(Y0, r[7]))).toFixed(1)}px)`;
      dot.dataset.team = team;
      dot.dataset.post = String(r[10]);
      dot.setAttribute("r", r[10] === 7 ? "7" : "4.5");
      dot.classList.toggle("is-on", team === follow);
      if (team === follow || r[10] === 7) layer.append(dot);
    }
    const followed = follow ? current.get(follow) : undefined;
    if (followed) mount(read, describe(followed));
    else if (follow) mount(read, html`<b>${follow}</b> has no ${year} season on file.`);
  };

  $("#eff-range").addEventListener("input", (e) => {
    year = Number((e.target as HTMLInputElement).value);
    paint();
  });
  $("#eff-find").addEventListener("input", (e) => {
    const value = (e.target as HTMLInputElement).value.trim().toLowerCase();
    follow = teams.find((t) => t.toLowerCase() === value) ?? "";
    paint();
  });
  const show = (e: Event) => {
    const team = (e.target as SVGElement).dataset?.team;
    const r = team ? current.get(team) : undefined;
    if (r) mount(read, describe(r));
  };
  layer.addEventListener("pointerover", show);
  layer.addEventListener("click", (e) => {
    const team = (e.target as SVGElement).dataset?.team;
    if (!team) return;
    follow = follow === team ? "" : team;
    ($("#eff-find") as HTMLInputElement).value = follow;
    paint();
    show(e);
  });
  let timer = 0;
  const play = $("#eff-play");
  const stop = () => {
    clearInterval(timer);
    timer = 0;
    play.textContent = "Run the tape";
    play.setAttribute("aria-pressed", "false");
  };
  play.addEventListener("click", () => {
    if (timer) return stop();
    play.textContent = "Stop";
    play.setAttribute("aria-pressed", "true");
    if (year >= 2025) year = 2012;
    const step = () => {
      year += 1;
      ($("#eff-range") as HTMLInputElement).value = String(year);
      paint();
      if (year >= 2025) stop();
    };
    step();
    timer = window.setInterval(step, 1100);
  });
  paint();
}

/* ---------- 02: thin air ---------- */
function thinAir(doc: ArenaDoc): Markup {
  const top = doc.rows.slice(0, 10);
  const r = (elev: number) => 2.2 + Math.sqrt(Math.max(0, elev)) / 11;
  return html`<div class="split">
    <div class="chalk map">
      <svg viewBox="0 0 ${doc.width} ${doc.height}" role="img" aria-label="Map of Division I home arenas sized by elevation">
        <path class="land" d="${doc.nation}"/><path class="borders" d="${doc.borders}"/>
        ${[...doc.rows].reverse().map((a, i) => html`<circle cx="${a[3]}" cy="${a[4]}" r="${r(a[5]).toFixed(1)}" data-i="${doc.rows.length - 1 - i}"/>`)}
      </svg>
      <p class="chalk-readout" id="air-read">Bigger mark, higher gym. Hover or tap one.</p>
    </div>
    <section class="sheet">
      <div class="sheet__head"><h3>Highest home floors</h3><small>feet above sea level</small></div>
      <table><tbody>
        ${top.map(
          (a, i) => html`<tr><td class="l pos">${i + 1}</td><td class="l">${a[1] ? html`<a class="who" href="${teamHref(a[1])}">${a[0]}</a>` : a[0]}<small class="sub">${a[2]}</small></td><td class="hot">${a[5].toLocaleString()}</td></tr>`,
        )}
      </tbody></table>
      <p class="sheet__note">${doc.rows.filter((a) => a[5] < 100).length} programs play within 100 feet of sea level. The lowest floor on file: ${doc.rows[doc.rows.length - 1]![0]}, at ${doc.rows[doc.rows.length - 1]![5]} ft.</p>
    </section>
  </div>`;
}

function wireThinAir(doc: ArenaDoc): void {
  const read = $("#air-read");
  const show = (e: Event) => {
    const i = (e.target as SVGElement).dataset?.i;
    const a = i !== undefined ? doc.rows[Number(i)] : undefined;
    if (a) mount(read, html`<b>${a[0]}</b> plays at ${a[2]}, ${a[5].toLocaleString()} ft up. That's the ${ordinal(Number(i) + 1)}-highest floor of ${doc.rows.length}.`);
  };
  const svg = $("#thin-air svg");
  svg.addEventListener("pointerover", show);
  svg.addEventListener("click", show);
}


/* ---------- 03: mascots ---------- */
function mascots(doc: MascotDoc): Markup {
  const cats = [...doc.categories].sort((a, b) => b.count - a.count).slice(0, 14);
  const max = cats[0]?.count ?? 1;
  return html`<section class="sheet">
    <div class="bars" id="mascot-bars">
      ${cats.map(
        (c, i) => html`<button type="button" data-cat="${c.slug}" aria-pressed="${i === 0 ? "true" : "false"}"><span>${c.label}</span><i style="width:${((c.count / max) * 100).toFixed(1)}%"></i><b>${c.count}</b></button>`,
      )}
    </div>
    <p class="roster-cloud" id="mascot-list"></p>
  </section>`;
}

function wireMascots(doc: MascotDoc): void {
  const show = (slug: string) => {
    const cat = doc.categories.find((c) => c.slug === slug);
    const rows = doc.rows.filter((r) => r[3] === slug).sort((a, b) => a[2].localeCompare(b[2]) || a[0].localeCompare(b[0]));
    const byMascot = new Map<string, typeof rows>();
    for (const r of rows) (byMascot.get(r[2]) ?? byMascot.set(r[2], []).get(r[2])!).push(r);
    const common = [...byMascot.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    mount(
      "#mascot-list",
      html`<b>${cat?.label ?? ""}:</b> ${[...byMascot.entries()].map(
        ([mascot, list], i) => html`${i ? "; " : ""}<strong>${mascot}</strong> (${list.map((r, j) => html`${j ? ", " : ""}${r[1] ? html`<a href="${teamHref(r[1])}">${r[0]}</a>` : r[0]}`)})`,
      )}.${common && common[1].length > 2 ? html` Most crowded nickname here: ${common[0]}, ${common[1].length} schools.` : ""}`,
    );
  };
  $("#mascot-bars").addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("button[data-cat]");
    if (!b) return;
    for (const other of document.querySelectorAll("#mascot-bars button")) other.setAttribute("aria-pressed", String(other === b));
    show(b.dataset.cat ?? "");
  });
  const first = document.querySelector<HTMLButtonElement>("#mascot-bars button");
  if (first?.dataset.cat) show(first.dataset.cat);
}

/* ---------- 04: cats v. dogs ---------- */
function catsDogs(doc: CatsDoc): Markup {
  const cat = doc.matchups.reduce((n, m) => n + m.cat.wins, 0);
  const dog = doc.matchups.reduce((n, m) => n + m.dog.wins, 0);
  const row = (left: Markup, c: number, d: number, right: Markup, cls = "") => html`<div class="ledger__row ${cls}">
    <div>${left}</div>
    <div class="ledger__bar" role="img" aria-label="Cats ${c}, dogs ${d}"><i style="width:${((c / (c + d)) * 100).toFixed(1)}%">${c}</i><i style="flex:1">${d}</i></div>
    <div>${right}</div>
  </div>`;
  return html`<div class="ledger">
    ${row(html`<strong>Cats</strong><small>all ten series</small>`, cat, dog, html`<strong>Dogs</strong><small>${dog > cat ? `up ${dog - cat}` : `down ${cat - dog}`}</small>`, "ledger__total")}
    ${doc.matchups.map((m) =>
      row(html`<strong>${m.cat.program}</strong><small>${m.cat.mascot}</small>`, m.cat.wins, m.dog.wins, html`<strong>${m.dog.program}</strong><small>${m.dog.mascot}</small>`),
    )}
    <p class="also">${doc.notes.join(" ")}</p>
  </div>`;
}

/* ---------- 05: tallest rosters ---------- */
function tallest(doc: HeightDoc): Markup {
  const ft = (inches: number) => `${Math.floor(inches / 12)}′${(inches % 12).toFixed(1)}″`;
  const top = doc.rows.slice(0, 8);
  const low = doc.rows[doc.rows.length - 1]!;
  const median = doc.rows[Math.floor(doc.rows.length / 2)]![2];
  return html`<div class="split">
    <section class="sheet">
      <div class="tall" id="tall-bars">
        ${[76, 78].map((v) => html`<div class="tall__mark" style="--at:${v}"><span>${ft(v).replace(".0", "")}</span></div>`)}
        <div class="tall__mark tall__mark--mid" style="--at:${median}"><span>median ${ft(median)}</span></div>
        ${doc.rows.map((r, i) => html`<i style="--h:${r[2]}" data-i="${i}"></i>`)}
      </div>
      <p class="sheet__note" id="tall-read">Every roster, tallest on the left. The whole sport fits inside ${(doc.rows[0]![2] - low[2]).toFixed(1)} inches: ${doc.rows[0]![0]} at ${ft(
        doc.rows[0]![2],
      )} down to ${low[0]} at ${ft(low[2])}.</p>
    </section>
    <section class="sheet">
      <div class="sheet__head"><h3>Tallest on average</h3><small>rosters as of ${fmtShortDay(doc.asOf)}, ${doc.asOf.slice(0, 4)}</small></div>
      <table><tbody>${top.map(
        (r, i) => html`<tr><td class="l pos">${i + 1}</td><td class="l">${r[1] ? html`<a class="who" href="${teamHref(r[1])}">${r[0]}</a>` : r[0]}</td><td class="hot">${ft(r[2])}</td></tr>`,
      )}</tbody></table>
    </section>
  </div>`;
}

function wireTallest(doc: HeightDoc): void {
  const read = $("#tall-read");
  $("#tall-bars").addEventListener("pointerover", (e) => {
    const i = (e.target as HTMLElement).dataset?.i;
    const r = i !== undefined ? doc.rows[Number(i)] : undefined;
    if (r) read.textContent = `${ordinal(Number(i) + 1)} of ${doc.rows.length}: ${r[0]}, ${Math.floor(r[2] / 12)}′${(r[2] % 12).toFixed(1)}″ across ${r[3]} measured players.`;
  });
}

async function boot(): Promise<void> {
  const [eff, arenas, masc, cats, heights] = await Promise.all([
    dataset<EffDoc>("efficiency"),
    dataset<ArenaDoc>("arenas"),
    dataset<MascotDoc>("mascots"),
    dataset<CatsDoc>("cats-dogs"),
    dataset<HeightDoc>("heights"),
  ]);
  mount(
    "#lab-root",
    html`<nav class="lab-nav" aria-label="Exhibits">${raw(
        [["chalkboard", "Thirteen winters"], ["thin-air", "Thin air"], ["mascots", "Mascot census"], ["cats-dogs", "Cats v. dogs"], ["tallest", "Tall order"]]
          .map(([id, label], i) => `<a href="#${id}">0${i + 1} ${label}</a>`)
          .join(""),
      )}</nav>
      ${exhibit("01", "chalkboard", "Thirteen winters on one chalkboard", `Every Division I team since 2013, placed by how well it scores and how well it stops you, adjusted for schedule. Drag the year, or run the tape and watch programs rise and sink. ${eff.rows.length.toLocaleString()} team-seasons from Bart Torvik's ratings.`, chalkboard(eff))}
      ${exhibit("02", "thin-air", "Thin air", "Home-court advantage you can measure with an altimeter. Every home arena, sized by how far above the sea it sits.", thinAir(arenas))}
      ${exhibit("03", "mascots", "The mascot census", `We sorted all ${masc.rows.length} nicknames into a taxonomy nobody asked for. Pick a branch to see who's in it.`, mascots(masc))}
      ${exhibit("04", "cats-dogs", "Cats v. dogs", "Ten long-running rivalries where a feline program meets a canine one. The all-time ledger settles nothing and we keep it anyway.", catsDogs(cats))}
      ${exhibit("05", "tallest", "Tall order", "Average listed height of every roster. Listed heights are generous, but they're generous for everyone.", tallest(heights))}`,
  );
  wireChalkboard(eff);
  wireThinAir(arenas);
  wireMascots(masc);
  wireTallest(heights);
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
}

boot().catch((error) => mount("#lab-root", failure("the lab", error)));
