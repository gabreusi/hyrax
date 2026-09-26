import { parseDiceCached, rollTerms } from "./internal/dice";
import type { Engine } from "./internal/engines";
import { nextDown } from "./internal/float";
import { lucky } from "./internal/luck";

const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
// Both are built on first use, for the same reason as in float.ts: no work at module level.
let alphanumeric: string[] | undefined;
let hex: string[] | undefined;
const TWO_POW_32 = 4294967296;
const MAX_SPAN = 9007199254740992; // 2 ** 53

/**
 * The methods every generator shares. It draws all its randomness from an engine: a seeded one for
 * {@link Random}, a `crypto`-backed one for {@link SecureRandom}.
 *
 * **Luck** bends the *outcome* methods (`int`, `float`, `boolean`) and leaves the *structural* ones
 * (`from`, `pop`, `shuffle`, `date`, `id`, `uuid`, `bytes`) fair. It is fixed when the generator is
 * created and is `0` (neutral) by default. Every call consumes the same number of draws whatever the
 * luck is, so the same seed with more luck never gives a worse result for any single call.
 *
 * @example
 * ```ts
 * const rng = new Random({ seed: "run-1", luck: 1 });
 * rng.int(1, 20); // as if you rolled twice and kept the better one
 * ```
 */
export abstract class RandomBase {
  /** How much the outcome methods favour good results: `0` is neutral, negative is unlucky. */
  readonly luck: number;

  readonly #engine: Engine;

  /**
   * @param engine - Where the 32-bit words come from.
   * @param luck - A finite number; `0` is neutral.
   * @throws {RangeError} When `luck` is not a finite number.
   */
  protected constructor(engine: Engine, luck = 0) {
    if (!Number.isFinite(luck)) throw new RangeError(`luck must be a finite number, got ${luck}.`);
    this.luck = luck;
    this.#engine = engine;
  }

  /**
   * A fair float in `[0, 1)` with 53 bits of precision, built from two words. It is the raw
   * material of the other methods and is **never** affected by luck.
   *
   * @example
   * ```ts
   * new Random("x").next(); // => a number in [0, 1)
   * ```
   *
   * @returns The float.
   */
  next(): number {
    const high = this.#engine.next32() >>> 5;
    const low = this.#engine.next32() >>> 6;
    return (high * 67108864 + low) / 9007199254740992;
  }

  /**
   * A float in `[min, max)`: the result is never `max`. The bounds may be given in either order.
   * Affected by luck.
   *
   * @example
   * ```ts
   * new Random("x").float(10, 20); // => a number in [10, 20)
   * ```
   *
   * @param min - One bound (default `0`).
   * @param max - The other bound (default `1`).
   * @returns The random float.
   * @throws {RangeError} When a bound is not finite.
   */
  float(min = 0, max = 1): number {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new RangeError(`float() needs finite bounds, got ${min} and ${max}.`);
    }
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    const value = low + lucky(this.next(), this.luck) * (high - low);
    if (value < high) return value;
    // Rounding reached `high` (a tiny range at a large magnitude): step back to the last double below.
    return Math.max(low, nextDown(high));
  }

  /**
   * An integer between `min` and `max`, **both included**. With luck `0` it has no bias at all: it
   * keeps the top bits of a word and draws again when the value falls outside the range. The bounds
   * may be given in either order, and fractional bounds are rounded inward (`1.2..2.8` means `2`).
   * Affected by luck.
   *
   * @example
   * ```ts
   * new Random("x").int(1, 6); // => 1, 2, 3, 4, 5 or 6
   * ```
   *
   * @param min - One bound.
   * @param max - The other bound.
   * @returns The random integer.
   * @throws {RangeError} When the range holds no integer, is not finite or is wider than 2^53.
   */
  int(min: number, max: number): number;
  /**
   * An integer between `0` and `max`, **both included**: `int(6)` is `int(0, 6)`, and gives the same
   * result for the same seed. A negative `max` counts down from `0`.
   *
   * @example
   * ```ts
   * new Random("x").int(9); // => 0, 1, ... or 9
   * ```
   *
   * @param max - The other bound; the range starts at `0`.
   * @returns The random integer.
   * @throws {RangeError} When the range holds no integer, is not finite or is wider than 2^53.
   */
  int(max: number): number;
  int(min: number, max?: number): number {
    if (max === undefined) [min, max] = [0, min];
    const low = Math.ceil(Math.min(min, max));
    const high = Math.floor(Math.max(min, max));
    if (!Number.isFinite(low) || !Number.isFinite(high) || low > high) {
      throw new RangeError(`int() found no integer between ${min} and ${max}.`);
    }
    const span = high - low + 1;
    const index = this.#below(span, "int()");
    // Always drawn, so a call costs the same at every luck; only used when luck bends the result.
    const fraction = this.#engine.next32() / TWO_POW_32;
    if (this.luck === 0) return low + index;
    return low + Math.min(span - 1, Math.floor(span * lucky((index + fraction) / span, this.luck)));
  }

  /**
   * `true` with the given probability. Affected by luck: at luck 1 a 50% check succeeds 75% of the time.
   *
   * @example
   * ```ts
   * new Random("x").boolean(0.75); // 75% true
   * ```
   *
   * @param chance - The probability of `true`, from `0` to `1` (default `0.5`).
   * @returns The random boolean.
   * @throws {RangeError} When `chance` is outside `0..1`. A percentage such as `50` is an error,
   *   not "always true".
   */
  boolean(chance = 0.5): boolean {
    if (!(chance >= 0 && chance <= 1)) {
      throw new RangeError(`boolean() needs a chance between 0 and 1, got ${chance}.`);
    }
    return lucky(this.next(), this.luck) >= 1 - chance;
  }

  /**
   * `1` or `-1`, with the same chance: a random direction, or a random sign for a magnitude. It is
   * `boolean()` underneath, so it uses one draw and is affected by luck, which favours `1`.
   *
   * @example
   * ```ts
   * const speed = 5;
   * new Random("x").sign() * speed; // => 5 or -5
   * ```
   *
   * @returns `1` or `-1`.
   */
  sign(): 1 | -1 {
    return this.boolean() ? 1 : -1;
  }

  /**
   * A random element of an array. Fair: ignores luck.
   *
   * @example
   * ```ts
   * new Random("x").from([10, 20, 30]); // => 10, 20 or 30
   * ```
   *
   * @param source - The array to pick from.
   * @returns An element, or `undefined` when the array is empty.
   */
  from<T>(source: readonly T[]): T | undefined;
  /**
   * A random character (code point) of a string. Fair: ignores luck.
   *
   * @example
   * ```ts
   * new Random("x").from("abc"); // => "a", "b" or "c"
   * ```
   *
   * @param source - The string to pick from.
   * @returns A character, or `undefined` when the string is empty.
   */
  from(source: string): string | undefined;
  /**
   * A random value of an object. Fair: ignores luck.
   *
   * @example
   * ```ts
   * new Random("x").from({ a: 1, b: 2 }); // => 1 or 2
   * ```
   *
   * @param source - The object whose values to pick from.
   * @returns A value, or `undefined` when the object has none.
   */
  from<T>(source: Readonly<Record<string, T>>): T | undefined;
  from(source: string | readonly unknown[] | Readonly<Record<string, unknown>>): unknown {
    const items: readonly unknown[] =
      typeof source === "string"
        ? Array.from(source)
        : Array.isArray(source)
          ? (source as readonly unknown[])
          : Object.values(source);
    if (items.length === 0) return undefined;
    return items[this.#below(items.length, "from()")];
  }

  /**
   * Removes a random element from `array` (mutating it) and returns it. Fair: ignores luck.
   *
   * @example
   * ```ts
   * const deck = [1, 2, 3];
   * new Random("x").pop(deck); // => one of them, now missing from `deck`
   * ```
   *
   * @param array - The array to take an element from.
   * @returns The removed element, or `undefined` when the array is empty.
   */
  pop<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array.splice(this.#below(array.length, "pop()"), 1)[0];
  }

  /**
   * A shuffled copy of `array` (Fisher-Yates). With a seed every permutation is equally likely up
   * to 34 elements (the engine has 128 bits of state); past that, use {@link SecureRandom}. The input
   * is left untouched. Fair: ignores luck.
   *
   * @example
   * ```ts
   * new Random("x").shuffle([1, 2, 3, 4]); // => e.g. [3, 1, 4, 2]
   * ```
   *
   * @param array - The items to shuffle.
   * @returns A new, shuffled array.
   */
  shuffle<T>(array: readonly T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.#below(i + 1, "shuffle()");
      const held = copy[i] as T;
      copy[i] = copy[j] as T;
      copy[j] = held;
    }
    return copy;
  }

  /**
   * A date between `after` and `before`, both included, at millisecond resolution. The defaults
   * are the Unix epoch and now, so pass both bounds for a reproducible result. Fair: ignores luck.
   *
   * @example
   * ```ts
   * new Random("x").date("2020-01-01", "2020-12-31"); // => a date in 2020
   * ```
   *
   * @param after - One bound (default: the epoch).
   * @param before - The other bound (default: now).
   * @returns The random date.
   * @throws {RangeError} When a bound is not a valid date or the range is wider than 2^53 ms.
   */
  date(after: number | string | Date = 0, before: number | string | Date = Date.now()): Date {
    const a = new Date(after).getTime();
    const b = new Date(before).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) throw new RangeError("date() needs valid date bounds.");
    const low = Math.min(a, b);
    return new Date(low + this.#below(Math.max(a, b) - low + 1, "date()"));
  }

  /**
   * A random string of characters from `alphabet`. Not unique, and not secret unless the generator
   * is a {@link SecureRandom}. Fair: ignores luck.
   *
   * @example
   * ```ts
   * new Random("x").id(); // => e.g. "aZ3kQ9pLm0"
   * new Random("x").id(4, "01"); // => e.g. "1001"
   * ```
   *
   * @param length - How many characters (default `10`).
   * @param alphabet - The characters to draw from (default: letters and digits).
   * @returns The string.
   * @throws {RangeError} When `length` is not a non-negative integer or the alphabet is empty.
   */
  id(length = 10, alphabet: string = ALPHANUMERIC): string {
    if (!Number.isInteger(length) || length < 0) {
      throw new RangeError(`id() needs a non-negative integer length, got ${length}.`);
    }
    const characters =
      alphabet === ALPHANUMERIC
        ? (alphanumeric ??= Array.from(ALPHANUMERIC))
        : Array.from(alphabet);
    if (characters.length === 0) throw new RangeError("id() needs a non-empty alphabet.");
    let id = "";
    for (let i = 0; i < length; i++) id += characters[this.#below(characters.length, "id()")];
    return id;
  }

  /**
   * A version 4 UUID drawn from this generator, so it is reproducible for a given seed. Fair:
   * ignores luck. Unpredictable only for a {@link SecureRandom}.
   *
   * @example
   * ```ts
   * new Random("x").uuid(); // => "3f2b8c1e-9a47-4d0e-8b5a-6c1d2e7f9a03" (the same for this seed)
   * ```
   *
   * @returns The UUID, in lowercase.
   */
  uuid(): string {
    const HEX = (hex ??= Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0")));
    const a = this.#engine.next32();
    const b = this.#engine.next32();
    const c = this.#engine.next32();
    const d = this.#engine.next32();
    return (
      `${HEX[a >>> 24]}${HEX[(a >>> 16) & 255]}${HEX[(a >>> 8) & 255]}${HEX[a & 255]}-` +
      `${HEX[b >>> 24]}${HEX[(b >>> 16) & 255]}-${HEX[((b >>> 8) & 15) | 64]}${HEX[b & 255]}-` +
      `${HEX[((c >>> 24) & 63) | 128]}${HEX[(c >>> 16) & 255]}-${HEX[(c >>> 8) & 255]}${HEX[c & 255]}` +
      `${HEX[d >>> 24]}${HEX[(d >>> 16) & 255]}${HEX[(d >>> 8) & 255]}${HEX[d & 255]}`
    );
  }

  /**
   * Random bytes, four per word, most significant first. Fair: ignores luck.
   *
   * @example
   * ```ts
   * new Random("x").bytes(4); // => Uint8Array [ 213, 7, 88, 140 ]
   * ```
   *
   * @param count - How many bytes.
   * @returns The bytes.
   * @throws {RangeError} When `count` is not a non-negative integer.
   */
  bytes(count: number): Uint8Array {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError(`bytes() needs a non-negative integer count, got ${count}.`);
    }
    const bytes = new Uint8Array(count);
    for (let i = 0; i < count; i += 4) {
      const word = this.#engine.next32();
      bytes[i] = word >>> 24;
      if (i + 1 < count) bytes[i + 1] = (word >>> 16) & 255;
      if (i + 2 < count) bytes[i + 2] = (word >>> 8) & 255;
      if (i + 3 < count) bytes[i + 3] = word & 255;
    }
    return bytes;
  }

  /**
   * Picks one item, in proportion to its weight: `[80, 15, 5]` picks the first item 80% of the
   * time. Items with weight `0` are never picked. Affected by luck, which slides the pick toward the
   * **end of the list**: with positive luck the later, rarer entries come up more often, so list
   * items from the most common to the rarest.
   *
   * @example
   * ```ts
   * new Random("x").weighted(["common", "rare", "epic"], [80, 15, 5]);
   * ```
   *
   * @param items - What to pick from.
   * @param weights - One weight per item: finite and not negative, adding up to more than `0`.
   * @returns The picked item.
   * @throws {RangeError} For a table it cannot use: mismatched lengths, no items, a bad weight or a
   *   zero (or overflowing) total.
   */
  weighted<T>(items: readonly T[], weights: readonly number[]): T;
  /**
   * Picks one key of an object, in proportion to its weight. Same rules as the array form. Note that
   * JavaScript lists integer-like keys (`"1"`, `"2"`) first, whatever order you wrote them in.
   *
   * @example
   * ```ts
   * new Random("x").weighted({ common: 80, rare: 15, epic: 5 }); // => "common", "rare" or "epic"
   * ```
   *
   * @param table - Each key with its weight.
   * @returns The picked key.
   * @throws {RangeError} For a table it cannot use.
   */
  weighted<K extends string>(table: Readonly<Record<K, number>>): K;
  weighted(
    first: readonly unknown[] | Readonly<Record<string, number>>,
    second?: readonly number[],
  ): unknown {
    const isList = Array.isArray(first);
    const items: readonly unknown[] = isList ? (first as readonly unknown[]) : Object.keys(first);
    const weights: readonly number[] | undefined = isList
      ? second
      : Object.values(first as Readonly<Record<string, number>>);
    if (!weights || weights.length !== items.length) {
      throw new RangeError("weighted() needs one weight per item.");
    }
    if (items.length === 0) throw new RangeError("weighted() needs at least one item.");

    let total = 0;
    for (const weight of weights) {
      if (!Number.isFinite(weight) || weight < 0) {
        throw new RangeError(`weighted() weights must be finite and not negative, got ${weight}.`);
      }
      total += weight;
    }
    if (!Number.isFinite(total)) throw new RangeError("weighted() weights overflow when added up.");
    if (total <= 0) throw new RangeError("weighted() needs weights that add up to more than 0.");

    // The point is always below `total` (the draw is below 1 and rounds down), and the running sum
    // reaches `total` exactly, so this stops on an item that has weight and never runs past the end.
    const point = lucky(this.next(), this.luck) * total;
    let index = 0;
    let cumulative = weights[0] as number;
    while (point >= cumulative) cumulative += weights[++index] as number;
    return items[index];
  }

  /**
   * `count` items chosen without repeating a position, in random order (a partial Fisher-Yates).
   * It samples positions, not values: two equal items in the input can both come out. The input is
   * left untouched. Fair: ignores luck.
   *
   * @example
   * ```ts
   * new Random("x").sample(["a", "b", "c", "d", "e"], 3); // => e.g. ["d", "a", "e"]
   * ```
   *
   * @param items - What to sample from.
   * @param count - How many, from `0` up to `items.length`.
   * @returns The chosen items.
   * @throws {RangeError} When `count` is not a whole number between `0` and the number of items.
   */
  sample<T>(items: readonly T[], count: number): T[] {
    if (!Number.isInteger(count) || count < 0 || count > items.length) {
      throw new RangeError(
        `sample() needs a whole number from 0 to ${items.length}, got ${count}.`,
      );
    }
    const pool = [...items];
    const picked: T[] = [];
    for (let i = 0; i < count; i++) {
      const j = i + this.#below(pool.length - i, "sample()");
      const held = pool[i] as T;
      pool[i] = pool[j] as T;
      pool[j] = held;
      picked.push(pool[i] as T);
    }
    return picked;
  }

  /**
   * A normally distributed number (Box-Muller): a bell curve around `mean`. It uses four words per
   * call and never takes `log(0)`. Fair: ignores luck.
   *
   * @example
   * ```ts
   * new Random("x").normal(100, 15); // => e.g. 108.4
   * ```
   *
   * @param mean - The centre of the curve (default `0`).
   * @param deviation - How wide it is (default `1`); `0` always returns the mean.
   * @returns The number.
   * @throws {RangeError} When `mean` or `deviation` is not finite, or `deviation` is negative.
   */
  normal(mean = 0, deviation = 1): number {
    if (!Number.isFinite(mean) || !Number.isFinite(deviation) || deviation < 0) {
      throw new RangeError(
        `normal() needs a finite mean and a deviation of 0 or more, got ${mean} and ${deviation}.`,
      );
    }
    const radius = Math.sqrt(-2 * Math.log(1 - this.next()));
    const angle = 2 * Math.PI * this.next();
    return mean + deviation * radius * Math.cos(angle);
  }

  /**
   * An exponentially distributed number: the waiting time between events that happen `rate` times
   * per unit. The mean is `1 / rate`. Fair: ignores luck.
   *
   * @example
   * ```ts
   * new Random("x").exponential(2); // => e.g. 0.31 (a mean of 0.5)
   * ```
   *
   * @param rate - Events per unit, greater than `0` (default `1`).
   * @returns The waiting time.
   * @throws {RangeError} When `rate` is not a positive, finite number.
   */
  exponential(rate = 1): number {
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new RangeError(`exponential() needs a positive, finite rate, got ${rate}.`);
    }
    return (0 - Math.log(1 - this.next())) / rate;
  }

  /**
   * Rolls dice from a notation and adds them up. Terms are joined with `+` or `-`: each is `NdM`
   * (N dice with M sides; N defaults to 1), optionally followed by `khK` or `klK` to keep the K
   * highest or lowest dice, or a whole number. Spaces and case are ignored. **Every die uses the
   * generator's luck**, so luck 1 on a `1d20` is exactly advantage.
   *
   * @example
   * ```ts
   * new Random("x").roll("2d6+3"); // => 5 to 15
   * new Random("x").roll("4d6kh3"); // => the best three of four d6
   * new Random("x").roll("1d8+1d6-1");
   * ```
   *
   * @param notation - The dice notation.
   * @returns The total.
   * @throws {RangeError} For a notation it cannot read, or more than 1000 dice in total.
   */
  roll(notation: string): number {
    return rollTerms(parseDiceCached(notation), (sides) => this.int(1, sides));
  }

  /**
   * A uniform integer in `[0, span)` with no bias. It keeps the top bits of a word, just enough to
   * cover `span`, and draws again when the value lands outside (fewer than two draws on average).
   * Spans above 2^32 combine two words. Independent of luck.
   *
   * @param span - How many values, from 1 up to 2^53.
   * @param method - Who is asking, for the error message.
   * @returns The index.
   */
  #below(span: number, method: string): number {
    if (span > MAX_SPAN)
      throw new RangeError(`${method} range is too wide (more than 2^53 values).`);
    if (span <= 1) return 0;

    if (span <= TWO_POW_32) {
      const shift = Math.clz32(span - 1);
      let value: number;
      do value = this.#engine.next32() >>> shift;
      while (value >= span);
      return value;
    }

    const highBits = 32 - Math.clz32(Math.floor((span - 1) / TWO_POW_32));
    let value: number;
    do value = (this.#engine.next32() >>> (32 - highBits)) * TWO_POW_32 + this.#engine.next32();
    while (value >= span);
    return value;
  }
}
