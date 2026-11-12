// Two-speed data. Every page paints first from a same-origin snapshot that the
// deploy job baked a few minutes or hours ago, then swaps in the live ESPN
// answer when it lands. If ESPN never answers, the snapshot stays up.
import type { Conference, Game, NewsItem, Poll, Team } from "./espn.js";

export type Stamped<T> = { at: string; data: T };
export type TeamEntry = Team & { conf: string; confName: string };

export type SnapshotShapes = {
  scoreboard: { day: string; games: Game[] };
  rankings: Poll[];
  standings: Conference[];
  teams: TeamEntry[];
  news: NewsItem[];
};

const base = (path: string) => new URL(path, document.baseURI).toString();
const memo = new Map<string, Promise<unknown>>();

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(base(path));
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()) as T;
}

/** Static, build-time datasets under data/. Cached for the life of the page. */
export function dataset<T>(name: string): Promise<T> {
  let hit = memo.get(name) as Promise<T> | undefined;
  if (!hit) {
    hit = getJson<T>(`data/${name}.json`);
    hit.catch(() => memo.delete(name));
    memo.set(name, hit);
  }
  return hit;
}

export function snapshot<K extends keyof SnapshotShapes>(name: K): Promise<Stamped<SnapshotShapes[K]>> {
  return dataset<Stamped<SnapshotShapes[K]>>(`live/${name}`);
}

export type FeedInfo = {
  /** True once the data on screen came straight from ESPN. */
  live: boolean;
  /** When the data on screen was fetched. */
  at: string;
  /** True when the live request failed and we are showing the snapshot. */
  stale: boolean;
};

type FeedOptions<T> = {
  saved?: () => Promise<Stamped<T>>;
  live: () => Promise<T>;
  render: (data: T, info: FeedInfo) => void;
  /** Called only when neither source produced anything. */
  fail: (error: unknown) => void;
  /** Re-ask ESPN on this interval while the tab is visible. */
  refreshMs?: number | ((data: T) => number);
};

export function feed<T>(options: FeedOptions<T>): { refresh: () => void } {
  let shown: "none" | "saved" | "live" = "none";
  let savedAt = "";
  let last: T | undefined;
  let timer: number | undefined;

  const askLive = async () => {
    try {
      const data = await options.live();
      shown = "live";
      last = data;
      options.render(data, { live: true, at: new Date().toISOString(), stale: false });
    } catch (error) {
      if (shown === "none") {
        // Give the snapshot a chance to land before declaring failure.
        try {
          const saved = await options.saved?.();
          if (saved) {
            shown = "saved";
            last = saved.data;
            options.render(saved.data, { live: false, at: saved.at, stale: true });
            return;
          }
        } catch {
          /* fall through */
        }
        options.fail(error);
      } else if (shown === "saved" && last !== undefined) {
        options.render(last, { live: false, at: savedAt, stale: true });
      }
    } finally {
      schedule();
    }
  };

  const schedule = () => {
    window.clearTimeout(timer);
    const every = typeof options.refreshMs === "function" ? (last !== undefined ? options.refreshMs(last) : 0) : options.refreshMs;
    if (!every) return;
    timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") void askLive();
      else schedule();
    }, every);
  };

  options
    .saved?.()
    .then((saved) => {
      if (shown !== "none") return;
      shown = "saved";
      savedAt = saved.at;
      last = saved.data;
      options.render(saved.data, { live: false, at: saved.at, stale: false });
    })
    .catch(() => undefined);
  void askLive();
  return { refresh: () => void askLive() };
}
