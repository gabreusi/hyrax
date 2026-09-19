import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { scripted } from "./internal/scripted";
import { Random } from "./random";

const MAX_WORD = 0xffffffff;

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const deviation = (values: number[]) => {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
};
const draws = <T>(count: number, take: () => T) => Array.from({ length: count }, take);

describe("weighted", () => {
  it("picks in proportion to the weights", () => {
    const rng = new Random("loot");
    const counts = { common: 0, rare: 0, epic: 0 };
    for (let i = 0; i < 100_000; i++) {
      counts[rng.weighted(["common", "rare", "epic"] as const, [80, 15, 5])]++;
    }
    expect(counts.common).toBeGreaterThan(79_400);
    expect(counts.common).toBeLessThan(80_600);
    expect(counts.rare).toBeGreaterThan(14_400);
    expect(counts.rare).toBeLessThan(15_600);
    expect(counts.epic).toBeGreaterThan(4_400);
    expect(counts.epic).toBeLessThan(5_600);
  });

  it("accepts an object and returns its keys, typed", () => {
    const rng = new Random("table");
    const drop = rng.weighted({ common: 80, rare: 15, epic: 5 });
    expect(["common", "rare", "epic"]).toContain(drop);
    expectTypeOf(drop).toEqualTypeOf<"common" | "rare" | "epic">();
    expectTypeOf(rng.weighted([1, 2, 3], [1, 1, 1])).toEqualTypeOf<number>();
  });

  it("uses a strict < on the cumulative weights, so a boundary belongs to the next item", () => {
    // total 6, cumulative 1, 3, 6. A draw of exactly 0.5 lands on 3, which is the start of "c".
    expect(scripted([1 << 31, 0]).rng.weighted(["a", "b", "c"], [1, 2, 3])).toBe("c");
    expect(scripted([0, 0]).rng.weighted(["a", "b", "c"], [1, 2, 3])).toBe("a");
  });

  it("never picks an item with weight 0, at any draw and any luck", () => {
    const items = ["zero-first", "only", "zero-last"];
    for (const luck of [-1000, -1, 0, 1, 1000]) {
      for (const words of [
        [0, 0],
        [1 << 31, 0],
        [MAX_WORD, MAX_WORD],
      ]) {
        expect(scripted(words, luck).rng.weighted(items, [0, 1, 0])).toBe("only");
      }
    }
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_WORD }),
        fc.integer({ min: 0, max: MAX_WORD }),
        (a, b) => {
          expect(scripted([a, b], 3).rng.weighted(items, [0, 1, 0])).toBe("only");
        },
      ),
    );
  });

  it("slides toward the end of the list with positive luck", () => {
    const share = (luck: number) => {
      const rng = new Random({ seed: "luck", luck });
      return draws(20_000, () => rng.weighted(["first", "last"], [1, 1])).filter(
        (v) => v === "last",
      ).length;
    };
    expect(share(0)).toBeGreaterThan(9_600); // 50%
    expect(share(0)).toBeLessThan(10_400);
    expect(share(1)).toBeGreaterThan(14_600); // 75%
    expect(share(1)).toBeLessThan(15_400);
    expect(share(-1)).toBeGreaterThan(4_600); // 25%
    expect(share(-1)).toBeLessThan(5_400);
  });

  it("never picks an earlier item when luck goes up, for the same draw", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_WORD }),
        fc.integer({ min: 0, max: MAX_WORD }),
        fc.double({ min: -10, max: 10, noNaN: true }),
        fc.double({ min: 0.01, max: 10, noNaN: true }),
        (a, b, luck, extra) => {
          const items = [0, 1, 2, 3, 4];
          const weights = [3, 1, 4, 1, 5];
          const low = scripted([a, b], luck).rng.weighted(items, weights);
          const high = scripted([a, b], luck + extra).rng.weighted(items, weights);
          expect(high).toBeGreaterThanOrEqual(low);
        },
      ),
    );
  });

  it("consumes two words, whatever the luck", () => {
    for (const luck of [-3, 0, 3]) {
      const { rng, used } = scripted([1, 2, 3, 4], luck);
      rng.weighted(["a", "b"], [1, 1]);
      expect(used()).toBe(2);
    }
  });

  it("rejects tables it cannot use", () => {
    const rng = new Random("x");
    expect(() => rng.weighted(["a", "b"], [1])).toThrow("one weight per item");
    expect(() => rng.weighted(["a"], undefined as unknown as number[])).toThrow(RangeError);
    expect(() => rng.weighted([], [])).toThrow("at least one");
    expect(() => rng.weighted({})).toThrow("at least one");
    expect(() => rng.weighted(["a"], [-1])).toThrow("not negative");
    expect(() => rng.weighted(["a"], [NaN])).toThrow("finite");
    expect(() => rng.weighted(["a"], [Infinity])).toThrow("finite");
    expect(() => rng.weighted(["a", "b"], [0, 0])).toThrow("more than 0");
    expect(() => rng.weighted(["a", "b"], [1e308, 1e308])).toThrow("overflow");
  });
});

describe("sample", () => {
  it("returns the requested number of distinct positions, in random order", () => {
    const rng = new Random("sample");
    const picked = rng.sample([1, 2, 3, 4, 5, 6, 7, 8], 5);
    expect(picked).toHaveLength(5);
    expect(new Set(picked).size).toBe(5);
    for (const value of picked) expect([1, 2, 3, 4, 5, 6, 7, 8]).toContain(value);
  });

  it("samples positions, not values: duplicates in the input can come out together", () => {
    expect(new Random("dup").sample([7, 7, 9], 3).sort()).toEqual([7, 7, 9]);
  });

  it("leaves the input alone and handles 0 and all of it", () => {
    const input = [1, 2, 3];
    const rng = new Random("edge");
    expect(rng.sample(input, 0)).toEqual([]);
    expect(rng.sample(input, 3).sort()).toEqual([1, 2, 3]);
    expect(input).toEqual([1, 2, 3]);
  });

  it("reaches every ordered selection with about the same frequency", () => {
    const rng = new Random("uniform-sample");
    const counts = new Map<string, number>();
    for (let i = 0; i < 24_000; i++) {
      const key = rng.sample([1, 2, 3, 4], 2).join("");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(12);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(1_750);
      expect(count).toBeLessThan(2_250);
    }
  });

  it("is deterministic and ignores luck", () => {
    const words = Array.from({ length: 64 }, (_, i) => (i * 2654435761) >>> 0);
    expect(scripted(words, 6).rng.sample([1, 2, 3, 4, 5], 3)).toEqual(
      scripted(words, 0).rng.sample([1, 2, 3, 4, 5], 3),
    );
  });

  it("rejects a count that is not a whole number between 0 and the length", () => {
    const rng = new Random("x");
    expect(() => rng.sample([1, 2], 3)).toThrow(RangeError);
    expect(() => rng.sample([1, 2], -1)).toThrow(RangeError);
    expect(() => rng.sample([1, 2], 1.5)).toThrow(RangeError);
  });
});

describe("normal", () => {
  it("has the requested mean and deviation", () => {
    const rng = new Random("bell");
    const values = draws(50_000, () => rng.normal(100, 15));
    expect(mean(values)).toBeGreaterThan(99.6);
    expect(mean(values)).toBeLessThan(100.4);
    expect(deviation(values)).toBeGreaterThan(14.6);
    expect(deviation(values)).toBeLessThan(15.4);
  });

  it("defaults to a standard normal", () => {
    const values = draws(50_000, () => new Random("std").normal());
    expect(Number.isFinite(mean(values))).toBe(true);
    const rng = new Random("std2");
    const sample = draws(50_000, () => rng.normal());
    expect(Math.abs(mean(sample))).toBeLessThan(0.05);
    expect(deviation(sample)).toBeGreaterThan(0.97);
    expect(deviation(sample)).toBeLessThan(1.03);
  });

  it("returns the mean for a deviation of 0", () => {
    expect(new Random("x").normal(5, 0)).toBe(5);
  });

  it("is always finite, even for the extreme draws (it never takes log(0))", () => {
    for (const words of [
      [0, 0, 0, 0],
      [MAX_WORD, MAX_WORD, MAX_WORD, MAX_WORD],
    ]) {
      expect(Number.isFinite(scripted(words).rng.normal())).toBe(true);
    }
  });

  it("ignores luck and always consumes four words", () => {
    const { rng, used } = scripted([1, 2, 3, 4, 5, 6, 7, 8], 5);
    const value = rng.normal();
    expect(used()).toBe(4);
    expect(value).toBe(scripted([1, 2, 3, 4, 5, 6, 7, 8], 0).rng.normal());
  });

  it("rejects a negative or non-finite deviation and a non-finite mean", () => {
    const rng = new Random("x");
    expect(() => rng.normal(0, -1)).toThrow(RangeError);
    expect(() => rng.normal(0, NaN)).toThrow(RangeError);
    expect(() => rng.normal(0, Infinity)).toThrow(RangeError);
    expect(() => rng.normal(NaN, 1)).toThrow(RangeError);
  });

  // The algorithm (Box-Muller) is part of the contract: this value must not move on one engine.
  it("keeps its published output vector", () => {
    expect(new Random("hyrax").normal()).toBe(-0.5698265758970656);
  });
});

describe("exponential", () => {
  it("has a mean of 1 / rate", () => {
    const rng = new Random("wait");
    const values = draws(50_000, () => rng.exponential(2));
    expect(mean(values)).toBeGreaterThan(0.48);
    expect(mean(values)).toBeLessThan(0.52);
    expect(values.every((value) => value >= 0)).toBe(true);
  });

  it("defaults to a rate of 1", () => {
    const rng = new Random("rate");
    const values = draws(50_000, () => rng.exponential());
    expect(mean(values)).toBeGreaterThan(0.96);
    expect(mean(values)).toBeLessThan(1.04);
  });

  it("returns exactly +0 for the smallest draw, and stays finite for the largest", () => {
    expect(Object.is(scripted([0, 0]).rng.exponential(), 0)).toBe(true);
    expect(Number.isFinite(scripted([MAX_WORD, MAX_WORD]).rng.exponential())).toBe(true);
  });

  it("ignores luck and consumes two words", () => {
    const { rng, used } = scripted([1, 2], 4);
    rng.exponential();
    expect(used()).toBe(2);
  });

  it("rejects a rate that is not a positive finite number", () => {
    const rng = new Random("x");
    for (const bad of [0, -1, NaN, Infinity])
      expect(() => rng.exponential(bad)).toThrow(RangeError);
  });

  it("keeps its published output vector", () => {
    expect(new Random("hyrax").exponential(2)).toBe(0.14477710498585694);
  });
});

describe("roll", () => {
  it("rolls and adds the dice", () => {
    const rng = new Random("dice");
    const values = draws(20_000, () => rng.roll("2d6"));
    expect(Math.min(...values)).toBe(2);
    expect(Math.max(...values)).toBe(12);
    expect(mean(values)).toBeGreaterThan(6.9);
    expect(mean(values)).toBeLessThan(7.1);
  });

  it("adds constants and subtracts terms", () => {
    const rng = new Random("const");
    expect(rng.roll("5")).toBe(5);
    expect(rng.roll("d1+3")).toBe(4);
    expect(rng.roll("1d1-1")).toBe(0);
    expect(rng.roll("10-1d1")).toBe(9);
  });

  it("keeps the highest or lowest dice (4d6kh3 averages about 12.24)", () => {
    const rng = new Random("stats");
    const values = draws(50_000, () => rng.roll("4d6kh3"));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...values)).toBeLessThanOrEqual(18);
    expect(mean(values)).toBeGreaterThan(12.14);
    expect(mean(values)).toBeLessThan(12.34);
    const lowest = draws(20_000, () => rng.roll("2d20kl1"));
    expect(mean(lowest)).toBeGreaterThan(7.05); // the lower of two d20 averages 2870 / 400 = 7.175
    expect(mean(lowest)).toBeLessThan(7.3);
  });

  it("uses the luck of the generator on every die (luck 1 is advantage)", () => {
    const average = (luck: number) => {
      const rng = new Random({ seed: "d20", luck });
      return mean(draws(50_000, () => rng.roll("1d20")));
    };
    expect(average(0)).toBeGreaterThan(10.35); // 10.5
    expect(average(0)).toBeLessThan(10.65);
    expect(average(1)).toBeGreaterThan(13.7); // 13.83
    expect(average(1)).toBeLessThan(13.95);
    expect(average(-1)).toBeGreaterThan(7.05); // 7.17
    expect(average(-1)).toBeLessThan(7.3);
    expect(average(2)).toBeGreaterThan(15.4); // 15.5
    expect(average(2)).toBeLessThan(15.6);
  });

  it("never gives a lower total when luck goes up, for the same draws", () => {
    const words = Array.from({ length: 800 }, (_, i) => (i * 2654435761 + 12345) >>> 0);
    fc.assert(
      fc.property(
        fc.double({ min: -6, max: 6, noNaN: true }),
        fc.double({ min: 0.01, max: 6, noNaN: true }),
        (luck, extra) => {
          for (const notation of ["3d6+2", "4d6kh3", "2d20kl1", "1d100"]) {
            const low = scripted(words, luck).rng.roll(notation);
            const high = scripted(words, luck + extra).rng.roll(notation);
            expect(high).toBeGreaterThanOrEqual(low);
          }
        },
      ),
    );
  });

  it("is deterministic for a seed", () => {
    expect(new Random("r").roll("8d6+3")).toBe(new Random("r").roll("8d6+3"));
  });

  it("rejects notations it cannot read", () => {
    const rng = new Random("x");
    expect(() => rng.roll("nonsense")).toThrow(RangeError);
    expect(() => rng.roll("")).toThrow(RangeError);
    expect(() => rng.roll("2001d6")).toThrow("at most 1000 dice");
  });
});
