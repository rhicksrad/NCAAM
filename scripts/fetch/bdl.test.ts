import { describe, expect, it, beforeEach, afterEach, vi, type MockInstance } from "vitest";
import { z } from "zod";

import { BallDontLieClient } from "./ball_dont_lie_client.js";

vi.mock("./http.js", () => {
  return {
    request: vi.fn(),
  };
});

const { request } = await import("./http.js");

const mockRequest = request as unknown as MockInstance<[string, RequestInit?], Promise<unknown>>;

describe("BallDontLieClient.paginate", () => {
  const client = new BallDontLieClient({ baseUrl: "https://example.test" });

  beforeEach(() => {
    mockRequest.mockReset();
  });

  it("advances using cursor pagination", async () => {
    mockRequest
      .mockResolvedValueOnce({
        data: [1, 2],
        meta: { next_cursor: 25, per_page: 2 },
      })
      .mockResolvedValueOnce({
        data: [3, 4],
        meta: { next_cursor: null, per_page: 2 },
      });

    const result = await client.paginate<number>("/v1/demo", {}, 2, undefined, z.number());

    expect(result).toEqual([1, 2, 3, 4]);
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[0][0]).toContain("https://example.test/v1/demo");
    expect(mockRequest.mock.calls[0][0]).toContain("per_page=2");
    expect(mockRequest.mock.calls[1][0]).toContain("cursor=25");
  });

  it("falls back to page-based pagination when cursor metadata is absent", async () => {
    mockRequest
      .mockResolvedValueOnce({
        data: ["a", "b"],
        meta: { next_page: 2, per_page: 2, current_page: 1 },
      })
      .mockResolvedValueOnce({
        data: ["c"],
        meta: { per_page: 2, current_page: 2, total_pages: 2 },
      });

    const parser = z.string();
    const result = await client.paginate<string>("/v1/demo", {}, 2, undefined, parser);

    expect(result).toEqual(["a", "b", "c"]);
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[1][0]).toContain("page=2");
  });
});

describe("BallDontLieClient.getActivePlayersByTeam", () => {
  const client = new BallDontLieClient({ baseUrl: "https://example.test" });

  beforeEach(() => {
    mockRequest.mockReset();
    process.env.NO_CACHE = "1";
  });

  afterEach(() => {
    delete process.env.NO_CACHE;
  });

  it("requests season-scoped active rosters when a start year is provided", async () => {
    mockRequest.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          first_name: "Ada",
          last_name: "Lovelace",
          position: null,
          jersey_number: null,
          height: null,
          weight: null,
          team: { id: 42, abbreviation: "ALG", full_name: "Algorithm City" },
        },
        {
          id: 2,
          first_name: "Charles",
          last_name: "Babbage",
          position: null,
          jersey_number: null,
          height: null,
          weight: null,
          team: { id: 7, abbreviation: "ALT", full_name: "Alt Mechanics" },
        },
      ],
    });

    const players = await client.getActivePlayersByTeam(42, 2025);

    expect(mockRequest).toHaveBeenCalledTimes(1);
    const [url] = mockRequest.mock.calls[0];
    expect(url).toContain("/v1/players/active");
    expect(url).toContain("team_ids%5B%5D=42");
    expect(url).toContain("seasons%5B%5D=2025");
    expect(players).toEqual([
      {
        id: 1,
        first_name: "Ada",
        last_name: "Lovelace",
        position: null,
        jersey_number: null,
        height: null,
        weight: null,
        team: { id: 42, abbreviation: "ALG", full_name: "Algorithm City" },
      },
    ]);
  });

  it("falls back to the active players endpoint when no season is supplied", async () => {
    mockRequest.mockResolvedValueOnce({
      data: [
        {
          id: 3,
          first_name: "Grace",
          last_name: "Hopper",
          position: "G",
          jersey_number: "99",
          height: "5-6",
          weight: "140",
          team: { id: 7, abbreviation: "ALT", full_name: "Alt Mechanics" },
        },
      ],
    });

    const players = await client.getActivePlayersByTeam(7);

    expect(mockRequest).toHaveBeenCalledTimes(1);
    const [url] = mockRequest.mock.calls[0];
    expect(url).toContain("/v1/players/active");
    expect(url).toContain("team_ids%5B%5D=7");
    expect(url).not.toContain("seasons%5B%5D");
    expect(players).toEqual([
      {
        id: 3,
        first_name: "Grace",
        last_name: "Hopper",
        position: "G",
        jersey_number: "99",
        height: "5-6",
        weight: "140",
        team: { id: 7, abbreviation: "ALT", full_name: "Alt Mechanics" },
      },
    ]);
  });
});
