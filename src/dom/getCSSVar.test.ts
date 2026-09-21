import { afterEach, describe, expect, expectTypeOf, it } from "vitest";
import { getCSSVar } from "./getCSSVar";

const sheet = (css: string) => {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  return style;
};

afterEach(() => {
  document.head.innerHTML = "";
  document.documentElement.removeAttribute("style");
  document.body.removeAttribute("style");
});

describe("getCSSVar", () => {
  it("reads a custom property declared on :root", () => {
    sheet(":root { --primary: #3498db; }");
    expect(getCSSVar("--primary")).toBe("#3498db");
  });

  it("reads one set through the inline style of <html>", () => {
    document.documentElement.style.setProperty("--gap", "12px");
    expect(getCSSVar("--gap")).toBe("12px");
  });

  it("trims the value (browsers keep the whitespace that follows the colon)", () => {
    sheet(":root { --spaced:   12px   ; }");
    expect(getCSSVar("--spaced")).toBe("12px");
  });

  it("returns null when the property is not defined", () => {
    expect(getCSSVar("--missing")).toBeNull();
  });

  it("returns the fallback, of any type, when the property is not defined", () => {
    expect(getCSSVar("--missing", "red")).toBe("red");
    expect(getCSSVar("--missing", 16)).toBe(16);
    expect(getCSSVar("--missing", undefined)).toBeNull();
    const fallback = { size: 1 };
    expect(getCSSVar("--missing", fallback)).toBe(fallback);
  });

  it("treats an empty value as not defined", () => {
    document.documentElement.style.setProperty("--empty", "   ");
    expect(getCSSVar("--empty", "fallback")).toBe("fallback");
  });

  it("does not use the fallback when the property exists", () => {
    sheet(":root { --primary: blue; }");
    expect(getCSSVar("--primary", "red")).toBe("blue");
  });

  it("reads from <html>, so a property set only on <body> is not seen", () => {
    document.body.style.setProperty("--body-only", "1px");
    expect(getCSSVar("--body-only")).toBeNull();
  });

  it("types the result after the fallback", () => {
    expectTypeOf(getCSSVar("--x")).toEqualTypeOf<string | null>();
    expectTypeOf(getCSSVar("--x", 16)).toEqualTypeOf<string | number>();
    expectTypeOf(getCSSVar("--x", "red")).toEqualTypeOf<string>();
  });
});
