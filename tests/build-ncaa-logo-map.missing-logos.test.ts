import { promises as fs } from "node:fs";
import { describe, expect, it, vi, afterEach } from "vitest";

const TEAM_HEIGHT_FIXTURE = JSON.stringify({
  teams: [
    { team_id: 200, team: "Existing Team" },
    { team_id: 300, team: "Missing Team" },
  ],
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unmock("../scripts/lib/ncaa-logos.mjs");
});

describe("build-ncaa-logo-map coverage guard", () => {
  it("fails when a Division I program lacks a logo entry", async () => {
    vi.resetModules();
    vi.mock("../scripts/lib/ncaa-logos.mjs", () => {
      const logos = new Map([["200", { name: "Existing Team", aliases: [] }]]);
      return {
        __esModule: true,
        LOGOS_DIR: "/virtual/public/data/logos",
        verifyNcaALogos: vi.fn(async () => ({ logos })),
        fetchEspnTeamDirectory: vi.fn(async () => [
          { id: "200", displayName: "Existing Team" },
          { id: "300", displayName: "Missing Team" },
        ]),
      };
    });

    const realReadFile = fs.readFile;
    vi.spyOn(fs, "readFile").mockImplementation(async (filePath: any, ...args: any[]) => {
      if (typeof filePath === "string" && filePath.endsWith("public/data/team-height-snapshot.json")) {
        return TEAM_HEIGHT_FIXTURE;
      }
      return realReadFile.call(fs, filePath, ...args);
    });

    const realReaddir = fs.readdir;
    vi.spyOn(fs, "readdir").mockImplementation(async (dirPath: any, ...args: any[]) => {
      if (dirPath === "/virtual/public/data/logos") {
        return ["200.png"];
      }
      return realReaddir.call(fs, dirPath, ...args);
    });

    const writeFileSpy = vi.spyOn(fs, "writeFile").mockResolvedValue();

    const { buildLogoMap } = await import("../scripts/build-ncaa-logo-map.mjs");

    await expect(buildLogoMap()).rejects.toThrowError(/Missing NCAA logo assets[\s\S]*Missing Team \(300\)/);
    expect(writeFileSpy).not.toHaveBeenCalled();
  });
});
