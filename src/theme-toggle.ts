const STORAGE_KEY = "ncaam-theme";
const root = document.documentElement;
const initial = window.localStorage.getItem(STORAGE_KEY);
if (initial) {
  root.dataset.theme = initial;
} else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
  root.dataset.theme = "dark";
}

const toggle = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
if (toggle) {
  const sync = () => toggle.setAttribute("aria-pressed", root.dataset.theme === "dark" ? "true" : "false");
  toggle.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    window.localStorage.setItem(STORAGE_KEY, next);
    sync();
  });
  sync();
}
