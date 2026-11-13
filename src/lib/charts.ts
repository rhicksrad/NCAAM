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
    // post -1: the season in progress, drawn as an open chalk outline.
    const open = r[6] < 0;
    const title = `${r[0] - 1}-${String(r[0]).slice(2)}${open ? " so far" : ""}: ${r[1]}-${r[2] - r[1]}, margin ${m >= 0 ? "+" : ""}${m.toFixed(1)}${r[6] > 0 ? `, ${POST_LABEL[r[6]]}` : ""}`;
    return `<g><title>${title}</title><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(band * 0.72).toFixed(1)}" height="${h.toFixed(1)}" ${
      open ? `fill="none" stroke="#f3f0e6" stroke-width="1.5" stroke-dasharray="3 3"` : `fill="${m >= 0 ? "#f3f0e6" : "rgba(243,240,230,.45)"}"`
    }/>${
      r[6] > 0
        ? `<circle cx="${(x + band * 0.36).toFixed(1)}" cy="${(m >= 0 ? y - 8 : zero - 8).toFixed(1)}" r="${r[6] >= 5 ? 5 : 3.2}" fill="${
            r[6] === 7 ? "#ffb52e" : r[6] >= 5 ? "#c8440f" : "none"
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
