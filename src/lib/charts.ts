// Hand-rolled SVG helpers. No chart library: each chart here is a few paths.
import { html, raw, type Markup } from "./dom.js";

export const POST_LABEL = ["", "Round of 64", "Round of 32", "Sweet 16", "Elite Eight", "Final Four", "Runner-up", "Champion"];

export type HistRow = [year: number, w: number, g: number, adjO: number, adjD: number, barthag: number, post: number, seed: number];

/** Efficiency margin by season, with a marker on NCAA tournament years. */
export function historyChart(rows: HistRow[]): Markup {
  const W = 560, H = 210, padL = 30, padB = 22, padT = 14;
  const years = rows.map((r) => r[0]);
  const first = Math.min(...years), last = Math.max(...years);
  const margins = rows.map((r) => r[3] - r[4]);
  const max = Math.max(10, ...margins.map(Math.abs));
  const zero = padT + (H - padT - padB) / 2;
  const scale = (H - padT - padB) / 2 / max;
  const band = (W - padL) / (last - first + 1);
  const bars = rows.map((r, i) => {
    const m = margins[i] ?? 0;
    const x = padL + (r[0] - first) * band + band * 0.14;
    const h = Math.max(1, Math.abs(m) * scale);
    const y = m >= 0 ? zero - h : zero;
    const title = `${r[0] - 1}-${String(r[0]).slice(2)}: ${r[1]}-${r[2] - r[1]}, margin ${m >= 0 ? "+" : ""}${m.toFixed(1)}${r[6] ? `, ${POST_LABEL[r[6]]}` : ""}`;
    return `<g><title>${title}</title><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(band * 0.72).toFixed(1)}" height="${h.toFixed(1)}" fill="${
      m >= 0 ? "#f3f0e6" : "rgba(243,240,230,.45)"
    }"/>${
      r[6]
        ? `<circle cx="${(x + band * 0.36).toFixed(1)}" cy="${(m >= 0 ? y - 8 : zero - 8).toFixed(1)}" r="${r[6] >= 5 ? 5 : 3.2}" fill="${
            r[6] === 7 ? "#ffb52e" : r[6] >= 5 ? "#d9541e" : "none"
          }" stroke="${r[6] >= 5 ? "none" : "#ffb52e"}" stroke-width="1.6"/>`
        : ""
    }</g>`;
  });
  const labels = [];
  for (let y = first; y <= last; y++) {
    labels.push(`<text x="${(padL + (y - first) * band + band / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">’${String(y).slice(2)}</text>`);
  }
  return html`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Adjusted efficiency margin by season, ${first} to ${last}">
    <line class="axis" x1="${padL}" x2="${W}" y1="${zero}" y2="${zero}"/>
    <text x="0" y="${padT + 6}">+${Math.round(max)}</text><text x="0" y="${zero + 4}">0</text><text x="0" y="${H - padB}">−${Math.round(max)}</text>
    ${raw(bars.join(""))}${raw(labels.join(""))}
  </svg>`;
}

export type FlowPoint = { t: number; diff: number };

/** Lead tracker: home lead above the line, away lead below. */
export function flowChart(points: FlowPoint[], total: number, periodSeconds: number, homeColor: string, awayColor: string, homeAbbr: string, awayAbbr: string): Markup {
  const W = 720, H = 220, padL = 34, padR = 8, padT = 12, padB = 20;
  // Each side gets only the room it earned: a wire-to-wire win fills the
  // chart instead of leaving half of it empty.
  const up = Math.max(4, ...points.map((p) => p.diff));
  const down = Math.max(4, ...points.map((p) => -p.diff));
  const plot = H - padT - padB;
  const x = (t: number) => padL + (t / total) * (W - padL - padR);
  const mid = padT + (plot * up) / (up + down);
  const y = (d: number) => mid - (d / (up + down)) * plot;
  let d = `M${x(0).toFixed(1)},${mid}`;
  let prev = 0;
  for (const p of points) {
    d += `H${x(p.t).toFixed(1)}`;
    if (p.diff !== prev) d += `V${y(p.diff).toFixed(1)}`;
    prev = p.diff;
  }
  d += `H${x(total).toFixed(1)}V${mid}Z`;
  const marks: string[] = [];
  const regulation = periodSeconds === 1200 ? 2 : 4;
  for (let i = 1; i * periodSeconds < total && i <= regulation; i++) {
    marks.push(`<line x1="${x(i * periodSeconds).toFixed(1)}" x2="${x(i * periodSeconds).toFixed(1)}" y1="${padT}" y2="${H - padB}" stroke="rgba(20,33,58,.25)" stroke-dasharray="3 4"/>`);
  }
  const periodName = (i: number) => (regulation === 2 ? (i === 0 ? "1st half" : "2nd half") : `Q${i + 1}`);
  for (let i = 0; i < regulation; i++) {
    marks.push(`<text x="${x((i + 0.5) * periodSeconds).toFixed(1)}" y="${H - 4}" text-anchor="middle">${periodName(i)}</text>`);
  }
  if (total > regulation * periodSeconds) {
    marks.push(`<text x="${x((regulation * periodSeconds + total) / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle">OT</text>`);
  }
  return html`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Lead tracker">
    <defs>
      <clipPath id="flow-up"><rect x="0" y="0" width="${W}" height="${mid}"/></clipPath>
      <clipPath id="flow-down"><rect x="0" y="${mid}" width="${W}" height="${H}"/></clipPath>
    </defs>
    ${raw(marks.join(""))}
    <path d="${d}" fill="${homeColor}" clip-path="url(#flow-up)"/>
    <path d="${d}" fill="${awayColor}" clip-path="url(#flow-down)"/>
    <line x1="${padL}" x2="${W - padR}" y1="${mid}" y2="${mid}" stroke="#14213a" stroke-width="1.5"/>
    <text x="0" y="${padT + 8}">${homeAbbr} +${up}</text>
    <text x="0" y="${H - padB - 2}">${awayAbbr} +${down}</text>
  </svg>`;
}
