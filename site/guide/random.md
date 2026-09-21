# Random

`Random` is a random number generator with three properties that `Math.random` does not have: it can be **seeded**
(the same seed gives the same numbers, everywhere), it has **no modulo bias**, and it has a cryptographic mode for
secrets. It also has a "luck" setting, for games.

## Quick use

`random` is a ready-made instance with no seed, for when you just want a number:

```ts
random.int(1, 6); // a different result on every run
random.from(["a", "b", "c"]); // one of them
random.boolean(0.25); // true a quarter of the time
```

`random` is **not** cryptographically secure. Anyone who sees a few outputs can predict the next ones. Do not use it
for tokens, passwords or session ids; use [`Random.secure()`](#secrets).

## Seeds

Give `Random` a seed and it becomes a function of that seed. A number works as its own string.

```ts
const rng = new Random("level-1");
rng.int(1, 100); // => 25
new Random("level-1").int(1, 100); // => 25
new Random(42).next() === new Random("42").next(); // => true
```

That is what makes procedural worlds, replays, fixtures and reproducible bug reports possible. The output for a seed
is part of the [contract](/notes/design#determinism): it will not change in a minor or patch release.

## The methods

```ts
const rng = new Random("methods");

rng.next(); // a float in [0, 1)
rng.float(10, 20); // a float in [10, 20), never 20
rng.int(1, 6); // an integer from 1 to 6, both included
rng.boolean(); // true or false
rng.from(["a", "b", "c"]); // an element of an array
rng.from("abc"); // a character of a string
rng.shuffle([1, 2, 3, 4]); // a shuffled copy
rng.sample([1, 2, 3, 4, 5], 3); // three distinct elements
rng.date("2020-01-01", "2020-12-31"); // a date in 2020
rng.id(8); // 8 letters and digits
rng.uuid(); // a version 4 UUID
rng.bytes(4); // a Uint8Array of 4 bytes
```

`int` and `float` take their bounds in any order, `int` rounds fractional bounds inwards, and a range that holds no
integer is a `RangeError`. `boolean(50)` is a `RangeError` too, and not "always true": the chance is from `0` to `1`.

<!-- untested -->

```ts
new Random("x").boolean(50); // throws a RangeError
```

### No bias

`Math.floor(Math.random() * 6)` and `value % 6` are slightly biased. `int`, `from`, `shuffle`, `sample`, `id` and
`date` draw again when a value falls in the uneven leftover, so every outcome is exactly as likely as the others.
This is proven in the tests by feeding the generator every bit pattern, and not by sampling.

### Weighted choices, dice and curves

```ts
new Random("loot").weighted({ common: 80, rare: 15, epic: 5 }); // "common", "rare" or "epic"
new Random("loot").weighted(["a", "b", "c"], [1, 1, 8]); // "a", "b" or "c"
new Random("dice").roll("2d6+3"); // 5 to 15
new Random("dice").roll("4d6kh3"); // the best three of four d6
new Random("dice").roll("1d8+1d6-1");
new Random("stats").normal(100, 15); // a bell curve around 100
new Random("wait").exponential(2); // a waiting time, with a mean of 0.5
```

A weight of `0` is never picked. `roll` reads the usual dice notation (`NdM`, `kh` and `kl` to keep the highest or
lowest, and constants), ignores case and spaces, and rolls at most 1000 dice.

## Luck

`luck` is set when the generator is created and never changes. It bends the _outcome_ methods (`int`, `float`,
`boolean`, `weighted` and `roll`) in your favour, or against you when it is negative. `luck: 1` is like rolling twice
and keeping the better result.

```ts
const lucky = new Random({ seed: "run-1", luck: 1 });
lucky.int(1, 20); // as if you rolled twice and kept the better one
```

| luck | average d20 | chance of 15 or more | a 50% check |
| ---- | ----------- | -------------------- | ----------- |
| -2   | 5.5         | 2.7%                 | 12.5%       |
| -1   | 7.2         | 8.9%                 | 24.9%       |
| 0    | 10.5        | 30.1%                | 50.1%       |
| 1    | 13.8        | 50.9%                | 75.0%       |
| 2    | 15.5        | 65.7%                | 87.5%       |
| 4    | 17.2        | 83.2%                | 96.9%       |

Every call draws the same amount of randomness whatever the luck, so for the same seed and the same calls, more luck
never makes an individual result worse. The structural methods (`from`, `shuffle`, `sample`, `id`, `uuid`...) ignore
luck, and in `weighted` a positive luck slides towards the **end** of the list, so list the items from the most common
to the rarest.

## Splitting a generator

`fork` gives you an independent generator that depends only on the parent's seed and the keys you name. It does not
matter how many numbers the parent has drawn, so each part of a world stays stable when another part changes.

```ts
const world = new Random("world-7");
world.next();
world.next();
world.fork("terrain", 3, 4).int(0, 255) === new Random("world-7").fork("terrain", 3, 4).int(0, 255); // => true
```

## Saving and restoring

`state()` is plain JSON, and `Random.restore` continues exactly where the generator was, so you can save a game or
replay a bug.

```ts
const rng = new Random("save-slot");
rng.next();
const saved = JSON.stringify(rng.state());
Random.restore(JSON.parse(saved)).next() === rng.next(); // => true
```

## Secrets

`Random.secure()` uses `crypto.getRandomValues`, in Node, browsers, Deno and Bun. It has no seed and no `state`, and
it throws where there is no `crypto`; it never falls back to `Math.random`. `token()` exists only on the secure
generator, so a reproducible token cannot be written by mistake.

```ts
const secure = Random.secure();
secure.token().length; // => 43
secure.token(16).length; // => 22
secure.uuid(); // an unpredictable version 4 UUID
```

## Limits worth knowing

- The seeded generator is **not** cryptographic, and its state is 128 bits, so `shuffle` with a seed cannot reach every
  permutation of more than 34 items. The secure one has no such limit.
- `date` defaults its upper bound to "now", so it is only reproducible when you pass both bounds.
- In an object, integer-like keys (`"1"`) are ordered first by JavaScript, which matters for `weighted`.

## Reference

The full signatures, with every option and error, are in the API reference: [`Random`](/api/@gabreusi/hyrax/classes/Random), [`random`](/api/@gabreusi/hyrax/variables/random), [`SecureRandom`](/api/@gabreusi/hyrax/interfaces/SecureRandom), [`RandomOptions`](/api/@gabreusi/hyrax/interfaces/RandomOptions), [`RandomState`](/api/@gabreusi/hyrax/interfaces/RandomState).
