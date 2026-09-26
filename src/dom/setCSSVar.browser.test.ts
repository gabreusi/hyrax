import { afterEach, describe, expect, it } from "vitest";
import { setCSSVar } from "./setCSSVar";
import { toPixels } from "./toPixels";

afterEach(() => {
  document.documentElement.removeAttribute("style");
});

describe("setCSSVar in a real browser", () => {
  it("writes values the cascade and layout then use", () => {
    setCSSVar("--gap", "12px");
    expect(toPixels("calc(var(--gap) * 2)")).toBe(24);
  });

  it("writes to an SVG element", () => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    setCSSVar("--r", 4, circle);
    expect(circle.style.getPropertyValue("--r")).toBe("4");
  });
});
