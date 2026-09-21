import { createSeed, createSeededEngine, type SeededEngine } from "./internal/engines";
import { RandomBase } from "./random-base";
import { SecureRandom } from "./secure-random";

/** Options for {@link Random}. */
export interface RandomOptions {
  /** Any string or number. A number is used as its string form. Without one, a seed is drawn. */
  seed?: string | number;
  /** How much the outcome methods favour good results: `0` is neutral, negative is unlucky. */
  luck?: number;
}

/** A snapshot of a {@link Random}: plain JSON, restorable with {@link Random.restore}. */
export interface RandomState {
  /** The format version. Always `1` for now. */
  version: 1;
  /** The seed of the generator. */
  seed: string;
  /** The luck of the generator. */
  luck: number;
  /** The four 32-bit words of engine state. */
  engine: [number, number, number, number];
}

/**
 * A seedable pseudo-random number generator. The same seed and the same sequence of calls always
 * give the same results, which makes it good for tests, fixtures and reproducible simulations.
 *
 * It is **not cryptographically secure**: its output can be used to predict what comes next. For
 * tokens and secrets use {@link SecureRandom}. The algorithm (sfc32 seeded through cyrb128) is part
 * of the public contract: changing what a seed produces is a breaking change.
 *
 * @example
 * ```ts
 * const rng = new Random("fixture-42");
 * rng.int(1, 6); // the same die roll every time
 * rng.from(["a", "b", "c"]);
 * rng.shuffle([1, 2, 3, 4]);
 * ```
 */
export class Random extends RandomBase {
  /** The seed this generator was created with. `new Random(seed)` replays it from the start. */
  readonly seed: string;

  readonly #engine: SeededEngine;

  /**
   * Creates a generator.
   *
   * @param options - A seed (string or number), or `{ seed, luck }`. Without a seed, one is drawn
   *   from `crypto` (or `Math.random` where `crypto` is missing) and exposed as {@link Random.seed}.
   * @throws {RangeError} When `luck` is not a finite number.
   */
  constructor(options: string | number | RandomOptions = {}) {
    const { seed, luck = 0 } =
      typeof options === "object" ? options : { seed: options, luck: undefined };
    const resolved = seed === undefined ? createSeed() : String(seed);
    const engine = createSeededEngine(resolved);
    super(engine, luck);
    this.seed = resolved;
    this.#engine = engine;
  }

  /**
   * A generator backed by `crypto.getRandomValues`, for tokens and anything that must be
   * unpredictable. It has the same methods, no seed and no `state`, and cannot be replayed.
   *
   * @example
   * ```ts
   * const secure = Random.secure();
   * secure.token(); // 32 random bytes as base64url
   * ```
   *
   * @param options - `luck` bends the outcome methods, as it does for a seeded generator.
   * @returns The secure generator.
   * @throws {Error} When the runtime has no `crypto.getRandomValues`.
   */
  static secure(options: { luck?: number } = {}): SecureRandom {
    return new SecureRandom(options);
  }

  /**
   * A new generator that is independent of this one and always the same for the same parent seed
   * and keys. It does **not** consume this generator, and does not depend on how much it has been
   * used: forking `("chunk", 3, 4)` before or after `("chunk", 0, 0)` gives the same stream. Use it
   * to give every part of a procedural world, or every test, its own reproducible randomness.
   *
   * The child's seed is the JSON of `[parentSeed, ...keys]`, so `fork("a/b")` never collides with
   * `fork("a", "b")`, and `new Random(child.seed)` replays the child. It inherits the luck.
   *
   * @example
   * ```ts
   * const world = new Random("world-7");
   * world.fork("terrain", 3, 4).int(0, 255); // the same value every time
   * ```
   *
   * @param keys - Strings and finite numbers that name the stream.
   * @returns The child generator.
   * @throws {RangeError} When a key is a number that is not finite (JSON would turn it into `null`).
   */
  fork(...keys: (string | number)[]): Random {
    for (const key of keys) {
      if (typeof key === "number" && !Number.isFinite(key)) {
        throw new RangeError(`fork() keys must be strings or finite numbers, got ${key}.`);
      }
    }
    return new Random({ seed: JSON.stringify([this.seed, ...keys]), luck: this.luck });
  }

  /**
   * A snapshot of where this generator is, as plain JSON. {@link Random.restore} continues from
   * exactly this point: save a game, replay a bug.
   *
   * @example
   * ```ts
   * const rng = new Random("save-slot");
   * const saved = JSON.stringify(rng.state());
   * Random.restore(JSON.parse(saved)).next() === rng.next(); // => true
   * ```
   *
   * @returns The state.
   */
  state(): RandomState {
    return { version: 1, seed: this.seed, luck: this.luck, engine: this.#engine.snapshot() };
  }

  /**
   * Rebuilds a generator from {@link Random.state}. The result is independent of the original.
   *
   * @example
   * ```ts
   * const rng = new Random("save-slot");
   * const copy = Random.restore(rng.state());
   * copy.next() === rng.next(); // => true
   * ```
   *
   * @param state - A value produced by `state()`, possibly after a trip through JSON.
   * @returns A generator that continues from that point.
   * @throws {TypeError} When `state` does not have the expected shape.
   * @throws {RangeError} When the version is unsupported or the luck is not finite.
   */
  static restore(state: RandomState): Random {
    if (typeof state !== "object" || state === null || Array.isArray(state)) {
      throw new TypeError("Random.restore() needs the object returned by state().");
    }
    if (state.version !== 1) {
      throw new RangeError(
        `Random.restore() does not support state version ${String(state.version)}.`,
      );
    }
    if (typeof state.seed !== "string")
      throw new TypeError("Random.restore() needs a string seed.");
    if (!isEngineState(state.engine)) {
      throw new TypeError("Random.restore() needs an engine of four unsigned 32-bit integers.");
    }
    const rng = new Random({ seed: state.seed, luck: state.luck });
    rng.#engine.restore(state.engine);
    return rng;
  }
}

function isEngineState(value: unknown): value is [number, number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((word) => Number.isInteger(word) && word >= 0 && word < 4294967296)
  );
}

/**
 * A ready-to-use {@link Random} with a random seed and neutral luck, for when you do not need
 * reproducibility.
 *
 * @example
 * ```ts
 * random.int(1, 6); // a different result on every run
 * ```
 */
export const random: Random = /* @__PURE__ */ new Random();
