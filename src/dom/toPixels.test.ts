import { afterEach, describe, expect, it, vi } from "vitest";
import { toPixels } from "./toPixels";

afterEach(() => {
  vi.restoreAllMocks();
  document.head.innerHTML = "";
  document.documentElement.removeAttribute("style");
  document.body.removeAttribute("style");
  document.body.innerHTML = "";
});

describe("toPixels: numbers and simple lengths", () => {
  it("returns a finite number as it is (it is already pixels)", () => {
    expect(toPixels(12)).toBe(12);
    expect(toPixels(-3.5)).toBe(-3.5);
    expect(toPixels(0)).toBe(0);
  });

  it("returns NaN for a number that is not finite", () => {
    expect(toPixels(NaN)).toBeNaN();
    expect(toPixels(Infinity)).toBeNaN();
  });

  it("reads a length in pixels", () => {
    expect(toPixels("10px")).toBe(10);
    expect(toPixels("  10px  ")).toBe(10);
    expect(toPixels("-4px")).toBe(-4);
    expect(toPixels("0.5px")).toBe(0.5);
  });
});

// happy-dom does not pass custom properties down from <html> to <body> the way a browser does, so
// these tests define them on the element used as the context. Inheritance is tested in the
// browser project (toPixels.browser.test.ts).
describe("toPixels: custom properties", () => {
  it("resolves var(--name)", () => {
    document.body.style.setProperty("--gap", "12px");
    expect(toPixels("var(--gap)")).toBe(12);
  });

  it("accepts a bare --name as a shorthand for var(--name)", () => {
    document.body.style.setProperty("--gap", "12px");
    expect(toPixels("--gap")).toBe(12);
  });

  it("uses the fallback of var() when the property is missing", () => {
    expect(toPixels("var(--nope, 7px)")).toBe(7);
  });

  it("returns NaN when the property is missing and there is no fallback", () => {
    // Left to the browser, this would silently measure the width of the container instead.
    expect(toPixels("var(--nope)")).toBeNaN();
    expect(toPixels("--nope")).toBeNaN();
  });

  it("reads custom properties from the context element, so scoped values win", () => {
    document.body.style.setProperty("--gap", "12px");
    const scope = document.createElement("section");
    scope.style.setProperty("--gap", "30px");
    document.body.appendChild(scope);
    expect(toPixels("--gap", scope)).toBe(30);
    expect(toPixels("--gap")).toBe(12);
  });
});

describe("toPixels: values it refuses", () => {
  it("returns NaN for an empty string and for the keywords that are not lengths", () => {
    for (const value of [
      "",
      "   ",
      "auto",
      "inherit",
      "initial",
      "unset",
      "revert",
      "revert-layer",
      "AUTO",
    ]) {
      expect(toPixels(value)).toBeNaN();
    }
  });

  it("returns NaN for a bare -- and for malformed var()", () => {
    expect(toPixels("--")).toBeNaN();
    expect(toPixels("var(--gap")).toBeNaN();
    expect(toPixels("var()")).toBeNaN();
  });
});

describe("toPixels: the measuring element", () => {
  it("is removed afterwards, and leaves the page as it was", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    toPixels("10px", container);
    toPixels("var(--nope)", container);
    toPixels("abc", container);
    expect(container.childNodes).toHaveLength(0);
    expect(document.body.childNodes).toHaveLength(1);
  });

  it("is removed even when reading the style throws", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const real = window.getComputedStyle.bind(window);
    let calls = 0;
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      if (++calls === 2) throw new Error("boom");
      return real(element);
    });
    expect(() => toPixels("10px", container)).toThrow("boom");
    expect(container.childNodes).toHaveLength(0);
  });

  it("is appended to the element it is given, and to <body> by default", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const inContainer = vi.spyOn(container, "appendChild");
    const inBody = vi.spyOn(document.body, "appendChild");
    toPixels("10px", container);
    expect(inContainer).toHaveBeenCalledOnce();
    expect(inBody).not.toHaveBeenCalled();
    toPixels("10px");
    expect(inBody).toHaveBeenCalledOnce();
  });

  it("does not paint, take clicks or take up space", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const append = vi.spyOn(container, "appendChild");
    toPixels("10px", container);
    const probe = append.mock.calls[0]?.[0] as HTMLElement;
    expect(probe.style.visibility).toBe("hidden");
    expect(probe.style.pointerEvents).toBe("none");
    expect(probe.style.height).toBe("0px");
  });

  it("returns NaN when there is no <body> to measure in", () => {
    const body = document.body;
    body.remove();
    try {
      expect(toPixels("10px")).toBeNaN();
    } finally {
      document.documentElement.appendChild(body);
    }
  });
});
