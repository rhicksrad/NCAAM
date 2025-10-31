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

