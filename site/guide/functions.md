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

## `isNumeric` and `toNumber`

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

## `noop`

A function that does nothing, for a default callback:

```ts
function watch(onChange = noop) {
  onChange();
}
watch();
```

## Types

| Type          | Means                                         |
| ------------- | --------------------------------------------- |
| `Nullable<T>` | `T \| null`                                   |
| `Maybe<T>`    | `T \| null \| undefined`                      |
| `Numeric`     | `number \| bigint \| \`${number}\``           |
| `AnyString`   | any string, while keeping literal suggestions |

`AnyString<"small" | "large">` offers `"small"` and `"large"` in your editor and still accepts any other string.

## Reference

The full signatures, with every option and error, are in the API reference: [`coalesce`](/api/hyrax/functions/coalesce), [`fabricate`](/api/hyrax/functions/fabricate), [`isNumeric`](/api/hyrax/functions/isNumeric), [`toNumber`](/api/hyrax/functions/toNumber), [`traceHierarchy`](/api/hyrax/functions/traceHierarchy), [`alias`](/api/hyrax/functions/alias), [`noop`](/api/hyrax/functions/noop).
