import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { clamp, lerp, ratio, remap } from "./number";

/** `===` semantics: +0 and -0 are the same number for these functions. */
const same = (x: number, y: number) => x === y;

describe("clamp", () => {
  it("returns the value when it is inside the bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("returns the nearest bound when the value is outside", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("compares numbers, not strings", () => {
    // The legacy implementation sorted the bounds as strings ("100" < "5").
    expect(clamp(50, 5, 100)).toBe(50);
    expect(clamp(500, 5, 100)).toBe(100);
    expect(clamp(1, 5, 100)).toBe(5);
  });

  it("swaps the bounds when min is greater than max", () => {
    expect(clamp(5, 10, 0)).toBe(5);
    expect(clamp(50, 100, 5)).toBe(50);
    expect(clamp(-3, 10, 0)).toBe(0);
  });

  it("caps at max when only two arguments are given", () => {
    expect(clamp(5, 10)).toBe(5);
    expect(clamp(15, 10)).toBe(10);
    expect(clamp(-1e9, 10)).toBe(-1e9);
  });

  it("supports infinite bounds", () => {
    expect(clamp(5, -Infinity, Infinity)).toBe(5);
    expect(clamp(Infinity, 0, 10)).toBe(10);
  });

  it("propagates NaN", () => {
    expect(clamp(NaN, 0, 10)).toBeNaN();
  });

  it("keeps the result inside the (ordered) bounds and is idempotent", () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true }),
        fc.double({ noNaN: true }),
        fc.double({ noNaN: true }),
        (value, a, b) => {
          const result = clamp(value, a, b);
          expect(result).toBeGreaterThanOrEqual(Math.min(a, b));
          expect(result).toBeLessThanOrEqual(Math.max(a, b));
          expect(same(clamp(result, a, b), result)).toBe(true);
        },
      ),
    );
  });

  it("accepts both the 3-argument and the 2-argument form", () => {
    expectTypeOf(clamp(1, 2, 3)).toEqualTypeOf<number>();
    expectTypeOf(clamp(1, 2)).toEqualTypeOf<number>();
  });
});

describe("lerp", () => {
  it("interpolates between two numbers", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });

  it("extrapolates outside 0..1 (no clamp)", () => {
    expect(lerp(0, 10, 2)).toBe(20);
    expect(lerp(0, 10, -1)).toBe(-10);
  });

  it("is exact at the endpoints", () => {
    const finite = fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e9, max: 1e9 });
    fc.assert(
      fc.property(finite, finite, (a, b) => {
        expect(same(lerp(a, b, 0), a)).toBe(true);
        expect(same(lerp(a, b, 1), b)).toBe(true);
      }),
    );
  });
});

describe("ratio", () => {
  it("defaults to the range 0..100", () => {
    expect(ratio(50)).toBe(0.5);
    expect(ratio(0)).toBe(0);
    expect(ratio(100)).toBe(1);
  });

  it("takes the upper bound as second argument", () => {
    expect(ratio(30, 60)).toBe(0.5);
  });

  it("takes the lower bound as third argument", () => {
    expect(ratio(75, 100, 50)).toBe(0.5);
  });

  it("does not clamp", () => {
    expect(ratio(150)).toBe(1.5);
    expect(ratio(-50)).toBe(-0.5);
  });

  it("returns 0 for an empty range", () => {
    expect(ratio(5, 10, 10)).toBe(0);
  });

  it("is usable as a multiplier that preserves proportions", () => {
    const scale = ratio(30, 60);
    expect(200 * scale).toBe(100);
  });
});

describe("remap", () => {
  it("maps a value from one range to another", () => {
    expect(remap(5, [0, 10], [0, 100])).toBe(50);
    expect(remap(0.5, [0, 1], [10, 20])).toBe(15);
  });

  it("supports reversed ranges", () => {
    expect(remap(5, [10, 0], [0, 100])).toBe(50);
    expect(remap(0, [0, 10], [100, 0])).toBe(100);
  });

  it("extrapolates outside the input range", () => {
    expect(remap(20, [0, 10], [0, 100])).toBe(200);
  });

  it("returns the start of the output range when the input range is empty", () => {
    expect(remap(3, [2, 2], [7, 100])).toBe(7);
  });

  it("maps the ends of the input range to the ends of the output range", () => {
    const finite = fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 });
    fc.assert(
      fc.property(finite, finite, finite, finite, (a, b, c, d) => {
        fc.pre(a !== b);
        expect(same(remap(a, [a, b], [c, d]), c)).toBe(true);
        expect(same(remap(b, [a, b], [c, d]), d)).toBe(true);
      }),
    );
  });
});
