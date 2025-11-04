import type { PlayByPlayEvent } from "../../lib/api/ncaam.js";
import { getGamePlayByPlay } from "../../lib/api/ncaam.js";
import type { Game } from "../../lib/sdk/ncaam.js";
import { NCAAM } from "../../lib/sdk/ncaam.js";
import type { GameBoxScore } from "../../lib/boxscore.js";
import { buildBoxScoreFromPlayByPlay } from "../../lib/boxscore.js";

type Status = "idle" | "loading" | "success" | "error";

type Subscriber = (state: GameDetailState) => void;

type CachedResult = {
  game: Game;
  playByPlay: PlayByPlayEvent[];
  boxScore: GameBoxScore;
};

export type GameDetailState = {
  gameId: number | null;
  status: Status;
  isLoading: boolean;
  isError: boolean;
  error?: string | null;
  game?: Game | null;
  playByPlay: PlayByPlayEvent[];
  boxScore: GameBoxScore | null;
};

const initialState: GameDetailState = {
  gameId: null,
  status: "idle",
  isLoading: false,
  isError: false,
  error: null,
  game: null,
  playByPlay: [],
  boxScore: null,
};

export function createGameDetailStore() {
  let state: GameDetailState = { ...initialState };
  const subscribers = new Set<Subscriber>();
  const cache = new Map<number, CachedResult>();
  let requestToken = 0;

  const notify = () => {
    for (const subscriber of subscribers) {
      subscriber(state);
    }
  };

  const load = async (gameId: number) => {
    requestToken += 1;
    const currentToken = requestToken;
    const cached = cache.get(gameId);
    if (cached) {
      state = {
        ...state,
        gameId,
        status: "success",
        isLoading: false,
        isError: false,
        error: null,
        game: cached.game,
        playByPlay: cached.playByPlay,
        boxScore: cached.boxScore,
      };
      notify();
      return cached;
    }

    state = {
      ...state,
      gameId,
      status: "loading",
      isLoading: true,
      isError: false,
      error: null,
      game: null,
      playByPlay: [],
      boxScore: null,
    };
    notify();

    try {
      const [game, playByPlay] = await Promise.all([NCAAM.game(gameId), getGamePlayByPlay(gameId)]);
      if (currentToken !== requestToken) {
        return null;
      }
      if (!game) {
        state = {
          ...state,
          status: "error",
          isLoading: false,
          isError: true,
          error: "Game not found",
          game: null,
          playByPlay: [],
          boxScore: null,
        };
        notify();
        return null;
      }
      const boxScore = buildBoxScoreFromPlayByPlay({ game, events: playByPlay });
      state = {
        ...state,
        status: "success",
        isLoading: false,
        isError: false,
        error: null,
        game,
        playByPlay,
        boxScore,
      };
      cache.set(gameId, { game, playByPlay, boxScore });
      notify();
      return state;
    } catch (error) {
      if (currentToken !== requestToken) {
        return null;
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      state = {
        ...state,
        status: "error",
        isLoading: false,
        isError: true,
        error: message,
      };
      notify();
      return null;
    }
  };

  const subscribe = (subscriber: Subscriber) => {
    subscribers.add(subscriber);
    subscriber(state);
    return () => {
      subscribers.delete(subscriber);
    };
  };

  const getState = () => state;

  return {
    subscribe,
    load,
    getState,
  };
}

export type GameDetailStore = ReturnType<typeof createGameDetailStore>;

