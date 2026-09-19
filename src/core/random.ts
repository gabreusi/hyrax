import { createSeed, createSeededEngine } from "./internal/engines";
import { RandomBase } from "./random-base";

/** Options for {@link Random}. */
export interface RandomOptions {
  /** Any string or number. A number is used as its string form. Without one, a seed is drawn. */
  seed?: string | number;
  /** How much the outcome methods favour good results: `0` is neutral, negative is unlucky. */
  luck?: number;
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
    super(createSeededEngine(resolved), luck);
    this.seed = resolved;
  }
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
