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
  boxScore: GameBoxScore | null;
  boxScoreError: string | null;
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
  boxScoreError: string | null;
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
  boxScoreError: null,
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
        boxScoreError: cached.boxScoreError,
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
      boxScoreError: null,
    };
    notify();

    try {
      const game = await NCAAM.game(gameId);
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
          boxScoreError: null,
        };
        notify();
        return null;
      }
      let playByPlay: PlayByPlayEvent[] = [];
      let boxScore: GameBoxScore | null = null;
      let boxScoreError: string | null = null;

      try {
        playByPlay = await getGamePlayByPlay(gameId);
        boxScore = buildBoxScoreFromPlayByPlay({ game, events: playByPlay });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (/\b404\b/.test(message)) {
          playByPlay = [];
          boxScore = buildBoxScoreFromPlayByPlay({ game, events: [] });
          boxScoreError = null;
        } else {
          boxScoreError = message;
          boxScore = null;
        }
      }

      state = {
        ...state,
        status: "success",
        isLoading: false,
        isError: false,
        error: null,
        game,
        playByPlay,
        boxScore,
        boxScoreError,
      };
      cache.set(gameId, { game, playByPlay, boxScore, boxScoreError });
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
        boxScoreError: null,
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

