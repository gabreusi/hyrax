import { describe, expect, it } from "vitest";
import { scripted } from "./scripted";

describe("scripted", () => {
  it("serves exactly the words it was given, in order, and counts them", () => {
    const { rng, used } = scripted([0x01020304, 0x05060708]);
    expect(Array.from(rng.bytes(8))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(used()).toBe(2);
  });

  it("throws when the words run out, instead of cycling into an endless rejection loop", () => {
    const { rng } = scripted([0xffffffff]);
    // int(1, 20) rejects a top-5-bits value of 31, so it asks for a second word that is not there.
    expect(() => rng.int(1, 20)).toThrow("ran out of words");
  });
});
