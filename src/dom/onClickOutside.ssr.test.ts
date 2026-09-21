// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { onClickOutside } from "./onClickOutside";

describe("onClickOutside without a DOM (server-side rendering)", () => {
  it("does nothing, and returns a function, instead of throwing", () => {
    expect(typeof document).toBe("undefined");
    const handler = vi.fn();
    const off = onClickOutside(null, handler);
    expect(() => off()).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });
});
