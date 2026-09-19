import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { Random, type RandomState } from "./random";

const take = (rng: Random, count: number) => Array.from({ length: count }, () => rng.next());

describe("fork", () => {
  it("is deterministic: the same seed and keys give the same child", () => {
    expect(take(new Random("world").fork("terrain", 3, 4), 5)).toEqual(
      take(new Random("world").fork("terrain", 3, 4), 5),
    );
  });

  it("does not depend on how much the parent was used, and does not consume it", () => {
    const busy = new Random("world");
    take(busy, 100);
    expect(take(busy.fork("chunk", 1), 5)).toEqual(take(new Random("world").fork("chunk", 1), 5));

    const forked = new Random("world");
    forked.fork("anything");
    expect(forked.next()).toBe(new Random("world").next());
  });

  it("gives different children for different keys", () => {
    const parent = new Random("world");
    const first = (rng: Random) => rng.next();
    const values = [
      first(parent.fork("a")),
      first(parent.fork("b")),
      first(parent.fork("a", 1)),
      first(parent.fork("a", 2)),
      first(parent.fork()),
    ];
    expect(new Set(values).size).toBe(values.length);
  });

  it("never confuses different key lists that would join to the same text", () => {
    const parent = new Random("world");
    expect(parent.fork("a/b").seed).not.toBe(parent.fork("a", "b").seed);
    expect(parent.fork("ab").seed).not.toBe(parent.fork("a", "b").seed);
    expect(parent.fork(1).seed).not.toBe(parent.fork("1").seed);
  });

  it("uses the JSON of the parent seed and the keys as the child seed, so it can be replayed", () => {
    const child = new Random("world").fork("terrain", 3, 4);
    expect(child.seed).toBe('["world","terrain",3,4]');
    expect(take(new Random(child.seed), 4)).toEqual(
      take(new Random("world").fork("terrain", 3, 4), 4),
    );
  });

  it("nests", () => {
    const deep = new Random("w").fork("a").fork("b");
    expect(deep.seed).toBe('["[\\"w\\",\\"a\\"]","b"]');
    expect(take(deep, 3)).toEqual(take(new Random("w").fork("a").fork("b"), 3));
  });

  it("inherits the luck of its parent", () => {
    expect(new Random({ seed: "w", luck: 2 }).fork("x").luck).toBe(2);
    expect(new Random("w").fork("x").luck).toBe(0);
  });

  it("rejects keys that JSON would turn into null", () => {
    const parent = new Random("w");
    expect(() => parent.fork(NaN)).toThrow(RangeError);
    expect(() => parent.fork(Infinity)).toThrow(RangeError);
  });

  // Changing how a child is derived is a breaking change: this value must never move.
  it("keeps its published output vector", () => {
    expect(new Random("hyrax").fork("terrain", 3, 4).next()).toBe(0.31158723663990495);
  });
});

describe("state and restore", () => {
  it("describes the generator as plain JSON", () => {
    const rng = new Random({ seed: "snap", luck: 1.5 });
    take(rng, 3);
    const state = rng.state();
    expect(state.version).toBe(1);
    expect(state.seed).toBe("snap");
    expect(state.luck).toBe(1.5);
    expect(state.engine).toHaveLength(4);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expectTypeOf(state).toEqualTypeOf<RandomState>();
  });

  it("resumes exactly where the snapshot was taken", () => {
    const rng = new Random("resume");
    take(rng, 17);
    const snapshot = rng.state();
    const expected = take(rng, 50);
    expect(take(Random.restore(snapshot), 50)).toEqual(expected);
  });

  it("survives a trip through JSON", () => {
    const rng = new Random("json");
    take(rng, 5);
    const restored = Random.restore(JSON.parse(JSON.stringify(rng.state())) as RandomState);
    expect(restored.next()).toBe(rng.next());
  });

  it("keeps the seed and the luck", () => {
    const restored = Random.restore(new Random({ seed: "keep", luck: -2 }).state());
    expect(restored.seed).toBe("keep");
    expect(restored.luck).toBe(-2);
  });

  it("gives an independent generator: drawing from one does not move the other", () => {
    const original = new Random("twins");
    const copy = Random.restore(original.state());
    take(copy, 10);
    expect(original.next()).toBe(new Random("twins").next());
  });

  it("works for an unseeded generator, whose seed was drawn", () => {
    const rng = new Random();
    take(rng, 4);
    expect(Random.restore(rng.state()).next()).toBe(rng.next());
  });

  it("resumes at any point (property)", () => {
    fc.assert(
      fc.property(fc.string(), fc.nat(40), fc.nat(40), (seed, before, after) => {
        const rng = new Random(seed);
        take(rng, before);
        const snapshot = rng.state();
        const expected = take(rng, after);
        expect(take(Random.restore(snapshot), after)).toEqual(expected);
      }),
    );
  });

  describe("validation", () => {
    const valid = () => new Random("v").state();

    it("rejects anything that is not a state object", () => {
      for (const bad of [null, undefined, 42, "state", []]) {
        expect(() => Random.restore(bad as unknown as RandomState)).toThrow(TypeError);
      }
    });

    it("rejects an unsupported version with a clear message", () => {
      expect(() => Random.restore({ ...valid(), version: 2 } as unknown as RandomState)).toThrow(
        "version",
      );
    });

    it("rejects a bad seed, luck or engine", () => {
      const state = valid();
      expect(() => Random.restore({ ...state, seed: 5 } as unknown as RandomState)).toThrow(
        TypeError,
      );
      expect(() => Random.restore({ ...state, luck: NaN })).toThrow(RangeError);
      const engines: unknown[] = [
        [1, 2, 3],
        [1, 2, 3, 4, 5],
        [1, 2, 3, -1],
        [1, 2, 3, 2 ** 32],
        [1, 2, 3, 1.5],
        [1, 2, 3, "4"],
        "1234",
        null,
      ];
      for (const engine of engines) {
        expect(() => Random.restore({ ...state, engine } as unknown as RandomState)).toThrow(
          TypeError,
        );
      }
    });
  });
});
