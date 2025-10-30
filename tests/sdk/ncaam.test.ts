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

describe("NCAAM.playerStats", () => {
  it("builds the correct query parameters", async () => {
    const fetchMock = vi.fn(async () =>
      createMockResponse({ json: async () => ({ data: [], meta: {} }) }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await NCAAM.playerStats({
      season: 2025,
      teamIds: [1, 2],
      playerIds: [101],
      page: 3,
      perPage: 55,
      postseason: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0] as [RequestInfo, RequestInit | undefined];
    const url = new URL(typeof input === "string" ? input : (input as Request).url);
    expect(url.pathname.endsWith("/stats")).toBe(true);
    expect(url.searchParams.get("season")).toBe("2025");
    expect(url.searchParams.getAll("team_ids[]")).toEqual(["1", "2"]);
    expect(url.searchParams.getAll("player_ids[]")).toEqual(["101"]);
    expect(url.searchParams.get("page")).toBe("3");
    expect(url.searchParams.get("per_page")).toBe("55");
    expect(url.searchParams.get("postseason")).toBe("true");
    expect(init?.headers).toMatchObject({ Accept: "application/json" });
  });

  it("uses cached responses on repeated calls", async () => {
    const fetchMock = vi
      .fn(async () => createMockResponse({ json: async () => ({ data: [], meta: {} }) }))
      .mockName("fetch");
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await NCAAM.playerStats({ season: 2024 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await NCAAM.playerStats({ season: 2024 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
