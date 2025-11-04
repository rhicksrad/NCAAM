import { BASE } from "../config.js";
const LINKS = [
    ["index.html", "Home"],
    ["teams.html", "Teams"],
    ["players.html", "Players"],
    ["games.html", "Games"],
    ["rankings.html", "Rankings"],
    ["standings.html", "Standings"],
    ["about.html", "About"],
];
const MOBILE_QUERY = "(max-width: 768px)";
function resolveCurrent() {
    const raw = location.pathname.replace(BASE, "");
    return raw === "" ? "index.html" : raw;
}
export function mountNav() {
    const el = document.getElementById("site-nav");
    if (!el)
        return;
    const doc = el.ownerDocument ?? document;
    const here = resolveCurrent();
    const header = el.closest(".site-header");
    const toggle = header?.querySelector(".site-nav__toggle");
    const media = typeof window !== "undefined" ? window.matchMedia(MOBILE_QUERY) : null;
    let isOpen = false;
    el.innerHTML = "";
    el.classList.add("site-nav");
    if (!el.hasAttribute("role")) {
        el.setAttribute("role", "navigation");
    }
    if (!el.hasAttribute("aria-label")) {
        el.setAttribute("aria-label", "Site");
    }
    const fragment = doc.createDocumentFragment();
    for (const [href, label] of LINKS) {
        const anchor = doc.createElement("a");
        anchor.href = `${BASE}${href}`;
        anchor.textContent = label;
        anchor.className = "site-nav__link";
        if (here === href) {
            anchor.setAttribute("aria-current", "page");
        }
        fragment.appendChild(anchor);
    }
    el.appendChild(fragment);
    if (header) {
        header.setAttribute("data-nav-enhanced", "true");
    }
    const updateState = (open) => {
        if (!media)
            return;
        if (!media.matches) {
            isOpen = false;
            el.hidden = false;
            el.removeAttribute("aria-hidden");
            header?.removeAttribute("data-nav-open");
            toggle?.setAttribute("aria-expanded", "false");
            return;
        }
        isOpen = open;
        el.hidden = !open;
        el.setAttribute("aria-hidden", open ? "false" : "true");
        if (open) {
            header?.setAttribute("data-nav-open", "true");
        }
        else {
            header?.removeAttribute("data-nav-open");
        }
        toggle?.setAttribute("aria-expanded", open ? "true" : "false");
    };
    const applyMedia = () => {
        if (!media)
            return;
        if (media.matches) {
            updateState(false);
        }
        else {
            el.hidden = false;
            el.removeAttribute("aria-hidden");
            header?.removeAttribute("data-nav-open");
            toggle?.setAttribute("aria-expanded", "false");
        }
    };
    applyMedia();
    media?.addEventListener("change", applyMedia);
    if (toggle) {
        toggle.addEventListener("click", () => updateState(!isOpen));
    }
    el.addEventListener("click", (event) => {
        if (!media?.matches)
            return;
        const target = event.target;
        if (target instanceof Element && target.closest(".site-nav__link")) {
            updateState(false);
        }
    });
    doc.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && isOpen && media?.matches) {
            updateState(false);
        }
    });
    doc.addEventListener("click", (event) => {
        if (!isOpen || !media?.matches)
            return;
        const target = event.target;
        if (target instanceof Element && header && !header.contains(target)) {
            updateState(false);
        }
    }, { capture: true });
}
mountNav();
