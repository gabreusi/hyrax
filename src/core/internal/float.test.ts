import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_UNIT, nextDown } from "./float";

describe("MAX_UNIT", () => {
  it("is the largest double below 1", () => {
    expect(MAX_UNIT).toBe(1 - 2 ** -53);
    expect(MAX_UNIT).toBeLessThan(1);
    expect(nextDown(1)).toBe(MAX_UNIT);
  });
});

describe("nextDown", () => {
  it("returns the largest double strictly below a positive number", () => {
    expect(nextDown(1)).toBe(1 - 2 ** -53);
    expect(nextDown(2)).toBe(2 - 2 ** -52);
    expect(nextDown(5)).toBeLessThan(5);
    expect(nextDown(Number.MIN_VALUE)).toBe(0);
  });

  it("handles zero and negative numbers", () => {
    expect(nextDown(0)).toBe(-Number.MIN_VALUE);
    expect(nextDown(-1)).toBeLessThan(-1);
    expect(nextDown(-1)).toBe(-1 - 2 ** -52);
  });

  it("leaves no double in between", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (x) => {
        fc.pre(x > -Number.MAX_VALUE);
        const down = nextDown(x);
        expect(down).toBeLessThan(x);
        // The midpoint of two adjacent doubles rounds to one of them, never to a third.
        const midpoint = down / 2 + x / 2;
        expect(midpoint === down || midpoint === x).toBe(true);
      }),
    );
  });
});
