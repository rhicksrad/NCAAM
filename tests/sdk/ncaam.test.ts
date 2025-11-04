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
});

