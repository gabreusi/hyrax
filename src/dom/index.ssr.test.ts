// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as dom from "./index";

describe("@gabreusi/hyrax/dom without a DOM (server-side rendering)", () => {
  it("can be imported and called without touching document or window", () => {
    expect(typeof document).toBe("undefined");
    expect(typeof window).toBe("undefined");
    expect(dom.getCSSVar("--x", "fallback")).toBe("fallback");
    expect(dom.toPixels("2em")).toBeNaN();
    expect(typeof dom.listen(null, "click", () => {})).toBe("function");
    expect(typeof dom.onClickOutside(null, () => {})).toBe("function");
    expect(() => dom.setCSSVar("--x", 1)).not.toThrow();
    expect(dom.readStorage("x", "fallback")).toBe("fallback");
    expect(dom.writeStorage("x", 1)).toBe(false);
    expect(typeof dom.observeSize(null, () => {})).toBe("function");
    expect(typeof dom.onVisible(null, () => {})).toBe("function");
  });
});
