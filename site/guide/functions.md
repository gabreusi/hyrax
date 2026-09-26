# Everyday helpers

The helpers every codebase grows by hand, written once with their edge cases settled: a nullish-aware `coalesce`, a
block expression, number parsing that refuses what it cannot trust, a hierarchy walker, a property aliaser, and `noop`.
The four utility types at the end are the ones their signatures use.

## `coalesce`

`coalesce(...values)` returns the first value that is not `null` or `undefined`, or `null` when there is none. Values
such as `0`, `""` and `false` count as real values, which is what makes it different from `||`. The result is typed
without the nullish members.

```ts
coalesce(null, undefined, 0, "x"); // => 0
coalesce(null, undefined, "x"); // => "x"
coalesce(null, undefined); // => null
```

## `fabricate`

`fabricate(callback)` runs a function and returns what it returns. It is a block expression: it lets you initialise a
`const` with early `return`s, so you do not need a `let` that is assigned later.

```ts
const width = 800;
const size = fabricate(() => {
  if (width < 600) return "small";
  if (width < 1200) return "medium";
  return "large";
}); // => "medium"
```

It can also pass parameters, and set `this`:

```ts
const sum = (a: number, b: number) => a + b;
fabricate(sum, [3, 4]); // => 7

const context = { multiplier: 2 };
fabricate(context, function (this: typeof context) {
  return this.multiplier * 5;
}); // => 10
```

## `attempt`

`attempt(callback, fallback?)` is `try`/`catch` as an expression, the way `fabricate` is a block as one. It returns what
`callback` returns, or the fallback when it throws: `undefined` when you give none, a value, or the result of a function
that receives the error.

```ts
const saved = '{"theme":"dark"}';
attempt(() => JSON.parse(saved)); // => { theme: "dark" }
attempt(() => JSON.parse("{oops")); // => undefined
attempt(() => JSON.parse("{oops"), {}); // => {}
attempt(
  () => JSON.parse("{oops"),
  (error) => (error instanceof SyntaxError ? "bad json" : "other"),
); // => "bad json"
```

When `callback` returns a promise, a rejection is caught the same way and you get a promise back, so
`await attempt(() => fetch(url), null)` never rejects. A function passed as the fallback is always called with the
error; to fall back to a function itself, return it from one: `attempt(load, () => defaultHandler)`. An error thrown by
the fallback is not caught.

## `isNumeric`, `toNumber`, `toInteger` and `toBoolean`

`isNumeric(value)` says whether a value is a number you can trust: a finite `number`, a `bigint`, or a string that is a
decimal number. `Infinity`, empty and blank strings, and hexadecimal are not.

```ts
isNumeric("12"); // => true
isNumeric(10n); // => true
isNumeric("1e3"); // => true
isNumeric("0x10"); // => false
isNumeric(""); // => false
isNumeric(Infinity); // => false
```

`toNumber(value, fallback = 0)` converts, and gives `fallback` when it cannot. It is pure: it does not read the DOM. To
turn CSS lengths such as `"2em"` into pixels, use [`toPixels`](./dom#topixels).

```ts
toNumber("12"); // => 12
toNumber("abc"); // => 0
toNumber("abc", -1); // => -1
toNumber(null, 7); // => 7
```

`toBoolean(value, fallback = false)` does the same for values that came from text: environment variables, query
strings, `data-*` attributes. It reads `true`/`false`, `yes`/`no`, `on`/`off` and `1`/`0`, in any case and with
surrounding spaces. Pass `null` as the fallback to tell a missing or invalid value apart from an explicit `false`.

```ts
toBoolean("true"); // => true
toBoolean(" YES "); // => true
toBoolean("off"); // => false
toBoolean("maybe"); // => false
toBoolean("maybe", null); // => null
toBoolean(undefined, true); // => true
```

`toInteger(value, fallback = 0)` is `toNumber` that drops the fraction toward zero. An integer too large to be exact
(beyond `Number.MAX_SAFE_INTEGER`) gives the fallback too, since it would silently be a different number.

```ts
toInteger("42"); // => 42
toInteger("-1.9"); // => -1
toInteger("7 items", -1); // => -1
toInteger(1e20, null); // => null
```

## `debounce` and `throttle`

`debounce(fn, wait)` waits until the calls stop for `wait` milliseconds, then runs `fn` once with the latest arguments:
search as the user types, save after the last keystroke. `throttle(fn, wait)` runs `fn` at most once every `wait`
while the calls go on: on the first call, once per `wait`, and once more at the end with the latest arguments.

```ts
const save = debounce((text: string) => console.log("saving", text), 300);
save("h");
save("hi"); // only "hi" is saved, 300 ms after this call

const report = throttle((y: number) => console.log(y), 100);
report(1); // runs now
report(2);
report(3); // runs 100 ms after the first call, with 3
```

Both return the function with three controls: `cancel()` drops the waiting call, `flush()` runs it now, and `pending`
says whether there is one. An object instead of `wait` gives the options: `leading` and `trailing` choose the edges,
and `debounce` also takes `maxWait`, so a burst that never stops still runs `fn` that often.

```ts
const sync = debounce(() => console.log("sync"), { wait: 100, maxWait: 1000 });
sync();
sync.pending; // => true
sync.cancel();
sync.pending; // => false
```

A `wait` that is negative, `NaN` or infinite counts as `0` rather than breaking the timer. The timer keeps a Node
process alive, so a pending save is not lost on exit; call `flush()` in your shutdown code to run it right away.

## `traceHierarchy`

`traceHierarchy(node, key)` follows a link (such as `parent` or `manager`) up to the root and returns the whole chain,
starting with the node. It is iterative, so a very deep hierarchy does not overflow the stack, and a cycle is a
`RangeError`, because it means the data is corrupt.

```ts
interface Person {
  name: string;
  manager: Person | null;
}

const alice: Person = { name: "Alice", manager: null };
const bob: Person = { name: "Bob", manager: alice };
const carol: Person = { name: "Carol", manager: bob };

traceHierarchy(carol, "manager").map((person) => person.name); // => ["Carol", "Bob", "Alice"]
```

::: tip Declare the shape
Give the nodes an interface, as above. With bare object literals TypeScript infers a different type at every level of
nesting, and the call does not type-check.
:::

## `alias`

`alias(object, dictionary)` wraps an object so that it also answers to other names. Reading, writing, `in` and `delete`
on an alias act on the original property. Aliases are virtual: they do not appear in `Object.keys`.

```ts
const person = { name: "Alice", age: 30 };
const aliased = alias(person, {
  name: ["fullName"] as const,
  age: ["years", "old"] as const,
});

aliased.fullName; // => "Alice"
aliased.years = 31;
person.age; // => 31
"old" in aliased; // => true
Object.keys(aliased); // => ["name", "age"]
```

Write the alias lists `as const` so that TypeScript knows their names. An alias used for two keys, or equal to another
real property, throws when the wrapper is created.

## `toArray`

`toArray(value)` turns "one or many" into a list, for a function that accepts a single value or an array of them. The
[`Arrayable<T>`](#types) type describes such a parameter. `null` and `undefined` give an empty array, and the result is
always a new array.

```ts
function tag(names: Arrayable<string>) {
  return toArray(names).join(",");
}
tag("a"); // => "a"
tag(["a", "b"]); // => "a,b"
toArray(null); // => []
```

## `noop`

A function that does nothing, for a default callback:

```ts
function watch(onChange = noop) {
  onChange();
}
watch();
```

## Types

| Type           | Means                                         |
| -------------- | --------------------------------------------- |
| `Nullable<T>`  | `T \| null`                                   |
| `Maybe<T>`     | `T \| null \| undefined`                      |
| `Numeric`      | `number \| bigint \| \`${number}\``           |
| `AnyString`    | any string, while keeping literal suggestions |
| `Arrayable<T>` | `T \| readonly T[]`                           |

`AnyString<"small" | "large">` offers `"small"` and `"large"` in your editor and still accepts any other string.

## Reference

The full signatures, with every option and error, are in the API reference: [`coalesce`](/api/hyrax/functions/coalesce), [`fabricate`](/api/hyrax/functions/fabricate), [`attempt`](/api/hyrax/functions/attempt), [`isNumeric`](/api/hyrax/functions/isNumeric), [`toNumber`](/api/hyrax/functions/toNumber), [`toBoolean`](/api/hyrax/functions/toBoolean), [`toInteger`](/api/hyrax/functions/toInteger), [`debounce`](/api/hyrax/functions/debounce), [`throttle`](/api/hyrax/functions/throttle), [`toArray`](/api/hyrax/functions/toArray), [`traceHierarchy`](/api/hyrax/functions/traceHierarchy), [`alias`](/api/hyrax/functions/alias), [`noop`](/api/hyrax/functions/noop).
