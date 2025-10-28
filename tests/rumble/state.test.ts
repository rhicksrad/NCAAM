import { describe, expect, it } from "vitest";
import { decodeMatchup, encodeMatchup } from "../../src/players/rumble/state";

const sample = {
  a: ["alpha", "beta", "gamma"],
  b: ["delta", "omega"],
  eraNorm: true,
};

describe("state encoding", () => {
  it("round-trips state via base64", () => {
    const encoded = encodeMatchup(sample);
    expect(encoded).toMatchSnapshot();
    expect(decodeMatchup(encoded)).toEqual(sample);
  });
});
