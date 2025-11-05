/**
 * Global chart defaults.
 * @module charts/defaults
 */
import { applyTheme, defaultTheme } from "./theme.js";
const STYLE_ID = "ncaam-chart-defaults";
const BASE_STYLE = `
:where(.viz-canvas) {
  position: relative;
  width: 100%;
}

:where(.viz-canvas) > svg {
  display: block;
  width: 100%;
  height: 100%;
}

:where(svg.chart) {
  font-family: var(--chart-font-family);
  font-size: calc(var(--chart-font-size) * 1px);
  color: var(--chart-fg);
}
`;
let defaultsApplied = false;
/**
 * Apply the shared chart defaults to the current document.
 *
 * @param theme - Optional theme tokens overriding the defaults.
 */
export function setChartDefaults(theme = defaultTheme) {
    if (typeof document === "undefined") {
        return;
    }
    const doc = document;
    const root = doc.documentElement;
    applyTheme(root, theme);
    root.setAttribute("data-chart-defaults", "true");
    if (!defaultsApplied) {
        const style = doc.getElementById(STYLE_ID);
        if (!style) {
            const next = doc.createElement("style");
            next.id = STYLE_ID;
            next.textContent = BASE_STYLE;
            doc.head.appendChild(next);
        }
        defaultsApplied = true;
    }
}
