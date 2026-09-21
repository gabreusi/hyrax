# Strings

Case conversion that agrees on where the words are, and a builder for strings made of conditional parts, such as a
`class` attribute.

<StringLab />

## Changing case

`toCamelCase`, `toPascalCase`, `toSnakeCase` and `toKebabCase` share one tokenizer, so they agree on where the words
are. It splits on anything that is not a letter or a digit, on a change from lower to upper case, and inside
acronyms, and it understands Unicode letters.

```ts
toCamelCase("hello world_foo-bar"); // => "helloWorldFooBar"
toPascalCase("hello world"); // => "HelloWorld"
toSnakeCase("helloWorld Foo"); // => "hello_world_foo"
toKebabCase("HelloWorld foo"); // => "hello-world-foo"
```

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

### Prefixes and `remove`

The prefix is part of the text, so `unique` and `remove` compare the final text, prefix included.

```ts
new StringBuilder().append("x", "a-").remove("a-x").build(); // => ""
```

## Reference

The full signatures, with every option and error, are in the API reference: [`toCamelCase`](/api/hyrax/functions/toCamelCase), [`toPascalCase`](/api/hyrax/functions/toPascalCase), [`toSnakeCase`](/api/hyrax/functions/toSnakeCase), [`toKebabCase`](/api/hyrax/functions/toKebabCase), [`splitWords`](/api/hyrax/functions/splitWords), [`StringBuilder`](/api/hyrax/classes/StringBuilder).
