import { BRAND, DEFAULT_SEASON } from '../lib/config/ncaam';
import { buildApiUrl } from '../lib/sdk/fetch';
import { el, mount } from '../lib/ui/dom';
import { nav, footer } from '../lib/ui/nav';
import '../../public/styles/site.css';

type Check = {
  label: string;
  path: string;
  params?: Record<string, string | number | boolean | Array<string | number | boolean> | undefined>;
};

type Result = {
  label: string;
  status: number | null;
  duration: number;
  ok: boolean;
  error?: string;
};

const checks: Check[] = [
  { label: 'Rankings', path: '/rankings', params: { season: String(DEFAULT_SEASON) } },
  { label: 'Today Scoreboard', path: '/games', params: { 'dates[]': todayISO() } },
  { label: 'Teams', path: '/teams', params: { per_page: '1' } },
];

function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function runCheck(check: Check): Promise<Result> {
  const url = buildApiUrl(check.path, check.params);
  const started = performance.now();
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const duration = performance.now() - started;
    return { label: check.label, status: res.status, duration, ok: res.ok };
  } catch (err) {
    const duration = performance.now() - started;
    return { label: check.label, status: null, duration, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function formatMs(ms: number): string {
  return `${ms.toFixed(0)} ms`;
}

function resultRow(result: Result): HTMLElement {
  const row = el('div', { class: 'row row-standings' });
  row.appendChild(el('span', { class: 'standings-team' }, result.label));
  row.appendChild(el('span', {}, result.status == null ? '—' : String(result.status)));
  row.appendChild(el('span', {}, formatMs(result.duration)));
  row.appendChild(el('span', {}, result.ok ? 'ok' : 'error'));
  if (result.error) {
    row.appendChild(el('span', { class: 'team-conf' }, result.error));
  }
  return row;
}

async function render() {
  const root = document.getElementById('app');
  if (!root) return;

  const resultsContainer = el('div', { class: 'rows' }, el('div', { class: 'skeleton-row' }, el('span', { class: 'skeleton' })));

  const shell = el('div', { class: 'container' },
    el('h1', { class: 'title' }, `${BRAND.siteTitle} — Diagnostics`),
    nav(),
    el('p', { class: 'empty-state' }, 'Fetches are live; append ?diag=1 to log debug info.'),
    resultsContainer,
    footer()
  );
  mount(root, shell);

  const results = await Promise.all(checks.map(runCheck));
  resultsContainer.replaceChildren(...results.map(resultRow));
}

void render();
