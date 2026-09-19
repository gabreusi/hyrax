import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { scripted } from "./internal/scripted";
import { Random } from "./random";
import { SecureRandom } from "./secure-random";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Makes `crypto.getRandomValues` fill the buffer with these words, in order, cycling. */
const stubCrypto = (words: readonly number[]) => {
  let at = 0;
  const getRandomValues = vi.fn((array: Uint32Array) => {
    for (let i = 0; i < array.length; i++) array[i] = words[at++ % words.length] as number;
    return array;
  });
  vi.stubGlobal("crypto", { getRandomValues });
  return getRandomValues;
};

const MAX_WORD = 0xffffffff;

describe("Random.secure", () => {
  it("creates a SecureRandom", () => {
    stubCrypto([1]);
    const secure = Random.secure();
    expect(secure).toBeInstanceOf(SecureRandom);
    expectTypeOf(secure).toEqualTypeOf<SecureRandom>();
  });

  it("has no seed and no state: a secure generator cannot be replayed", () => {
    stubCrypto([1]);
    const secure = Random.secure();
    expect("seed" in secure).toBe(false);
    expect("state" in secure).toBe(false);
    expectTypeOf(secure).not.toHaveProperty("seed");
    expectTypeOf(secure).not.toHaveProperty("state");
  });

  it("takes a luck, like the seeded generator", () => {
    stubCrypto([1]);
    expect(Random.secure().luck).toBe(0);
    expect(Random.secure({ luck: 2 }).luck).toBe(2);
    expect(() => Random.secure({ luck: NaN })).toThrow(RangeError);
  });

  it("refuses to exist without crypto instead of falling back to Math.random", () => {
    vi.stubGlobal("crypto", undefined);
    expect(() => Random.secure()).toThrow("crypto.getRandomValues");
  });
});

describe("SecureRandom", () => {
  it("draws every method from crypto: same words, same results as a scripted generator", () => {
    const words = Array.from({ length: 512 }, (_, i) => (i * 2246822519 + 3266489917) >>> 0);
    stubCrypto(words);
    const secure = Random.secure();
    const { rng } = scripted(words);
    expect(secure.next()).toBe(rng.next());
    expect(secure.int(1, 6)).toBe(rng.int(1, 6));
    expect(secure.boolean(0.3)).toBe(rng.boolean(0.3));
    expect(secure.float(-5, 5)).toBe(rng.float(-5, 5));
    expect(secure.from([1, 2, 3, 4, 5])).toBe(rng.from([1, 2, 3, 4, 5]));
    expect(secure.shuffle([1, 2, 3, 4, 5, 6])).toEqual(rng.shuffle([1, 2, 3, 4, 5, 6]));
    expect(secure.id(8)).toBe(rng.id(8));
    expect(secure.uuid()).toBe(rng.uuid());
    expect(secure.bytes(9)).toEqual(rng.bytes(9));
  });

  it("keeps working past the 256-word buffer", () => {
    const getRandomValues = stubCrypto([123456789, 987654321, 555555555]);
    const secure = Random.secure();
    for (let i = 0; i < 1000; i++) secure.int(1, 6);
    expect(getRandomValues.mock.calls.length).toBeGreaterThan(1);
  });

  it("shuffles lists longer than 34 elements (the seeded engine's limit)", () => {
    stubCrypto(Array.from({ length: 256 }, (_, i) => (i * 40503) >>> 0));
    const list = Array.from({ length: 200 }, (_, i) => i);
    const shuffled = Random.secure().shuffle(list);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(list);
  });

  it("stays inside its ranges for the largest possible draw at any luck", () => {
    stubCrypto([(19 << 27) | 0x7ffffff, MAX_WORD]);
    for (const luck of [0, 2, 1000]) {
      const secure = Random.secure({ luck });
      expect(secure.int(1, 20)).toBeLessThanOrEqual(20);
    }
    stubCrypto([MAX_WORD]);
    expect(Random.secure({ luck: 1000 }).float(0, 1)).toBeLessThan(1);
  });

  it("forks into another secure generator that keeps the luck", () => {
    stubCrypto([1, 2, 3]);
    const child = Random.secure({ luck: 3 }).fork();
    expect(child).toBeInstanceOf(SecureRandom);
    expect(child.luck).toBe(3);
  });

  it("forks without keys: there is no seed to derive a child from", () => {
    expectTypeOf<SecureRandom["fork"]>().parameters.toEqualTypeOf<[]>();
  });
});

describe("token", () => {
  it("is base64url with no padding: 32 bytes give 43 characters", () => {
    stubCrypto([0x12345678, 0x9abcdef0, 0x0fedcba9, 0x87654321]);
    const token = Random.secure().token();
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("encodes the bytes it draws, using - and _ instead of + and /", () => {
    stubCrypto([0xfbffbf00]);
    expect(Random.secure().token(3)).toBe("-_-_");
  });

  it("handles lengths that are not a multiple of 3", () => {
    stubCrypto([0xffffffff]);
    expect(Random.secure().token(0)).toBe("");
    expect(Random.secure().token(1)).toHaveLength(2);
    expect(Random.secure().token(2)).toHaveLength(3);
    expect(Random.secure().token(4)).toHaveLength(6);
  });

  it("rejects bad lengths", () => {
    stubCrypto([1]);
    expect(() => Random.secure().token(-1)).toThrow(RangeError);
    expect(() => Random.secure().token(1.5)).toThrow(RangeError);
  });

  it("does not exist on the seeded generator: a reproducible token would be a trap", () => {
    expect((new Random("x") as unknown as { token?: unknown }).token).toBeUndefined();
    expectTypeOf<Random>().not.toHaveProperty("token");
  });
});
