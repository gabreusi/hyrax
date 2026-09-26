import { describe, expect, expectTypeOf, it } from "vitest";
import { toArray } from "./array";

describe("toArray", () => {
  it("wraps a single value and keeps falsy ones", () => {
    expect(toArray("a")).toEqual(["a"]);
    expect(toArray(0)).toEqual([0]);
    expect(toArray("")).toEqual([""]);
    expect(toArray(false)).toEqual([false]);
  });

  it("gives an empty array for null and undefined", () => {
    expect(toArray(null)).toEqual([]);
    expect(toArray(undefined)).toEqual([]);
  });

  it("copies an array", () => {
    const list = ["a", "b"];
    const result = toArray(list);
    expect(result).toEqual(list);
    expect(result).not.toBe(list);
  });

  it("infers the item type", () => {
    expectTypeOf(toArray("a")).toEqualTypeOf<string[]>();
    expectTypeOf(toArray(["a", "b"])).toEqualTypeOf<string[]>();
    expectTypeOf(toArray([1, 2] as const)).toEqualTypeOf<(1 | 2)[]>();
    expectTypeOf(toArray<number>(null)).toEqualTypeOf<number[]>();
  });
});
