// The lead tracker on a game page. On its own so only that page loads it.
import { html, raw, type Markup } from "./dom.js";

export type FlowPoint = { t: number; diff: number };

/** Lead tracker: home lead above the line, away lead below. */
export function flowChart(points: FlowPoint[], total: number, periodSeconds: number, homeColor: string, awayColor: string, homeAbbr: string, awayAbbr: string, until = total, narrow = false): Markup {
  // Drawn at about one unit per pixel for the screen it is on, so the labels
  // stay the size the stylesheet gives them instead of shrinking with the chart.
  const W = narrow ? 380 : 1100, H = narrow ? 230 : 250, padL = narrow ? 4 : 52, padR = 8, padT = narrow ? 20 : 16, padB = narrow ? 24 : 20;
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
  // A game still being played stops where the clock is, not at the horn.
  d += `H${x(Math.min(until, total)).toFixed(1)}V${mid}Z`;
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
  return html`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Lead tracker" ${raw(narrow ? 'class="flow--phone"' : "")}>
    <defs>
      <clipPath id="flow-up"><rect x="0" y="0" width="${W}" height="${mid}"/></clipPath>
      <clipPath id="flow-down"><rect x="0" y="${mid}" width="${W}" height="${H}"/></clipPath>
    </defs>
    ${raw(marks.join(""))}
    <path d="${d}" fill="${homeColor}" clip-path="url(#flow-up)"/>
    <path d="${d}" fill="${awayColor}" clip-path="url(#flow-down)"/>
    <line x1="${padL}" x2="${W - padR}" y1="${mid}" y2="${mid}" stroke="#14213a" stroke-width="1.5"/>
    ${points.some((p) => p.diff > 0) ? html`<text x="0" y="${padT + 8}">${homeAbbr} +${up}</text>` : ""}
    ${points.some((p) => p.diff < 0) ? html`<text x="0" y="${H - padB - 2}">${awayAbbr} +${down}</text>` : ""}
  </svg>`;
}
