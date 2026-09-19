import { afterEach, describe, expect, it, vi } from "vitest";
import { createCryptoEngine, createSeed, createSeededEngine } from "./engines";

afterEach(() => {
  vi.unstubAllGlobals();
});

const take = (engine: { next32(): number }, count: number) =>
  Array.from({ length: count }, () => engine.next32());

describe("createSeededEngine", () => {
  it("produces the same words for the same seed", () => {
    expect(take(createSeededEngine("hyrax"), 50)).toEqual(take(createSeededEngine("hyrax"), 50));
  });

  it("produces different words for different seeds", () => {
    expect(take(createSeededEngine("a"), 5)).not.toEqual(take(createSeededEngine("b"), 5));
  });

  it("returns unsigned 32-bit integers", () => {
    for (const word of take(createSeededEngine("range"), 1000)) {
      expect(Number.isInteger(word)).toBe(true);
      expect(word).toBeGreaterThanOrEqual(0);
      expect(word).toBeLessThan(2 ** 32);
    }
  });

  // Changing the algorithm is a breaking change: these words must never move.
  it("keeps its published output vector", () => {
    expect(take(createSeededEngine("hyrax"), 4)).toEqual([
      1079766753, 1013694292, 1652203266, 1138678515,
    ]);
  });

  it("snapshots and restores its state", () => {
    const engine = createSeededEngine("snap");
    take(engine, 10);
    const snapshot = engine.snapshot();
    const expected = take(engine, 20);

    const other = createSeededEngine("something else entirely");
    other.restore(snapshot);
    expect(take(other, 20)).toEqual(expected);
  });

  it("snapshots unsigned 32-bit integers, so they survive JSON", () => {
    const engine = createSeededEngine("json");
    take(engine, 7);
    const snapshot = engine.snapshot();
    expect(snapshot).toHaveLength(4);
    for (const word of snapshot) {
      expect(Number.isInteger(word)).toBe(true);
      expect(word).toBeGreaterThanOrEqual(0);
      expect(word).toBeLessThan(2 ** 32);
    }
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});

describe("createCryptoEngine", () => {
  const script = (words: number[]) => {
    let at = 0;
    const getRandomValues = vi.fn((array: Uint32Array) => {
      for (let i = 0; i < array.length; i++) array[i] = words[at++ % words.length] as number;
      return array;
    });
    vi.stubGlobal("crypto", { getRandomValues });
    return getRandomValues;
  };

  it("serves the words crypto gives it, in order", () => {
    script([1, 2, 3, 4]);
    expect(take(createCryptoEngine(), 8)).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
  });

  it("asks crypto for a whole buffer at a time and refills when it runs out", () => {
    const getRandomValues = script([7]);
    const engine = createCryptoEngine();
    expect(getRandomValues).not.toHaveBeenCalled();
    take(engine, 256);
    expect(getRandomValues).toHaveBeenCalledTimes(1);
    take(engine, 1);
    expect(getRandomValues).toHaveBeenCalledTimes(2);
  });

  it("refuses to exist without crypto instead of falling back to Math.random", () => {
    vi.stubGlobal("crypto", undefined);
    expect(() => createCryptoEngine()).toThrow("crypto.getRandomValues");
  });

  it("fails loudly if crypto disappears before a refill", () => {
    script([1]);
    const engine = createCryptoEngine();
    take(engine, 256);
    vi.stubGlobal("crypto", undefined);
    expect(() => engine.next32()).toThrow("crypto.getRandomValues");
  });
});

describe("createSeed", () => {
  it("returns 32 hex characters drawn from crypto", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (array: Uint32Array) => array.fill(0xdeadbeef),
    });
    expect(createSeed()).toBe("deadbeef".repeat(4));
  });

  it("falls back to Math.random where crypto is missing", () => {
    vi.stubGlobal("crypto", undefined);
    expect(createSeed()).toMatch(/^[0-9a-f]{32}$/);
    expect(createSeed()).not.toBe(createSeed());
  });
});
