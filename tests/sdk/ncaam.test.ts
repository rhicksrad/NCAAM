import { beforeEach, describe, expect, it, vi } from "vitest";

import { NCAAM } from "../../src/lib/sdk/ncaam.js";

declare global {
  // eslint-disable-next-line no-var
  var fetch: typeof fetch;
  // eslint-disable-next-line no-var
  var localStorage: Storage;
}

const createMockResponse = (overrides: Partial<Response> = {}): Response => {
  const body = overrides.body ?? null;
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    statusText: overrides.statusText ?? "OK",
    headers: new Headers(overrides.headers),
    json: overrides.json ?? (async () => ({ data: [], meta: {} })),
    text: overrides.text ?? (async () => (typeof body === "string" ? body : "")),
    arrayBuffer: overrides.arrayBuffer ?? (async () => new ArrayBuffer(0)),
    blob: overrides.blob ?? (async () => new Blob()),
    formData: overrides.formData ?? (async () => new FormData()),
    clone: overrides.clone ?? (() => createMockResponse(overrides)),
    redirected: overrides.redirected ?? false,
    type: overrides.type ?? "basic",
    url: overrides.url ?? "",
    body,
    bodyUsed: overrides.bodyUsed ?? false,
  } as Response;
};

beforeEach(() => {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;

  vi.restoreAllMocks();
});

describe("NCAAM SDK", () => {
  it("fetches a single game by id", async () => {
    const fetchMock = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValue(
        createMockResponse({
          json: async () => ({
            data: {
              id: 321,
              status: "Final",
              home_team: { id: 10, full_name: "Home", name: "Home" },
              visitor_team: { id: 20, full_name: "Away", name: "Away" },
            },
          }),
        }),
      );
    // @ts-expect-error mocking fetch for test environment
    globalThis.fetch = fetchMock;

    const game = await NCAAM.game(321);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/games\/321$/);
    expect(game?.id).toBe(321);
  });

  it("returns null when the API returns no games", async () => {
    const fetchMock = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 404,
          statusText: "Not Found",
        }),
      );
    // @ts-expect-error mocking fetch for test environment
    globalThis.fetch = fetchMock;

    const game = await NCAAM.game(999999);
    expect(game).toBeNull();
  });

  it("aggregates games across pages when requesting large ranges", async () => {
    const createGame = (id: number) => ({
      id,
      date: `2025-01-${String(((id - 1) % 30) + 1).padStart(2, "0")}T12:00:00.000Z`,
      status: "Final",
      home_team: { id: 1, full_name: "Home", name: "Home" },
      visitor_team: { id: 2, full_name: "Away", name: "Away" },
    });

    const firstPage = Array.from({ length: 100 }, (_, index) => createGame(index + 1));
    const secondPage = Array.from({ length: 50 }, (_, index) => createGame(index + 101));

    const fetchMock = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockImplementation(input => {
        const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const url = new URL(rawUrl, "https://example.test");
        const page = Number(url.searchParams.get("page"));
        const perPage = Number(url.searchParams.get("per_page"));

        if (page === 1) {
          expect(perPage).toBe(100);
          expect(url.searchParams.get("start_date")).toBe("2025-01-01");
          expect(url.searchParams.get("end_date")).toBe("2025-01-07");
          return Promise.resolve(
            createMockResponse({
              json: async () => ({
                data: firstPage,
                meta: { current_page: 1, next_page: 2, total_pages: 2 },
              }),
            }),
          );
        }

        if (page === 2) {
          expect(perPage).toBe(50);
          return Promise.resolve(
            createMockResponse({
              json: async () => ({
                data: secondPage,
                meta: { current_page: 2, next_page: null, total_pages: 2 },
              }),
            }),
          );
        }

        throw new Error(`Unexpected page ${page}`);
      });

    // @ts-expect-error mocking fetch for test environment
    globalThis.fetch = fetchMock;

    const response = await NCAAM.games(1, 150, "2025-01-01", "2025-01-07");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.data).toHaveLength(150);
    expect(response.data[0]?.id).toBe(1);
    expect(response.data[149]?.id).toBe(150);
    expect(response.meta?.current_page ?? null).toBe(2);
  });
});

