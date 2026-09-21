import { describe, expect, it } from "vitest";
import { resolveVars } from "./vars";

const vars = (table: Record<string, string>) => (name: string) => table[name];

describe("resolveVars", () => {
  it("leaves a value without var() untouched", () => {
    expect(resolveVars("10px", vars({}))).toBe("10px");
    expect(resolveVars("calc(1px + 2px)", vars({}))).toBe("calc(1px + 2px)");
  });

  it("substitutes a custom property", () => {
    expect(resolveVars("var(--gap)", vars({ "--gap": "12px" }))).toBe("12px");
  });

  it("substitutes inside another expression, and more than once", () => {
    const read = vars({ "--gap": "12px", "--half": "6px" });
    expect(resolveVars("calc(var(--gap) * 2)", read)).toBe("calc(12px * 2)");
    expect(resolveVars("calc(var(--gap) + var(--half))", read)).toBe("calc(12px + 6px)");
  });

  it("tolerates whitespace inside var()", () => {
    expect(resolveVars("var(  --gap  )", vars({ "--gap": "12px" }))).toBe("12px");
    expect(resolveVars("var( --gap , 5px )", vars({}))).toBe("5px");
  });

  it("uses the fallback when the property is missing or empty", () => {
    expect(resolveVars("var(--nope, 5px)", vars({}))).toBe("5px");
    expect(resolveVars("var(--empty, 5px)", vars({ "--empty": "" }))).toBe("5px");
  });

  it("ignores the fallback when the property exists", () => {
    expect(resolveVars("var(--gap, 5px)", vars({ "--gap": "12px" }))).toBe("12px");
  });

  it("resolves a fallback that is itself a var(), or that contains commas", () => {
    expect(resolveVars("var(--a, var(--b))", vars({ "--b": "7px" }))).toBe("7px");
    expect(resolveVars("var(--a, var(--b, 3px))", vars({}))).toBe("3px");
    expect(resolveVars("var(--a, min(1px, 2px))", vars({}))).toBe("min(1px, 2px)");
  });

  it("resolves a value that itself contains var()", () => {
    expect(resolveVars("var(--a)", vars({ "--a": "var(--b)", "--b": "9px" }))).toBe("9px");
  });

  it("returns null when a property is missing and there is no fallback", () => {
    expect(resolveVars("var(--nope)", vars({}))).toBeNull();
    expect(resolveVars("calc(var(--nope) * 2)", vars({}))).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(resolveVars("var(--gap", vars({ "--gap": "1px" }))).toBeNull();
    expect(resolveVars("var()", vars({}))).toBeNull();
    expect(resolveVars("var(gap)", vars({ gap: "1px" }))).toBeNull();
    expect(resolveVars("var(min(1px, 2px))", vars({}))).toBeNull();
  });

  it("gives up on cycles instead of looping", () => {
    expect(resolveVars("var(--a)", vars({ "--a": "var(--a)" }))).toBeNull();
    expect(resolveVars("var(--a)", vars({ "--a": "var(--b)", "--b": "var(--a)" }))).toBeNull();
  });
});
