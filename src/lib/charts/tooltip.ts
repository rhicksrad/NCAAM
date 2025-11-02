/**
 * Accessible tooltip manager.
 * @module charts/tooltip
 */

export interface TooltipHandle {
  element: HTMLDivElement;
  liveRegion: HTMLDivElement;
  show(x: number, y: number, html: string): void;
  move(x: number, y: number): void;
  hide(): void;
}

const prefersReducedMotion = (): boolean => {
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
export function createTooltip(root: HTMLElement): TooltipHandle {
  const doc = root.ownerDocument ?? document;
  const tooltip = doc.createElement("div");
  tooltip.className = "tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.setAttribute("aria-hidden", "true");
  tooltip.tabIndex = -1;
  tooltip.style.position = "absolute";
  tooltip.style.pointerEvents = "none";
  tooltip.style.opacity = "0";
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

  const handle: TooltipHandle = {
    element: tooltip,
    liveRegion,
    show(x: number, y: number, html: string) {
      tooltip.innerHTML = html;
      tooltip.style.left = `${Math.round(x)}px`;
      tooltip.style.top = `${Math.round(y)}px`;
      tooltip.setAttribute("aria-hidden", "false");
      tooltip.style.opacity = "1";
      liveRegion.textContent = tooltip.textContent ?? "";
    },
    move(x: number, y: number) {
      tooltip.style.left = `${Math.round(x)}px`;
      tooltip.style.top = `${Math.round(y)}px`;
    },
    hide() {
      tooltip.style.opacity = "0";
      tooltip.setAttribute("aria-hidden", "true");
      liveRegion.textContent = "";
    }
  };

  const dismiss = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      handle.hide();
    }
  };
  root.addEventListener("keydown", dismiss);

  return handle;
}
