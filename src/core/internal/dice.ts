/** How many dice one notation may roll in total, so user input cannot stall the process. */
const MAX_DICE = 1000;
const MAX_SIDES = 1_000_000_000;

/** One term of a dice notation: a constant, or `count` dice of `sides` sides. */
export type DiceTerm =
  | { sign: 1 | -1; constant: number }
  | {
      sign: 1 | -1;
      count: number;
      sides: number;
      keep?: { highest: boolean; count: number };
    };

const TERM = /^(?:(\d*)d(\d+)(?:k([hl])(\d+))?|(\d+))$/i;

/**
 * Parses a dice notation such as `2d6+3`, `4d6kh3` or `1d8+1d6-1`.
 *
 * @param notation - Terms joined by `+` or `-`: each is `NdM` (optionally followed by `khK` or
 *   `klK` to keep the highest or lowest K dice) or a whole number. Spaces and case are ignored.
 * @returns The parsed terms.
 * @throws {RangeError} For anything it cannot read, or more than 1000 dice in total.
 */
export function parseDice(notation: string): DiceTerm[] {
  const text = notation.replace(/\s+/g, "");
  const pieces = text.match(/[+-]?[^+-]+/g) ?? [];
  if (text === "" || pieces.join("") !== text) {
    throw new RangeError(`roll() cannot read "${notation}": use something like "2d6+3".`);
  }

  let totalDice = 0;
  return pieces.map((piece): DiceTerm => {
    const sign = piece.startsWith("-") ? -1 : 1;
    const match = TERM.exec(piece.replace(/^[+-]/, ""));
    if (!match) throw new RangeError(`roll() cannot read "${piece}" in "${notation}".`);

    const [, countText, sidesText, keepMode, keepText, constantText] = match;
    if (constantText !== undefined) {
      const constant = Number(constantText);
      if (!Number.isSafeInteger(constant)) {
        throw new RangeError(`roll() got a constant that is too large in "${notation}".`);
      }
      return { sign, constant };
    }

    const count = countText ? Number(countText) : 1;
    const sides = Number(sidesText);
    if (count < 1) throw new RangeError(`roll() needs at least one die in "${piece}".`);
    if (sides < 1) throw new RangeError(`roll() needs at least 1 side in "${piece}".`);
    if (sides > MAX_SIDES) {
      throw new RangeError(`roll() allows at most ${MAX_SIDES} sides in "${piece}".`);
    }
    totalDice += count;
    if (totalDice > MAX_DICE) {
      throw new RangeError(`roll() allows at most ${MAX_DICE} dice in "${notation}".`);
    }

    if (keepMode === undefined) return { sign, count, sides };
    const keepCount = Number(keepText);
    if (keepCount < 1) throw new RangeError(`roll() must keep at least one die in "${piece}".`);
    if (keepCount > count) {
      throw new RangeError(`roll() cannot keep ${keepCount} of ${count} dice in "${piece}".`);
    }
    return {
      sign,
      count,
      sides,
      keep: { highest: keepMode.toLowerCase() === "h", count: keepCount },
    };
  });
}

const CACHE_LIMIT = 100;
let cache: Map<string, readonly DiceTerm[]> | undefined;

/**
 * {@link parseDice}, remembering the last few notations: games roll the same `"1d20"` in a loop and
 * parsing it every time dominates the cost of a roll. The cache is emptied when it fills up, so user
 * input cannot make it grow without bound.
 *
 * @param notation - A dice notation.
 * @returns The parsed terms. Do not modify them: the same array is returned for a repeated notation.
 * @throws {RangeError} For a notation {@link parseDice} cannot read (nothing is cached then).
 */
export function parseDiceCached(notation: string): readonly DiceTerm[] {
  cache ??= new Map();
  let terms = cache.get(notation);
  if (terms === undefined) {
    terms = parseDice(notation);
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(notation, terms);
  }
  return terms;
}

/**
 * Rolls parsed terms and adds them up.
 *
 * @param terms - The result of {@link parseDice}.
 * @param rollDie - Rolls one die with the given number of sides, from 1 up to `sides`.
 * @returns The total.
 */
export function rollTerms(terms: readonly DiceTerm[], rollDie: (sides: number) => number): number {
  let total = 0;
  for (const term of terms) {
    if ("constant" in term) {
      total += term.sign * term.constant;
      continue;
    }
    const rolls = Array.from({ length: term.count }, () => rollDie(term.sides));
    const kept = term.keep
      ? rolls
          .sort((x, y) => x - y)
          .slice(
            term.keep.highest ? -term.keep.count : 0,
            term.keep.highest ? undefined : term.keep.count,
          )
      : rolls;
    total += term.sign * kept.reduce((sum, roll) => sum + roll, 0);
  }
  return total;
}
