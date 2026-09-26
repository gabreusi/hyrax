import { describe, expect, expectTypeOf, it } from "vitest";
import { isNumeric, toBoolean, toNumber } from "./numeric";
import type { Numeric } from "./types";

describe("isNumeric", () => {
  it.each([42, 0, -1.5, 1e3, 12n, "42", "-1.5", "+7", "1e3", ".5", "5.", "0", "007"])(
    "accepts %s",
    (value) => {
      expect(isNumeric(value)).toBe(true);
    },
  );

  it.each([
    NaN,
    Infinity,
    -Infinity,
    "",
    " ",
    " 42",
    "42 ",
    "0x10",
    "Infinity",
    "NaN",
    "1e999",
    "1_000",
    "1,5",
    "12px",
    "abc",
    null,
    undefined,
    {},
    [],
    true,
    Symbol("s"),
  ])("rejects %s", (value) => {
    expect(isNumeric(value)).toBe(false);
  });

  it("narrows to Numeric", () => {
    const value = "12" as unknown;
    if (isNumeric(value)) expectTypeOf(value).toEqualTypeOf<Numeric>();
  });
});

describe("toNumber", () => {
  it("converts numeric values", () => {
    expect(toNumber("42")).toBe(42);
    expect(toNumber(7n)).toBe(7);
    expect(toNumber(3.5)).toBe(3.5);
    expect(toNumber("1e3")).toBe(1000);
  });

  it("falls back to 0 for anything else", () => {
    expect(toNumber("abc")).toBe(0);
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber(NaN)).toBe(0);
    expect(toNumber(Infinity)).toBe(0);
  });

  it("falls back when a bigint is too large for a finite number", () => {
    expect(toNumber(10n ** 400n)).toBe(0);
  });

  it("accepts a custom fallback", () => {
    expect(toNumber("abc", -1)).toBe(-1);
    expect(toNumber(null, NaN)).toBeNaN();
  });
});

describe("toBoolean", () => {
  it("passes booleans through", () => {
    expect(toBoolean(true)).toBe(true);
    expect(toBoolean(false, null)).toBe(false);
  });

  it("reads the usual words in any case, with whitespace", () => {
    for (const word of ["true", "YES", " on ", "1", "True"])
      expect(toBoolean(word, null)).toBe(true);
    for (const word of ["false", "No", "OFF\n", "0"]) expect(toBoolean(word, null)).toBe(false);
  });

  it("reads 1 and 0 as numbers and bigints", () => {
    expect(toBoolean(1, null)).toBe(true);
    expect(toBoolean(0, null)).toBe(false);
    expect(toBoolean(1n, null)).toBe(true);
    expect(toBoolean(0n, null)).toBe(false);
    expect(toBoolean(-0, null)).toBe(false);
  });

  it("returns the fallback for anything else", () => {
    for (const value of ["maybe", "", "2", 2, NaN, null, undefined, {}, [], "truthy"]) {
      expect(toBoolean(value)).toBe(false);
      expect(toBoolean(value, "x")).toBe("x");
    }
  });

  it("types the fallback into the result", () => {
    expectTypeOf(toBoolean("x")).toEqualTypeOf<boolean>();
    expectTypeOf(toBoolean("x", null)).toEqualTypeOf<boolean | null>();
  });
});
