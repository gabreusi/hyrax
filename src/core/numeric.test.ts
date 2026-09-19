import { describe, expect, expectTypeOf, it } from "vitest";
import { isNumeric, toNumber } from "./numeric";
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
