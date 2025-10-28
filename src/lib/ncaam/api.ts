const ROOT = 'https://ncaam.hicksrch.workers.dev';
const BASE = ROOT + '/v1';

export async function diag(): Promise<unknown> {
  const r = await fetch(ROOT + '/diag', { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`NCAAM diag failed ${r.status}`);
  return r.json();
}

async function q(path: string, params?: Record<string, string | number | undefined>): Promise<unknown> {
  const u = new URL(path.startsWith('/') ? path.slice(1) : path, BASE + '/');
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') u.searchParams.set(k, String(v));
    }
  }
  const r = await fetch(u.toString(), { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`NCAAM ${r.status} ${path}`);
  return r.json();
}

export const Ncaam = {
  conferences: (params?: Record<string, string | number>) => q('/conferences', params),
  teams:       (params?: Record<string, string | number>) => q('/teams', params),
  players:     (params?: Record<string, string | number>) => q('/players', params),
  player:      (id: string) => q(`/players/${id}`),
  games:       (params?: Record<string, string | number>) => q('/games', params),
  standings:   (params: { season: number; conference_id?: string }) => q('/standings', params),
  rankings:    (params: { season: number; week?: number }) => q('/rankings', params),
  plays:       (params: { game_id: string; page?: number }) => q('/plays', params)
};
