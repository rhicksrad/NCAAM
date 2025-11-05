/**
 * Accessible tooltip manager.
 * @module charts/tooltip
 */
const prefersReducedMotion = () => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};
/**
 * Create a tooltip attached to the provided root element.
 *
 * @param root - Host element (usually the chart container).
 */
export function createTooltip(root) {
    const doc = root.ownerDocument ?? document;
    const tooltip = doc.createElement("div");
    tooltip.className = "tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.setAttribute("aria-hidden", "true");
    tooltip.tabIndex = -1;
    tooltip.style.position = "absolute";
    tooltip.style.pointerEvents = "none";
    tooltip.style.opacity = "0";
    tooltip.style.background = "var(--chart-tooltip-bg, rgba(11, 37, 69, 0.88))";
    tooltip.style.color = "var(--chart-tooltip-fg, #f8fafc)";
    tooltip.style.padding = "12px";
    tooltip.style.borderRadius = "calc(var(--chart-bar-radius, 8) * 1px)";
    tooltip.style.border = "1px solid rgba(16, 42, 67, 0.35)";
    tooltip.style.boxShadow = "0 18px 36px rgba(8, 15, 28, 0.35)";
    tooltip.style.fontFamily = "var(--chart-font-family)";
    tooltip.style.fontSize = "calc(var(--chart-font-size) * 1px)";
    tooltip.style.transition = prefersReducedMotion() ? "none" : "opacity 120ms ease";
    const liveRegion = doc.createElement("div");
    liveRegion.className = "tooltip-live";
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.setAttribute("aria-atomic", "true");
    liveRegion.style.position = "absolute";
    liveRegion.style.width = "1px";
    liveRegion.style.height = "1px";
    liveRegion.style.margin = "-1px";
    liveRegion.style.border = "0";
    liveRegion.style.padding = "0";
    liveRegion.style.clip = "rect(0 0 0 0)";
    liveRegion.style.overflow = "hidden";
    root.style.position = root.style.position || "relative";
    root.appendChild(tooltip);
    root.appendChild(liveRegion);
    const handle = {
        element: tooltip,
        liveRegion,
        show(x, y, html) {
            tooltip.innerHTML = html;
            tooltip.style.left = `${Math.round(x)}px`;
            tooltip.style.top = `${Math.round(y)}px`;
            tooltip.setAttribute("aria-hidden", "false");
            tooltip.style.opacity = "1";
            liveRegion.textContent = tooltip.textContent ?? "";
        },
        move(x, y) {
            tooltip.style.left = `${Math.round(x)}px`;
            tooltip.style.top = `${Math.round(y)}px`;
        },
        hide() {
            tooltip.style.opacity = "0";
            tooltip.setAttribute("aria-hidden", "true");
            liveRegion.textContent = "";
        }
    };
    const dismiss = (event) => {
        if (event.key === "Escape") {
            handle.hide();
        }
    };
    root.addEventListener("keydown", dismiss);
    return handle;
}
