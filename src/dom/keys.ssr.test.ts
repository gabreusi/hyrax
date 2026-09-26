// @vitest-environment node
import { describe, expect, it } from "vitest";
import { lockScroll } from "./lockScroll";
import { onKey } from "./onKey";

describe("onKey and lockScroll without a DOM (server-side rendering)", () => {
  it("do nothing instead of throwing", () => {
    expect(typeof document).toBe("undefined");
    expect(() => onKey(null, "mod+k", () => {})()).not.toThrow();
    expect(() => lockScroll()()).not.toThrow();
  });
});
