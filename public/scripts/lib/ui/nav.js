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
function isCurrent(href) {
    const here = location.pathname.replace(BASE, "") || "index.html";
    return here === href ? ' class="active"' : "";
}
export function mountNav() {
    const el = document.getElementById("site-nav");
    if (!el)
        return;
    el.innerHTML = `<nav class="nav">` +
        links.map(([href, label]) => `<a href="${BASE}${href}"${isCurrent(href)}>${label}</a>`).join(" · ") +
        `</nav>`;
}
mountNav();
