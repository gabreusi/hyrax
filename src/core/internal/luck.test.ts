import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_UNIT } from "./float";
import { lucky } from "./luck";

const unit = fc.double({ min: 0, max: MAX_UNIT, noNaN: true });

describe("lucky", () => {
  it("is the identity when luck is 0", () => {
    fc.assert(
      fc.property(unit, (u) => {
        expect(lucky(u, 0)).toBe(u);
      }),
    );
  });

  it("matches the closed forms (best of n+1, worst of n+1)", () => {
    expect(lucky(0.25, 1)).toBeCloseTo(Math.sqrt(0.25), 12);
    expect(lucky(0.25, 3)).toBeCloseTo(0.25 ** (1 / 4), 12);
    expect(lucky(0.75, -1)).toBeCloseTo(1 - Math.sqrt(0.25), 12);
  });

  it("pushes results up for positive luck and down for negative luck", () => {
    fc.assert(
      fc.property(unit, fc.double({ min: 0.001, max: 20, noNaN: true }), (u, luck) => {
        expect(lucky(u, luck)).toBeGreaterThanOrEqual(u);
        expect(lucky(u, -luck)).toBeLessThanOrEqual(u);
      }),
    );
  });

  it("never decreases when luck increases (up to one rounding step)", () => {
    fc.assert(
      fc.property(
        unit,
        fc.double({ min: -20, max: 20, noNaN: true }),
        fc.double({ min: 1e-6, max: 20, noNaN: true }),
        (u, luck, extra) => {
          expect(lucky(u, luck + extra)).toBeGreaterThanOrEqual(lucky(u, luck) - 2 ** -52);
        },
      ),
    );
  });

  it("stays inside [0, 1) even for extreme luck and the largest possible draw", () => {
    // Without the clamp, u ** (1 / (1 + luck)) rounds up to exactly 1 from luck 2 on.
    for (const luck of [2, 10, 1000, 1e9, Number.MAX_VALUE]) {
      expect(lucky(MAX_UNIT, luck)).toBeLessThan(1);
      expect(lucky(MAX_UNIT, luck)).toBeLessThanOrEqual(MAX_UNIT);
    }
    for (const luck of [-2, -10, -1000, -1e9]) {
      expect(lucky(0, luck)).toBe(0);
      expect(lucky(MAX_UNIT, luck)).toBeGreaterThanOrEqual(0);
    }
  });

  it("always returns a value in [0, MAX_UNIT]", () => {
    fc.assert(
      fc.property(unit, fc.double({ min: -1e6, max: 1e6, noNaN: true }), (u, luck) => {
        const value = lucky(u, luck);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(MAX_UNIT);
      }),
    );
  });
});
