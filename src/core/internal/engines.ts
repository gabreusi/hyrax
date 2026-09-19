import { host } from "./host";

/** A source of unsigned 32-bit words. */
export interface Engine {
  next32(): number;
}

/** The four 32-bit words of sfc32 state. */
export type EngineState = readonly [number, number, number, number];

/** An engine whose state can be saved and restored. */
export interface SeededEngine extends Engine {
  snapshot(): [number, number, number, number];
  restore(state: EngineState): void;
}

/** cyrb128: hashes a string into four 32-bit words (public domain, by bryc). */
function cyrb128(text: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/**
 * sfc32 seeded through cyrb128, with 12 outputs discarded. Fast and statistically strong, but
 * **not cryptographic**: its state can be recovered from its output.
 *
 * @param seed - Any string.
 * @returns A deterministic engine.
 */
export function createSeededEngine(seed: string): SeededEngine {
  let [a, b, c, d] = cyrb128(seed);
  const next32 = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
  for (let i = 0; i < 12; i++) next32();
  return {
    next32,
    snapshot: () => [a >>> 0, b >>> 0, c >>> 0, d >>> 0],
    restore: (state) => {
      [a, b, c, d] = [state[0] | 0, state[1] | 0, state[2] | 0, state[3] | 0];
    },
  };
}

const POOL_SIZE = 256;

/**
 * Serves words from `crypto.getRandomValues`, 256 at a time (one call per word is about 70 times
 * slower). It never falls back to `Math.random`.
 *
 * @returns A cryptographically secure engine.
 * @throws {Error} When the runtime has no `crypto.getRandomValues`, now or at a later refill.
 */
export function createCryptoEngine(): Engine {
  const missing = () =>
    new Error("Random.secure() needs crypto.getRandomValues, which this runtime does not provide.");
  if (!host().crypto?.getRandomValues) throw missing();

  const pool = new Uint32Array(POOL_SIZE);
  let index = POOL_SIZE;
  return {
    next32: () => {
      if (index === POOL_SIZE) {
        const crypto = host().crypto;
        if (!crypto?.getRandomValues) throw missing();
        crypto.getRandomValues(pool);
        index = 0;
      }
      return pool[index++] as number;
    },
  };
}

/**
 * A fresh 128-bit seed as 32 hex characters, from `crypto` (or `Math.random` where it is missing).
 * Only used to seed the reproducible engine, so it makes no security promise.
 *
 * @returns The seed.
 */
export function createSeed(): string {
  const words = new Uint32Array(4);
  const crypto = host().crypto;
  if (crypto?.getRandomValues) {
    crypto.getRandomValues(words);
  } else {
    for (let i = 0; i < words.length; i++) words[i] = Math.floor(Math.random() * 4294967296);
  }
  return Array.from(words, (word) => word.toString(16).padStart(8, "0")).join("");
}
