// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readStorage, writeStorage } from "./storage";

describe("storage without a window (server-side rendering)", () => {
  it("returns the fallback and writes nothing, even where the runtime has its own localStorage", () => {
    expect(typeof window).toBe("undefined");
    expect(readStorage("key", "fallback")).toBe("fallback");
    expect(writeStorage("key", 1)).toBe(false);
  });
});
