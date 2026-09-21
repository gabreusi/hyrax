// @vitest-environment node
import { describe, expect, it } from "vitest";
import { toPixels } from "./toPixels";

describe("toPixels without a DOM (server-side rendering)", () => {
  it("returns NaN for a CSS length instead of throwing", () => {
    expect(typeof document).toBe("undefined");
    expect(toPixels("2em")).toBeNaN();
    expect(toPixels("var(--gap)")).toBeNaN();
  });

  it("still returns a plain number, which needs no DOM", () => {
    expect(toPixels(24)).toBe(24);
  });
});
