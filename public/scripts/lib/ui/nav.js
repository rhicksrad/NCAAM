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
}
mountNav();
