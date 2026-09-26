import fc from "fast-check";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { MAX_UNIT, nextDown } from "./internal/float";
import { Random, random } from "./random";
import { scripted } from "./internal/scripted";

afterEach(() => {
  vi.unstubAllGlobals();
});

const draws = <T>(rng: Random, count: number, take: (rng: Random) => T) =>
  Array.from({ length: count }, () => take(rng));

const MAX_WORD = 0xffffffff;

describe("construction", () => {
  it("accepts a string seed, a numeric seed or an options object", () => {
    expect(new Random("42").seed).toBe("42");
    expect(new Random(42).seed).toBe("42");
    expect(new Random({ seed: "x" }).seed).toBe("x");
    expect(new Random(42).next()).toBe(new Random("42").next());
  });

  it("draws a different seed for every unseeded instance", () => {
    const seeds = new Set(Array.from({ length: 50 }, () => new Random().seed));
    expect(seeds.size).toBe(50);
    expect(new Random().seed).toMatch(/^[0-9a-f]{32}$/);
  });

  it("falls back to Math.random for the seed where crypto is missing", () => {
    vi.stubGlobal("crypto", undefined);
    expect(new Random().seed).toMatch(/^[0-9a-f]{32}$/);
  });

  it("has a luck of 0 unless told otherwise, and exposes it", () => {
    expect(new Random().luck).toBe(0);
    expect(new Random({ luck: 1.5 }).luck).toBe(1.5);
    expect(new Random({ seed: "x", luck: -2 }).luck).toBe(-2);
  });

  it("rejects a luck that is not a finite number", () => {
    expect(() => new Random({ luck: NaN })).toThrow(RangeError);
    expect(() => new Random({ luck: Infinity })).toThrow(RangeError);
    expect(() => new Random({ luck: -Infinity })).toThrow(RangeError);
  });

  it("exposes the shared unseeded instance", () => {
    expect(random).toBeInstanceOf(Random);
    const value = random.int(1, 6);
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(6);
  });
});

describe("determinism", () => {
  it("gives the same sequence for the same seed", () => {
    const take = (rng: Random) => [rng.float(), rng.int(1, 100), rng.boolean(), rng.id(6)];
    expect(draws(new Random("hyrax"), 20, take)).toEqual(draws(new Random("hyrax"), 20, take));
  });

  it("gives different sequences for different seeds", () => {
    const take = (rng: Random) => rng.float();
    expect(draws(new Random("a"), 5, take)).not.toEqual(draws(new Random("b"), 5, take));
  });

  // Changing the algorithm is a breaking change: these vectors must never move.
  it("keeps its published output vectors", () => {
    const rng = new Random("hyrax");
    expect(draws(rng, 3, (r) => r.next())).toEqual([
      0.2514027896226875, 0.38468355137943655, 0.17461975251297168,
    ]);
    expect(draws(rng, 8, (r) => r.int(1, 100))).toEqual([50, 89, 71, 33, 81, 61, 19, 14]);
    expect(rng.id(12)).toBe("b5DAawXlgahC");
    expect(rng.uuid()).toBe("78424a1c-1501-46d2-be3b-20b3c25b232f");
    expect(Array.from(rng.bytes(6))).toEqual([157, 134, 121, 164, 133, 187]);
  });
});

describe("next", () => {
  it("returns a float in [0, 1) built from two 32-bit words (53 bits)", () => {
    expect(scripted([0, 0]).rng.next()).toBe(0);
    expect(scripted([MAX_WORD, MAX_WORD]).rng.next()).toBe(MAX_UNIT);
    expect(scripted([1 << 31, 0]).rng.next()).toBe(0.5);
  });

  it("is never affected by luck", () => {
    const words = [123456789, 987654321];
    expect(scripted(words, 5).rng.next()).toBe(scripted(words, 0).rng.next());
    expect(scripted(words, -5).rng.next()).toBe(scripted(words, 0).rng.next());
  });
});

describe("float", () => {
  it("returns values in [min, max)", () => {
    fc.assert(
      fc.property(fc.string(), (seed) => {
        const rng = new Random(seed);
        for (let i = 0; i < 20; i++) {
          const value = rng.float(-5, 5);
          expect(value).toBeGreaterThanOrEqual(-5);
          expect(value).toBeLessThan(5);
        }
      }),
    );
  });

  it("defaults to [0, 1) and accepts reversed bounds", () => {
    const value = new Random("x").float();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
    const reversed = new Random("x").float(10, 0);
    expect(reversed).toBeGreaterThanOrEqual(0);
    expect(reversed).toBeLessThan(10);
  });

  it("returns min for an empty range", () => {
    expect(new Random("x").float(5, 5)).toBe(5);
  });

  it("never returns max, even when rounding would land on it", () => {
    // The largest draw times a tiny range rounds up to `max` at this magnitude.
    const { rng } = scripted([MAX_WORD, MAX_WORD]);
    expect(rng.float(1e9, 1e9 + 1)).toBe(nextDown(1e9 + 1));
    expect(scripted([MAX_WORD, MAX_WORD], 1000).rng.float(0, 1)).toBeLessThan(1);
  });

  it("rejects non-finite bounds", () => {
    expect(() => new Random("x").float(0, Infinity)).toThrow(RangeError);
    expect(() => new Random("x").float(NaN, 1)).toThrow(RangeError);
  });
});

describe("int", () => {
  it("starts the range at 0 with one argument, with the same draws as int(0, max)", () => {
    expect(draws(new Random("one"), 50, (r) => r.int(6))).toEqual(
      draws(new Random("one"), 50, (r) => r.int(0, 6)),
    );
    expect(draws(new Random("neg"), 50, (r) => r.int(-3))).toEqual(
      draws(new Random("neg"), 50, (r) => r.int(-3, 0)),
    );
    expect(new Random("zero").int(0)).toBe(0);
  });

  it("is inclusive on both ends", () => {
    const rng = new Random("ends");
    const seen = new Set(draws(rng, 500, (r) => r.int(1, 3)));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it("has zero bias: every accepted bit pattern maps to exactly one outcome", () => {
    // int(0, 5) keeps the top 3 bits of a word. Feed all 8 patterns: 0..5 must come out once each
    // and 6, 7 must be rejected (each accepted draw is followed by one fraction word).
    const words = [0, 1, 2, 3, 4, 5, 6, 7].flatMap((k) => (k < 6 ? [k << 29, 0] : [k << 29]));
    const { rng } = scripted(words);
    expect(Array.from({ length: 6 }, () => rng.int(0, 5))).toEqual([0, 1, 2, 3, 4, 5]);

    const rejecting = scripted([6 << 29, 7 << 29, 2 << 29, 0]);
    expect(rejecting.rng.int(0, 5)).toBe(2);
  });

  it("has zero bias for a span that is not a power of two, over all 1024 patterns", () => {
    const words = Array.from({ length: 1024 }, (_, x) =>
      x < 1000 ? [x << 22, 0] : [x << 22],
    ).flat();
    const { rng } = scripted(words);
    const out = Array.from({ length: 1000 }, () => rng.int(0, 999));
    expect(out).toEqual(Array.from({ length: 1000 }, (_, i) => i));
  });

  it("supports spans wider than 32 bits with the same guarantee", () => {
    // span = 2^40 + 1 needs a 9-bit high part: x = high * 2^32 + low, rejected when x >= span.
    const top = 2 ** 40;
    expect(scripted([256 << 23, 0, 0]).rng.int(0, top)).toBe(top);
    expect(scripted([256 << 23, 1, 3 << 23, 7, 0]).rng.int(0, top)).toBe(3 * 2 ** 32 + 7);
    expect(scripted([0, 5, 0]).rng.int(0, top)).toBe(5);
  });

  it("does not favour any value (no half-weight endpoints)", () => {
    const rng = new Random("uniform");
    const tally = new Array<number>(10).fill(0);
    for (let i = 0; i < 100_000; i++) {
      const value = rng.int(0, 9);
      tally[value] = (tally[value] ?? 0) + 1;
    }
    for (const count of tally) {
      expect(count).toBeGreaterThan(9_500);
      expect(count).toBeLessThan(10_500);
    }
  });

  it("stays inside the bounds for any draw and any luck", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: MAX_WORD }), { minLength: 64, maxLength: 64 }),
        fc.double({ min: -50, max: 50, noNaN: true }),
        fc.integer({ min: -1000, max: 1000 }),
        fc.nat(2000),
        (words, luck, min, span) => {
          const value = scripted(words, luck).rng.int(min, min + span);
          expect(value).toBeGreaterThanOrEqual(min);
          expect(value).toBeLessThanOrEqual(min + span);
          expect(Number.isInteger(value)).toBe(true);
        },
      ),
    );
  });

  it("stays inside the bounds for the largest possible draw at extreme luck", () => {
    // int(1, 20) keeps the top 5 bits: 19 << 27 selects the last index, and the largest fraction follows.
    const topIndex = (19 << 27) | 0x7ffffff;
    for (const luck of [2, 10, 1000, 1e9]) {
      expect(scripted([topIndex, MAX_WORD], luck).rng.int(1, 20)).toBe(20);
    }
    for (const luck of [-2, -10, -1000, -1e9]) {
      expect(scripted([0, 0], luck).rng.int(1, 20)).toBe(1);
    }
  });

  it("rounds fractional bounds inward and accepts reversed bounds", () => {
    const rng = new Random("inward");
    expect(new Set(draws(rng, 200, (r) => r.int(1.2, 2.8)))).toEqual(new Set([2]));
    const value = new Random("x").int(5, 1);
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(5);
  });

  it("returns the only value of a one-value range", () => {
    expect(new Random("x").int(7, 7)).toBe(7);
  });

  it("throws when there is no integer in the range, or it is not finite or too wide", () => {
    expect(() => new Random("x").int(1.2, 1.8)).toThrow(RangeError);
    expect(() => new Random("x").int(NaN, 3)).toThrow(RangeError);
    expect(() => new Random("x").int(0, Infinity)).toThrow(RangeError);
    expect(() => new Random("x").int(-(2 ** 53), 2 ** 53)).toThrow("too wide");
  });

  it("consumes the same number of words whatever the luck", () => {
    const words = Array.from({ length: 400 }, (_, i) => (i * 2654435761) >>> 0);
    const calls = (luck: number) => {
      const { rng, used } = scripted(words, luck);
      for (let i = 0; i < 20; i++) rng.int(1, 6);
      return used();
    };
    expect(calls(-3)).toBe(calls(0));
    expect(calls(0)).toBe(calls(4));
  });
});

describe("boolean", () => {
  it("never returns true at chance 0 and always at chance 1, even for the extreme draws", () => {
    for (const words of [
      [0, 0],
      [MAX_WORD, MAX_WORD],
    ]) {
      for (const luck of [-5, 0, 5]) {
        expect(scripted(words, luck).rng.boolean(0)).toBe(false);
        expect(scripted(words, luck).rng.boolean(1)).toBe(true);
      }
    }
  });

  it("is roughly balanced at the default chance", () => {
    const rng = new Random("balance");
    const trues = draws(rng, 10_000, (r) => r.boolean()).filter(Boolean).length;
    expect(trues).toBeGreaterThan(4_700);
    expect(trues).toBeLessThan(5_300);
  });

  it("rejects chances outside 0..1 (so boolean(50) cannot silently mean always)", () => {
    expect(() => new Random("x").boolean(50)).toThrow(RangeError);
    expect(() => new Random("x").boolean(-0.1)).toThrow(RangeError);
    expect(() => new Random("x").boolean(NaN)).toThrow(RangeError);
  });
});

describe("from", () => {
  it("picks an element of an array", () => {
    const list = ["a", "b", "c"];
    const rng = new Random("from");
    for (let i = 0; i < 50; i++) expect(list).toContain(rng.from(list));
  });

  it("picks a code point of a string", () => {
    const rng = new Random("str");
    expect(new Set(draws(rng, 200, (r) => r.from("😀ab")))).toEqual(new Set(["😀", "a", "b"]));
  });

  it("picks a value of an object", () => {
    const rng = new Random("obj");
    expect(new Set(draws(rng, 200, (r) => r.from({ x: 1, y: 2 })))).toEqual(new Set([1, 2]));
  });

  it("returns undefined for an empty source, without touching the generator", () => {
    const { rng, used } = scripted([1, 2, 3]);
    expect(rng.from([])).toBeUndefined();
    expect(rng.from("")).toBeUndefined();
    expect(rng.from({})).toBeUndefined();
    expect(used()).toBe(0);
  });

  it("ignores luck", () => {
    const words = [1 << 31, 5, 9, 3];
    expect(scripted(words, 9).rng.from([1, 2, 3, 4])).toBe(
      scripted(words, 0).rng.from([1, 2, 3, 4]),
    );
  });

  it("types the result after the source", () => {
    const rng = new Random("types");
    expectTypeOf(rng.from([1, 2, 3])).toEqualTypeOf<number | undefined>();
    expectTypeOf(rng.from("abc")).toEqualTypeOf<string | undefined>();
    expectTypeOf(rng.from({ a: true })).toEqualTypeOf<boolean | undefined>();
  });
});

describe("pop", () => {
  it("removes and returns a random element", () => {
    const list = [1, 2, 3, 4];
    const popped = new Random("pop").pop(list);
    expect(list).toHaveLength(3);
    expect(list).not.toContain(popped);
  });

  it("removes the drawn position, even when values repeat", () => {
    const list = [7, 7, 7];
    new Random("dup").pop(list);
    expect(list).toEqual([7, 7]);
  });

  it("empties an array one element at a time", () => {
    const list = [1, 2, 3];
    const rng = new Random("all");
    const out = [rng.pop(list), rng.pop(list), rng.pop(list)];
    expect(out.sort()).toEqual([1, 2, 3]);
    expect(list).toEqual([]);
  });

  it("returns undefined for an empty array", () => {
    expect(new Random("x").pop([])).toBeUndefined();
  });
});

describe("shuffle", () => {
  it("returns a permutation without touching the input", () => {
    fc.assert(
      fc.property(fc.string(), fc.array(fc.integer(), { maxLength: 30 }), (seed, input) => {
        const copy = [...input];
        const out = new Random(seed).shuffle(input);
        expect(input).toEqual(copy);
        expect([...out].sort((a, b) => a - b)).toEqual([...input].sort((a, b) => a - b));
      }),
    );
  });

  it("is deterministic for a seed and actually reorders", () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    expect(new Random("s").shuffle(input)).toEqual(new Random("s").shuffle(input));
    expect(new Random("mix").shuffle(input)).not.toEqual(input);
  });

  it("reaches every permutation with about the same frequency", () => {
    const rng = new Random("perms");
    const counts = new Map<string, number>();
    for (let i = 0; i < 6_000; i++) {
      const key = rng.shuffle([1, 2, 3]).join("");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(850);
      expect(count).toBeLessThan(1_150);
    }
  });
});

describe("date", () => {
  it("returns a date between the bounds, inclusive", () => {
    const rng = new Random("date");
    const from = new Date("2020-01-01").getTime();
    const to = new Date("2020-12-31").getTime();
    for (let i = 0; i < 100; i++) {
      const time = rng.date("2020-01-01", "2020-12-31").getTime();
      expect(time).toBeGreaterThanOrEqual(from);
      expect(time).toBeLessThanOrEqual(to);
    }
  });

  it("accepts numbers and Date objects, in either order", () => {
    const rng = new Random("kinds");
    const date = rng.date(2000, new Date(1000));
    expect(date.getTime()).toBeGreaterThanOrEqual(1000);
    expect(date.getTime()).toBeLessThanOrEqual(2000);
  });

  it("covers spans far longer than 2^32 milliseconds without gaps", () => {
    const rng = new Random("wide");
    const times = draws(rng, 200, (r) => r.date(0, "2100-01-01").getTime());
    expect(times.some((t) => t % 2 !== 0)).toBe(true);
  });

  it("defaults to the range from the epoch to now", () => {
    const time = new Random("default").date().getTime();
    expect(time).toBeGreaterThanOrEqual(0);
    expect(time).toBeLessThanOrEqual(Date.now());
  });

  it("ignores luck", () => {
    const words = [1 << 31, 5, 9, 3];
    expect(scripted(words, 9).rng.date(0, 1000).getTime()).toBe(
      scripted(words, 0).rng.date(0, 1000).getTime(),
    );
  });

  it("rejects invalid or absurdly wide bounds", () => {
    expect(() => new Random("x").date("not a date")).toThrow(RangeError);
    expect(() => new Random("x").date(0, NaN)).toThrow(RangeError);
    expect(() => new Random("x").date(-8.64e15, 8.64e15)).toThrow("too wide");
  });
});

describe("id", () => {
  it("has the requested length and the default alphanumeric alphabet", () => {
    const rng = new Random("id");
    expect(rng.id()).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(rng.id(25)).toMatch(/^[A-Za-z0-9]{25}$/);
    expect(rng.id(0)).toBe("");
  });

  it("includes the digit 0 and every character of the alphabet", () => {
    const ids = new Random("zero").id(5_000);
    expect(ids).toContain("0");
    expect(new Set(ids).size).toBe(62);
  });

  it("supports a custom alphabet, including non-BMP code points", () => {
    const rng = new Random("alphabet");
    expect(rng.id(200, "ab")).toMatch(/^[ab]{200}$/);
    expect(Array.from(rng.id(50, "😀😁"))).toHaveLength(50);
  });

  it("rejects bad lengths and an empty alphabet", () => {
    const rng = new Random("x");
    expect(() => rng.id(-1)).toThrow(RangeError);
    expect(() => rng.id(1.5)).toThrow(RangeError);
    expect(() => rng.id(5, "")).toThrow(RangeError);
  });
});

describe("uuid", () => {
  it("is a valid version 4 UUID with the RFC 4122 variant", () => {
    const rng = new Random("uuid");
    for (let i = 0; i < 100; i++) {
      expect(rng.uuid()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });

  it("lays the four words out big-endian, forcing the version and variant bits", () => {
    const { rng } = scripted([0x01234567, 0x89abcdef, 0xffffffff, 0x00000000]);
    expect(rng.uuid()).toBe("01234567-89ab-4def-bfff-ffff00000000");
  });

  it("is deterministic for a seed and unique across draws", () => {
    expect(new Random("u").uuid()).toBe(new Random("u").uuid());
    const rng = new Random("many");
    expect(new Set(draws(rng, 2_000, (r) => r.uuid())).size).toBe(2_000);
  });
});

describe("bytes", () => {
  it("takes 4 bytes per word, big-endian, and consumes only the words it needs", () => {
    const { rng, used } = scripted([0x01020304, 0x05060708]);
    expect(Array.from(rng.bytes(5))).toEqual([1, 2, 3, 4, 5]);
    expect(used()).toBe(2);
    expect(Array.from(scripted([0x01020304]).rng.bytes(3))).toEqual([1, 2, 3]);
  });

  it("returns an empty array for 0 and rejects bad counts", () => {
    expect(new Random("x").bytes(0)).toEqual(new Uint8Array(0));
    expect(() => new Random("x").bytes(-1)).toThrow(RangeError);
    expect(() => new Random("x").bytes(1.5)).toThrow(RangeError);
  });

  it("ignores luck", () => {
    const words = [0x01020304];
    expect(scripted(words, 8).rng.bytes(4)).toEqual(scripted(words, 0).rng.bytes(4));
  });
});

describe("sign", () => {
  it("gives 1 or -1, from one boolean draw", () => {
    const signs = draws(new Random("sign"), 200, (r) => r.sign());
    expect(new Set(signs)).toEqual(new Set([1, -1]));
    expect(draws(new Random("sign"), 50, (r) => r.sign())).toEqual(
      draws(new Random("sign"), 50, (r) => (r.boolean() ? 1 : -1)),
    );
  });
});
