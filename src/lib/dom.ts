// Tiny templating: html`...` escapes every interpolation unless it is already
// a Markup value (the result of another html`` call or raw()).
export class Markup {
  constructor(readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ENTITIES[ch] ?? ch);
}

function render(value: unknown): string {
  if (value instanceof Markup) return value.value;
  if (Array.isArray(value)) return value.map(render).join("");
  if (value === null || value === undefined || value === false) return "";
  return esc(value);
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): Markup {
  let out = strings[0] ?? "";
  for (let i = 0; i < values.length; i++) out += render(values[i]) + (strings[i + 1] ?? "");
  return new Markup(out);
}

export const raw = (value: string): Markup => new Markup(value);

export function $<T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element ${selector}`);
  return el;
}

export function mount(target: Element | string, markup: Markup | string): void {
  const el = typeof target === "string" ? $(target) : target;
  el.innerHTML = String(markup);
}

export function param(name: string): string | null {
  return new URLSearchParams(location.search).get(name);
}

export function setParams(next: Record<string, string | null>): void {
  const url = new URL(location.href);
  for (const [key, value] of Object.entries(next)) {
    if (value === null || value === "") url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  history.replaceState(null, "", url);
}

/** Segmented control: returns markup; wire with onSegment. */
export function segmented(options: Array<{ value: string; label: string }>, current: string): Markup {
  return html`${options.map(
    (o) => html`<button type="button" data-value="${o.value}" aria-pressed="${o.value === current ? "true" : "false"}">${o.label}</button>`,
  )}`;
}

export function onSegment(root: Element, handler: (value: string) => void): void {
  root.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-value]");
    if (!button) return;
    for (const b of root.querySelectorAll("button[data-value]")) b.setAttribute("aria-pressed", String(b === button));
    handler(button.dataset.value ?? "");
  });
}
