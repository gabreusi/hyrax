# Strings

Case conversion that agrees on where the words are, a way to shorten text without breaking a character, and a builder
for strings made of conditional parts, such as a `class` attribute.

<StringLab />

## Changing case

`toCamelCase`, `toPascalCase`, `toSnakeCase`, `toKebabCase`, `toConstantCase` and `toTitleCase` share one tokenizer, so they agree on where the words
are. It splits on anything that is not a letter or a digit, on a change from lower to upper case, and inside
acronyms, and it understands Unicode letters.

```ts
toCamelCase("hello world_foo-bar"); // => "helloWorldFooBar"
toPascalCase("hello world"); // => "HelloWorld"
toSnakeCase("helloWorld Foo"); // => "hello_world_foo"
toKebabCase("HelloWorld foo"); // => "hello-world-foo"
toConstantCase("maxValue"); // => "MAX_VALUE"
toTitleCase("hello_world"); // => "Hello World"
```

`toTitleCase` capitalizes every word, short ones included: which words stay lowercase ("of", "de") depends on the
language and the style guide, so that choice is left to you.

Digits are kept, and acronyms are treated as one word:

```ts
toCamelCase("foo2bar"); // => "foo2bar"
toCamelCase("XMLHttpRequest"); // => "xmlHttpRequest"
toKebabCase("Ação rápida"); // => "ação-rápida"
```

The 0.x version deleted digits. A value that is not a string is now a type error and not a
silent return.

`splitWords` gives you the words themselves, if you want to build another format:

```ts
splitWords("parseHTTPResponse2xx"); // => ["parse", "HTTP", "Response2xx"]
```

## `slugify`

`slugify(text, separator = "-")` makes a URL slug: accents are removed, the words are found by the same tokenizer as the
case functions, lowercased and joined.

```ts
slugify("Ação Rápida!"); // => "acao-rapida"
slugify("Crème Brûlée", "_"); // => "creme_brulee"
slugify("fooBar 2"); // => "foo-bar-2"
```

Only accents come off: a letter that is not a base letter plus a mark, such as `ß`, `æ` or `ø`, is kept as it is.

## `interpolate`

`interpolate(template, values, fallback?)` fills `{placeholders}`. A placeholder is a key, a path (`{user.name}`), or,
with an array, an index.

```ts
interpolate("Hello, {name}!", { name: "Ana" }); // => "Hello, Ana!"
interpolate("{user.name} has {count} items", { user: { name: "Ana" }, count: 3 }); // => "Ana has 3 items"
interpolate("{0} + {1}", [2, 3]); // => "2 + 3"
```

A placeholder without a value (missing, `null` or `undefined`) is left as it is, so the gap shows instead of the word
`undefined`. Give a fallback to write something else: a string, or a function of the key.

```ts
interpolate("Hello, {name}!", {}); // => "Hello, {name}!"
interpolate("Hello, {name}!", {}, "guest"); // => "Hello, guest!"
interpolate("{a} {b}", { a: 1 }, (key) => `<${key}>`); // => "1 <b>"
```

Only the object's own properties are read, so `{constructor}` is not the function every object inherits.

## `truncate`

`truncate(text, length, ending = "…")` shortens text to at most `length` characters, the ending included. Text that
already fits comes back as it is. Characters are counted as a reader sees them, so an emoji or an accented letter is
never cut in half, and spaces left in front of the ending are dropped.

```ts
truncate("Hello, world", 8); // => "Hello,…"
truncate("Hello, world", 8, "..."); // => "Hello..."
truncate("Hi", 8); // => "Hi"
truncate("👍🏽👍🏽👍🏽", 2); // => "👍🏽…"
```

Pass an object to cut at the end of a word. When the text has no earlier word to fall back to, it cuts inside the word
rather than returning only the ending.

```ts
truncate("The quick brown fox", { length: 13, words: true }); // => "The quick…"
truncate("Supercalifragilistic", { length: 6, words: true }); // => "Super…"
```

It never throws for a bad length: when `length` is too short to hold the ending, the text is cut without it, and a
`length` below `1` gives an empty string.

## `StringBuilder`

`StringBuilder` builds a string from parts, most often a `class` attribute. It skips empty parts, applies a prefix once,
and has `if`, `elif` and `else` so that you do not need a string of ternaries.

```ts
const isPrimary = true;
const isDanger = false;

const classes = new StringBuilder()
  .append("btn")
  .if(isPrimary, "primary", "btn--")
  .elif(isDanger, "danger", "btn--")
  .else("default", "btn--")
  .build(); // => "btn btn--primary"
```

The second argument of `append`, `if`, `elif` and `else` is a prefix. It goes in front of the text, and only when the
text is not empty.

```ts
new StringBuilder().append("world", "hello ").build(); // => "hello world"
new StringBuilder().append("", "hello ").build(); // => ""
```

### Options

Options are an object. `separator` (a space by default) goes between parts, and `unique` drops a part that is
already there.

```ts
new StringBuilder({ separator: "-", unique: true }).append("a").append("b").append("a").build(); // => "a-b"
new StringBuilder().append("a").append("b").build("/"); // => "a/b"
new StringBuilder({ separator: "-" }).append("a").append("b").build("/"); // => "a/b"
```

`build` takes an optional separator that wins over the configured one, and `toString()` uses the configured one, so a
builder works inside a template literal:

```ts
const parts = new StringBuilder({ separator: "," }).append("a").append("b");
`${parts}`; // => "a,b"
```

### Chains

Every `if` starts a new chain. `elif` and `else` only run while no earlier branch of the _same_ chain matched, and an
`else` closes it. A plain `append` or `remove` in the middle does not affect the chain.

```ts
const a = false;
const b = true;
new StringBuilder().if(a, "a").elif(b, "b").build(); // => "b"
new StringBuilder().if(a, "a").else("fallback").build(); // => "fallback"
```

### Class maps

`append` also takes an object, the shape `clsx` made popular: every key whose value is truthy is added, in order, with
the prefix if you give one.

```ts
const isActive = true;
const isDisabled = false;
new StringBuilder()
  .append("btn")
  .append({ active: isActive, disabled: isDisabled }, "btn--")
  .build(); // => "btn btn--active"
```

### Prefixes, `remove` and `toggle`

The prefix is part of the text, so `unique`, `remove` and `toggle` compare the final text, prefix included. `toggle`
works like `classList.toggle`: it adds a missing part and removes a present one, or, with a second argument, adds the
part when it is truthy and removes it otherwise.

```ts
new StringBuilder().append("x", "a-").remove("a-x").build(); // => ""
new StringBuilder().append("a").toggle("a").toggle("b").build(); // => "b"
new StringBuilder().append("a").toggle("a", true).build(); // => "a"
```

`has(text)` checks for a part the same way, and `size` counts the parts.

```ts
const classes = new StringBuilder().append("x", "a-").append("b");
classes.has("a-x"); // => true
classes.size; // => 2
```

## Reference

The full signatures, with every option and error, are in the API reference: [`toCamelCase`](/api/hyrax/functions/toCamelCase), [`toPascalCase`](/api/hyrax/functions/toPascalCase), [`toSnakeCase`](/api/hyrax/functions/toSnakeCase), [`toKebabCase`](/api/hyrax/functions/toKebabCase), [`toConstantCase`](/api/hyrax/functions/toConstantCase), [`toTitleCase`](/api/hyrax/functions/toTitleCase), [`splitWords`](/api/hyrax/functions/splitWords), [`slugify`](/api/hyrax/functions/slugify), [`interpolate`](/api/hyrax/functions/interpolate), [`truncate`](/api/hyrax/functions/truncate), [`StringBuilder`](/api/hyrax/classes/StringBuilder).
