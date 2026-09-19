import type { Engine } from "./engines";
import { RandomBase } from "../random-base";

/** A generator fed with exact 32-bit words, to test what each method does with each pattern. */
class Scripted extends RandomBase {
  constructor(engine: Engine, luck: number) {
    super(engine, luck);
  }
}

/**
 * Builds a generator that returns exactly `words`, in order. It throws when they run out, instead
 * of cycling: an engine that cycles through words the rejection sampler always refuses would loop
 * forever (a real engine accepts each attempt with probability of at least 1/2).
 *
 * @param words - The 32-bit words to serve.
 * @param luck - The luck of the generator.
 * @returns The generator and a counter of how many words were consumed.
 */
export function scripted(words: readonly number[], luck = 0) {
  let used = 0;
  const rng = new Scripted(
    {
      next32: () => {
        if (used >= words.length) throw new Error(`scripted engine ran out of words after ${used}`);
        return words[used++] as number;
      },
    },
    luck,
  );
  return { rng, used: () => used };
}
