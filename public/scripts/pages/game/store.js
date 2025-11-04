import { getGamePlayByPlay } from "../../lib/api/ncaam.js";
import { NCAAM } from "../../lib/sdk/ncaam.js";
import { buildBoxScoreFromPlayByPlay } from "../../lib/boxscore.js";
const initialState = {
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
    let state = { ...initialState };
    const subscribers = new Set();
    const cache = new Map();
    let requestToken = 0;
    const notify = () => {
        for (const subscriber of subscribers) {
            subscriber(state);
        }
    };
    const load = async (gameId) => {
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
            let playByPlay = [];
            let boxScore = null;
            let boxScoreError = null;
            try {
                playByPlay = await getGamePlayByPlay(gameId);
                boxScore = buildBoxScoreFromPlayByPlay({ game, events: playByPlay });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                if (/\b404\b/.test(message)) {
                    playByPlay = [];
                    boxScore = buildBoxScoreFromPlayByPlay({ game, events: [] });
                    boxScoreError = null;
                }
                else {
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
        }
        catch (error) {
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
    const subscribe = (subscriber) => {
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
