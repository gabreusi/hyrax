import { afterEach, describe, expect, it } from "vitest";
import { toPixels } from "./toPixels";

/** A 400px-wide box with its own font size, appended to <body>. */
const box = (css = "") => {
  const element = document.createElement("div");
  element.style.cssText = `width: 400px; font-size: 10px; ${css}`;
  document.body.appendChild(element);
  return element;
};

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  document.documentElement.removeAttribute("style");
});

describe("toPixels in a real browser: what happy-dom cannot measure", () => {
  it("resolves em against the font size of the element it is given", () => {
    expect(toPixels("2em", box())).toBe(20);
    expect(toPixels("2em", box("font-size: 16px;"))).toBe(32);
  });

  it("resolves rem against the root font size", () => {
    document.documentElement.style.fontSize = "20px";
    expect(toPixels("2rem", box())).toBe(40);
  });

  it("resolves a percentage against the width of the element it is given", () => {
    expect(toPixels("50%", box())).toBe(200);
    expect(toPixels("25%", box("width: 800px;"))).toBe(200);
  });

  it("resolves viewport units", () => {
    expect(toPixels("50vw")).toBeCloseTo(window.innerWidth / 2, 1);
    expect(toPixels("10vh")).toBeCloseTo(window.innerHeight / 10, 1);
    expect(toPixels("10dvh")).toBeGreaterThan(0);
  });

  it("resolves calc(), min(), max() and clamp()", () => {
    const element = box();
    expect(toPixels("calc(1px + 2px)", element)).toBe(3);
    expect(toPixels("calc(50% - 10px)", element)).toBe(190);
    expect(toPixels("min(10px, 5px)", element)).toBe(5);
    expect(toPixels("max(10px, 5px)", element)).toBe(10);
    expect(toPixels("clamp(1px, 500px, 50px)", element)).toBe(50);
  });

  it("handles negative lengths, which a `width` based measurement would refuse", () => {
    const element = box();
    expect(toPixels("-1em", element)).toBe(-10);
    expect(toPixels("-25%", element)).toBe(-100);
    expect(toPixels("calc(-1 * 2em)", element)).toBe(-20);
  });

  it("combines custom properties with layout units", () => {
    const element = box("--gap: 3em;");
    expect(toPixels("var(--gap)", element)).toBe(30);
    expect(toPixels("--gap", element)).toBe(30);
    expect(toPixels("calc(var(--gap) * 2)", element)).toBe(60);
  });

  it("inherits custom properties from :root, and a scoped value wins", () => {
    document.documentElement.style.setProperty("--gap", "2em");
    const inherited = box();
    expect(toPixels("--gap", inherited)).toBe(20);
    const scoped = box("--gap: 5px;");
    expect(toPixels("--gap", scoped)).toBe(5);
  });

  it("returns NaN for a custom property that is not defined, and uses a var() fallback", () => {
    const element = box();
    expect(toPixels("--never-declared", element)).toBeNaN();
    expect(toPixels("var(--never-declared, 2em)", element)).toBe(20);
  });

  it("returns NaN for keywords that a browser measures as 0", () => {
    // `auto` and friends are valid CSS for the measuring property and come back as 0px, which would
    // read as a real zero-width size. In happy-dom they come back unresolved, so only a browser
    // can tell a guard from its absence.
    const element = box();
    for (const value of ["auto", "inherit", "initial", "unset", "revert", "revert-layer", "AUTO"]) {
      expect(toPixels(value, element)).toBeNaN();
    }
  });

  it("returns NaN for values the browser rejects", () => {
    const element = box();
    for (const value of ["abc", "12", "10 px", "1em 2em", "red", "10pxx", "50%%"]) {
      expect(toPixels(value, element)).toBeNaN();
    }
  });

  it("returns NaN for a length that cannot be resolved because nothing is rendered", () => {
    // Inside display:none the percentage has no box to resolve against.
    const hidden = box("display: none;");
    expect(toPixels("50%", hidden)).toBeNaN();
  });

  it("does not move the page", () => {
    const element = box();
    const before = document.documentElement.scrollHeight;
    toPixels("100vh", element);
    toPixels("50%", element);
    expect(document.documentElement.scrollHeight).toBe(before);
    expect(element.childNodes).toHaveLength(0);
  });
});
