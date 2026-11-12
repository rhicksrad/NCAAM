// Runs on every page: logo fallbacks and the "find a team" dialog.
import { snapshot, type TeamEntry } from "./data.js";
import { html, mount } from "./dom.js";
import { logo, teamHref } from "./ui.js";

// Logo fallback chain: ESPN CDN -> local 32px copy -> lettered disc.
document.addEventListener(
  "error",
  (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.team) return;
    if (!img.dataset.fellBack) {
      img.dataset.fellBack = "1";
      img.src = new URL(`data/logos/${img.dataset.team}.png`, document.baseURI).toString();
      return;
    }
    const disc = document.createElement("span");
    disc.className = `${img.className} logo--blank`;
    disc.textContent = (img.dataset.abbr ?? "").slice(0, 3);
    disc.setAttribute("aria-hidden", "true");
    img.replaceWith(disc);
  },
  true,
);

let dialog: HTMLDialogElement | null = null;
let teams: TeamEntry[] = [];

function matches(query: string): TeamEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return teams.slice(0, 0);
  const starts: TeamEntry[] = [];
  const contains: TeamEntry[] = [];
  for (const t of teams) {
    const hay = `${t.name} ${t.mascot} ${t.abbr} ${t.short}`.toLowerCase();
    if (t.name.toLowerCase().startsWith(q) || t.abbr.toLowerCase() === q) starts.push(t);
    else if (hay.includes(q)) contains.push(t);
  }
  return [...starts, ...contains].slice(0, 8);
}

function openFinder(): void {
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.className = "finder-dialog";
    dialog.setAttribute("aria-label", "Find a team");
    dialog.innerHTML = `<input type="search" placeholder="Type a school" autocomplete="off" spellcheck="false" aria-controls="finder-results"><ul id="finder-results" role="listbox"></ul>`;
    document.body.append(dialog);
    const input = dialog.querySelector("input")!;
    const list = dialog.querySelector("ul")!;
    let selected = 0;
    const paint = () => {
      const found = matches(input.value);
      selected = Math.min(selected, Math.max(0, found.length - 1));
      mount(
        list,
        found.length
          ? html`${found.map(
              (t, i) =>
                html`<li role="option" aria-selected="${i === selected ? "true" : "false"}"><a href="${teamHref(t.id)}">${logo(t)}<span>${t.name} ${t.mascot}</span><small>${t.conf}</small></a></li>`,
            )}`
          : html`<li class="empty">${input.value.trim() ? "No school by that name." : teams.length ? "362 Division I programs. Start typing." : "Loading the directory…"}</li>`,
      );
    };
    input.addEventListener("input", () => {
      selected = 0;
      paint();
    });
    input.addEventListener("keydown", (event) => {
      const count = list.querySelectorAll("li[role=option]").length;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (count) selected = (selected + (event.key === "ArrowDown" ? 1 : count - 1)) % count;
        paint();
      } else if (event.key === "Enter") {
        const link = list.querySelector<HTMLAnchorElement>('li[aria-selected="true"] a');
        if (link) location.href = link.href;
      }
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog?.close();
    });
    paint();
    snapshot("teams")
      .then((saved) => {
        teams = saved.data;
        paint();
      })
      .catch(() => undefined);
  }
  dialog.showModal();
  dialog.querySelector("input")?.select();
}

document.getElementById("finder-open")?.addEventListener("click", openFinder);
document.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement | null;
  const typing = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    openFinder();
  }
});
