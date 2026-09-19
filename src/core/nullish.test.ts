import { describe, expect, expectTypeOf, it } from "vitest";
import { coalesce } from "./nullish";

describe("coalesce", () => {
  it("returns the first value that is not null or undefined", () => {
    expect(coalesce(null, undefined, "a", "b")).toBe("a");
  });

  it("treats falsy values as valid", () => {
    expect(coalesce(null, 0, 1)).toBe(0);
    expect(coalesce(undefined, "", "x")).toBe("");
    expect(coalesce(null, false, true)).toBe(false);
    expect(coalesce(undefined, NaN, 1)).toBeNaN();
  });

  it("returns null when every value is null or undefined", () => {
    expect(coalesce(null, undefined)).toBeNull();
    expect(coalesce()).toBeNull();
  });

  it("removes null and undefined from the return type, adding back null", () => {
    const value = coalesce(null as string | null, undefined as number | undefined);
    expectTypeOf(value).toEqualTypeOf<string | number | null>();
  });
});
