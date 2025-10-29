import { BASE } from "../config.js";
const links = [
    ["index.html", "Home"],
    ["teams.html", "Teams"],
    ["players.html", "Players"],
    ["games.html", "Games"],
    ["rankings.html", "Rankings"],
    ["standings.html", "Standings"],
    ["diag.html", "Diag"]
];
function current(pathname, href) {
    return pathname.endsWith(href) ? ' class="active"' : "";
}
export function mountNav() {
    const el = document.getElementById("site-nav");
    if (!el)
        return;
    const here = location.pathname.replace(BASE, "");
    const html = links
        .map(([href, label]) => `<a href="${BASE}${href}"${current(here, href)}>${label}</a>`)
        .join(" · ");
    el.innerHTML = `<nav class="nav">${html}</nav>`;
}
mountNav();
