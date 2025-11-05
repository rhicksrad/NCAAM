/**
 * Responsive sizing and visibility helpers for charts.
 * @module charts/sizing
 */
const sizingObservers = new WeakMap();
const visibilityRegistry = new WeakMap();
function resolveWindow(root) {
    const doc = root.ownerDocument ?? document;
    return doc.defaultView ?? null;
}
function scheduleResize(win, callback) {
    return typeof win.requestAnimationFrame === "function"
        ? win.requestAnimationFrame(callback)
        : win.setTimeout(callback, 16);
}
function cancelScheduledResize(win, id) {
    if (typeof win.cancelAnimationFrame === "function") {
        win.cancelAnimationFrame(id);
    }
    else {
        win.clearTimeout(id);
    }
}
/**
 * Apply responsive sizing to a chart container.
 *
 * @param root - Container element whose height should follow its width.
 * @param ratio - Height ratio relative to width (height = width × ratio).
 */
export function setupChartSizing(root, ratio = 0.6) {
    if (!(root instanceof HTMLElement)) {
        throw new TypeError("setupChartSizing expects an HTMLElement root");
    }
    const win = resolveWindow(root);
    const state = sizingObservers.get(root) ?? {};
    sizingObservers.set(root, state);
    const applySize = () => {
        const width = root.clientWidth || root.offsetWidth;
        if (width > 0) {
            const height = Math.max(1, Math.round(width * ratio));
            root.style.setProperty("height", `${height}px`);
        }
    };
    applySize();
    if (win && typeof win.ResizeObserver === "function") {
        if (state.resizeObserver) {
            state.resizeObserver.disconnect();
        }
        const observer = new win.ResizeObserver(() => {
            if (state.rafId !== undefined && state.rafId >= 0) {
                cancelScheduledResize(win, state.rafId);
            }
            state.rafId = scheduleResize(win, applySize);
        });
        observer.observe(root);
        state.resizeObserver = observer;
    }
    else if (win) {
        if (state.resizeHandler) {
            win.removeEventListener("resize", state.resizeHandler);
        }
        const handler = () => applySize();
        state.resizeHandler = handler;
        win.addEventListener("resize", handler, { passive: true });
    }
    return () => {
        const cleanupState = sizingObservers.get(root);
        if (!cleanupState)
            return;
        const currentWin = resolveWindow(root);
        if (cleanupState.resizeObserver) {
            cleanupState.resizeObserver.disconnect();
            cleanupState.resizeObserver = undefined;
        }
        if (cleanupState.resizeHandler && currentWin) {
            currentWin.removeEventListener("resize", cleanupState.resizeHandler);
            cleanupState.resizeHandler = undefined;
        }
        if (cleanupState.rafId !== undefined && cleanupState.rafId >= 0 && currentWin) {
            cancelScheduledResize(currentWin, cleanupState.rafId);
        }
        root.style.removeProperty("height");
        sizingObservers.delete(root);
    };
}
/**
 * Register a callback to mount a chart when the container becomes visible.
 *
 * @param root - Element to observe for visibility.
 * @param mount - Callback invoked the first time the element is visible.
 */
export function registerWhenVisible(root, mount) {
    if (!(root instanceof Element)) {
        throw new TypeError("registerWhenVisible expects an Element");
    }
    let state = visibilityRegistry.get(root);
    if (!state) {
        state = { mounted: false };
        visibilityRegistry.set(root, state);
    }
    state.mounted = false;
    state.mount = mount;
    const run = () => {
        if (!state || state.mounted) {
            return;
        }
        state.mounted = true;
        try {
            mount();
        }
        finally {
            if (state.observer) {
                state.observer.unobserve(root);
                state.observer.disconnect();
                state.observer = undefined;
            }
        }
    };
    const win = resolveWindow(root);
    if (!win || typeof win.IntersectionObserver !== "function") {
        run();
        return;
    }
    if (state.observer) {
        state.observer.unobserve(root);
        state.observer.disconnect();
    }
    const observer = new win.IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.target === root && (entry.isIntersecting || entry.intersectionRatio > 0)) {
                run();
            }
        });
    }, { rootMargin: "120px 0px", threshold: [0, 0.01, 0.1] });
    observer.observe(root);
    state.observer = observer;
}
/**
 * Stop observing visibility changes for an element.
 */
export function cleanupVisibility(root) {
    const state = visibilityRegistry.get(root);
    if (!state)
        return;
    if (state.observer) {
        state.observer.unobserve(root);
        state.observer.disconnect();
    }
    visibilityRegistry.delete(root);
}
