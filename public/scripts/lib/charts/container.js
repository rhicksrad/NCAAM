/**
 * Shared chart container helper.
 * @module charts/container
 */
import { cleanupVisibility, registerWhenVisible, setupChartSizing } from "./sizing.js";
import { applyTheme, defaultTheme } from "./theme.js";
function toRenderer(root, renderable) {
    if (typeof renderable === "function") {
        return renderable;
    }
    if (renderable instanceof Element) {
        return () => {
            if (!renderable.isConnected) {
                root.appendChild(renderable);
            }
            return renderable;
        };
    }
    return () => undefined;
}
/**
 * Create a managed chart container.
 */
export function createChartContainer(root, options = {}) {
    if (!(root instanceof HTMLElement)) {
        throw new TypeError("createChartContainer expects an HTMLElement root");
    }
    const theme = options.theme ?? defaultTheme;
    const ratio = options.ratio ?? 0.6;
    applyTheme(root, theme);
    if (!root.classList.contains("viz-canvas")) {
        root.classList.add("viz-canvas");
    }
    let disposed = false;
    let renderer = null;
    let mountedElement = null;
    const cleanupSize = setupChartSizing(root, ratio);
    const executeMount = () => {
        if (disposed || !renderer) {
            return;
        }
        const result = renderer();
        if (result instanceof Element) {
            mountedElement = result;
            if (!result.isConnected) {
                root.appendChild(result);
            }
        }
        else {
            mountedElement = root.firstElementChild;
        }
    };
    return {
        mount(renderable) {
            if (disposed)
                return;
            renderer = toRenderer(root, renderable);
            cleanupVisibility(root);
            registerWhenVisible(root, executeMount);
            if (typeof window === "undefined" || typeof window.IntersectionObserver !== "function") {
                executeMount();
            }
        },
        destroy() {
            if (disposed)
                return;
            disposed = true;
            cleanupVisibility(root);
            cleanupSize();
            if (mountedElement && mountedElement.parentNode === root) {
                root.removeChild(mountedElement);
            }
            mountedElement = null;
            renderer = null;
            root.style.removeProperty("height");
        },
    };
}
