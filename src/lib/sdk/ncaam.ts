import { API } from "../config.js";

async function get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const q = new URLSearchParams(params as Record<string, string>).toString();
  const url = `${API}${path}${q ? `?${q}` : ""}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

export type Team = { id: number; full_name: string; name: string; conference?: string; };
export type Player = { id: number; first_name: string; last_name: string; team: Team; height?: string; };
export type Game = { id: number; date: string; home_team: Team; visitor_team: Team; status: string; };

export const NCAAM = {
  teams: (page = 1, per_page = 50) => get<{ data: Team[] }>("/teams", { page, per_page }),
  players: (page = 1, per_page = 50, search = "") => get<{ data: Player[] }>("/players", { page, per_page, search }),
  games: (page = 1, per_page = 50, dates = "") => get<{ data: Game[] }>("/games", { page, per_page, dates })
};
