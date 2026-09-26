/**
 * Splits a string into words. Word boundaries are any character that is not a
 * letter, combining mark or digit, plus the transitions between cases
 * (`fooBar`, `XMLHttp`). Digits stay attached to the letters around them, so
 * `foo2bar` is a single word.
 *
 * @example
 * ```ts
 * splitWords("fooBar_baz-2go"); // => ["foo", "Bar", "baz", "2go"]
 * splitWords("XMLHttpRequest"); // => ["XML", "Http", "Request"]
 * splitWords("foo2bar"); // => ["foo2bar"]
 * ```
 *
 * @param input - The string to split.
 * @returns The words, in their original casing.
 */
export function splitWords(input: string): string[] {
  return input
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2")
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, "$1 $2")
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean);
}

function capitalize(word: string): string {
  const [first = "", ...rest] = word;
  return first.toUpperCase() + rest.join("").toLowerCase();
}

/**
 * Converts a string to `camelCase`.
 *
 * @example
 * ```ts
 * toCamelCase("hello world"); // => "helloWorld"
 * toCamelCase("MAX_VALUE"); // => "maxValue"
 * toCamelCase("foo2bar"); // => "foo2bar"
 * ```
 *
 * @param input - The string to convert.
 * @returns The `camelCase` string.
 */
export function toCamelCase(input: string): string {
  return splitWords(input)
    .map((word, index) => (index === 0 ? word.toLowerCase() : capitalize(word)))
    .join("");
}

/**
 * Converts a string to `PascalCase`.
 *
 * @example
 * ```ts
 * toPascalCase("hello world"); // => "HelloWorld"
 * toPascalCase("foo_bar"); // => "FooBar"
 * ```
 *
 * @param input - The string to convert.
 * @returns The `PascalCase` string.
 */
export function toPascalCase(input: string): string {
  return splitWords(input).map(capitalize).join("");
}

/**
 * Converts a string to `snake_case`.
 *
 * @example
 * ```ts
 * toSnakeCase("helloWorld"); // => "hello_world"
 * toSnakeCase("XMLHttpRequest"); // => "xml_http_request"
 * ```
 *
 * @param input - The string to convert.
 * @returns The `snake_case` string.
 */
export function toSnakeCase(input: string): string {
  return splitWords(input)
    .map((word) => word.toLowerCase())
    .join("_");
}

/**
 * Converts a string to `kebab-case`.
 *
 * @example
 * ```ts
 * toKebabCase("helloWorld"); // => "hello-world"
 * toKebabCase("HTML5Parser"); // => "html5-parser"
 * ```
 *
 * @param input - The string to convert.
 * @returns The `kebab-case` string.
 */
export function toKebabCase(input: string): string {
  return splitWords(input)
    .map((word) => word.toLowerCase())
    .join("-");
}

/**
 * Converts a string to `CONSTANT_CASE`.
 *
 * @example
 * ```ts
 * toConstantCase("maxValue"); // => "MAX_VALUE"
 * toConstantCase("api-key 2"); // => "API_KEY_2"
 * ```
 *
 * @param input - The string to convert.
 * @returns The `CONSTANT_CASE` string.
 */
export function toConstantCase(input: string): string {
  return splitWords(input)
    .map((word) => word.toUpperCase())
    .join("_");
}

/**
 * Converts a string to `Title Case`: every word capitalized, separated by a space. Every word
 * counts, short ones such as "of" included, since which words stay lowercase depends on the
 * language and the style guide.
 *
 * @example
 * ```ts
 * toTitleCase("hello_world"); // => "Hello World"
 * toTitleCase("XMLHttpRequest"); // => "Xml Http Request"
 * ```
 *
 * @param input - The string to convert.
 * @returns The `Title Case` string.
 */
export function toTitleCase(input: string): string {
  return splitWords(input).map(capitalize).join(" ");
}

/** Options for {@link truncate}. */
export interface TruncateOptions {
  /** The maximum length of the result, `ending` included, in characters as a reader counts them. */
  length: number;
  /** What marks the cut. Defaults to `"…"`. */
  ending?: string;
  /** Cut at the end of a word instead of inside one, when the kept text has a space. Defaults to `false`. */
  words?: boolean;
}

/** Splits text into what a reader sees as characters, so an emoji or an accent is never cut in half. */
function graphemes(text: string): string[] {
  if (typeof Intl === "object" && typeof Intl.Segmenter === "function") {
    return Array.from(new Intl.Segmenter().segment(text), ({ segment }) => segment);
  }
  return Array.from(text);
}

/**
 * Shortens `text` to at most `length` characters, `ending` included. Text that already fits comes
 * back as it is. Characters are counted as a reader sees them, so an emoji or a letter with an
 * accent is never cut in half, and spaces left before the ending are dropped. When `length` is too
 * short to hold the ending, the text is cut without it, and a `length` below `1` (or `NaN`) gives an
 * empty string.
 *
 * @example
 * ```ts
 * truncate("Hello, world", 8); // => "Hello,…"
 * truncate("Hello, world", 8, "..."); // => "Hello..."
 * truncate("Hi", 8); // => "Hi"
 * ```
 *
 * @param text - The text to shorten.
 * @param length - The maximum length of the result.
 * @param ending - What marks the cut (default `"…"`).
 * @returns The text, shortened when needed.
 */
export function truncate(text: string, length: number, ending?: string): string;
/**
 * Shortens `text` with options: with `words: true` the cut moves back to the end of the last whole
 * word, when there is one.
 *
 * @example
 * ```ts
 * truncate("The quick brown fox", { length: 13, words: true }); // => "The quick…"
 * truncate("Supercalifragilistic", { length: 6, words: true }); // => "Super…"
 * ```
 *
 * @param text - The text to shorten.
 * @param options - `length`, `ending` and `words`.
 * @returns The text, shortened when needed.
 */
export function truncate(text: string, options: TruncateOptions): string;
export function truncate(
  text: string,
  lengthOrOptions: number | TruncateOptions,
  ending = "…",
): string {
  const {
    length: limit,
    ending: end = ending,
    words = false,
  } = typeof lengthOrOptions === "number" ? { length: lengthOrOptions } : lengthOrOptions;
  const length = Math.floor(limit);
  if (!(length > 0)) return "";

  const characters = graphemes(text);
  if (characters.length <= length) return text;

  const marker = graphemes(end).length < length ? end : "";
  let kept = characters.slice(0, length - graphemes(marker).length).join("");
  if (words) {
    // Only when the cut fell inside a word, and there is an earlier word to fall back to.
    const next = characters[length - graphemes(marker).length] ?? "";
    const space = kept.search(/\s\S*$/u);
    if (/\S/u.test(next) && space > 0) kept = kept.slice(0, space);
  }
  return kept.trimEnd() + marker;
}

/**
 * Turns text into a URL slug: accents are removed (`ã` becomes `a`), the words are lowercased and
 * joined with `separator`, and everything that is not a letter or a digit goes away. Letters that
 * are not a base letter plus an accent, such as `ß`, `æ` or `ø`, are kept as they are.
 *
 * @example
 * ```ts
 * slugify("Ação Rápida!"); // => "acao-rapida"
 * slugify("  Hello, World 2  "); // => "hello-world-2"
 * slugify("Crème Brûlée", "_"); // => "creme_brulee"
 * ```
 *
 * @param input - The text to convert.
 * @param separator - What goes between words (default `"-"`).
 * @returns The slug.
 */
export function slugify(input: string, separator = "-"): string {
  return splitWords(input.normalize("NFKD").replace(/\p{M}/gu, ""))
    .map((word) => word.toLowerCase())
    .join(separator);
}

/** What {@link interpolate} writes when a placeholder has no value: fixed text, or text made from the key. */
export type InterpolateFallback = string | ((key: string) => string);

const PLACEHOLDER = /\{\s*([^{}\s]+)\s*\}/g;

/**
 * Fills the `{placeholders}` of a template. A placeholder is a key of `values`, or a path into it
 * (`{user.name}`), and with an array the keys are indices (`{0}`). A placeholder whose value is
 * missing, `null` or `undefined` is left as it is, so a gap shows up instead of `"undefined"`.
 *
 * @example
 * ```ts
 * interpolate("Hello, {name}!", { name: "Ana" }); // => "Hello, Ana!"
 * interpolate("{user.name} has {count} items", { user: { name: "Ana" }, count: 3 }); // => "Ana has 3 items"
 * interpolate("{0} + {1}", [2, 3]); // => "2 + 3"
 * interpolate("Hello, {name}!", {}); // => "Hello, {name}!"
 * ```
 *
 * @param template - The text with placeholders.
 * @param values - Where the values come from.
 * @returns The filled text.
 */
export function interpolate(template: string, values: object): string;
/**
 * Fills the placeholders, and writes `fallback` for those without a value: fixed text, or the
 * result of a function that receives the key.
 *
 * @example
 * ```ts
 * interpolate("Hello, {name}!", {}, "guest"); // => "Hello, guest!"
 * interpolate("{a} {b}", { a: 1 }, (key) => `<${key}>`); // => "1 <b>"
 * ```
 *
 * @param template - The text with placeholders.
 * @param values - Where the values come from.
 * @param fallback - What to write for a placeholder without a value.
 * @returns The filled text.
 */
export function interpolate(
  template: string,
  values: object,
  fallback: InterpolateFallback,
): string;
export function interpolate(
  template: string,
  values: object,
  fallback?: InterpolateFallback,
): string {
  return template.replace(PLACEHOLDER, (placeholder, key: string) => {
    let value: unknown = values;
    for (const part of key.split(".")) {
      // `hasOwn`: `{constructor}` must not print the function every object inherits.
      value =
        value != null && Object.hasOwn(value, part)
          ? (value as Record<string, unknown>)[part]
          : undefined;
    }
    // An object prints as `[object Object]`, like in a template literal: pass the text you want.
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    if (value != null) return String(value);
    if (fallback === undefined) return placeholder;
    return typeof fallback === "function" ? fallback(key) : fallback;
  });
}

/** The plural categories of `Intl.PluralRules`: which of them a language uses depends on the language. */
export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

/** The text for each plural category. `other` is required: a category you leave out falls back to it. */
export type PluralForms = Partial<Record<PluralCategory, string>> & { other: string };

/** Options for {@link plural}. */
export interface PluralOptions {
  /** The language, which decides both the category and how `#` is written. Defaults to `"en"`. */
  locale?: string;
  /** `"cardinal"` (1 item, 2 items) or `"ordinal"` (1st, 2nd). Defaults to `"cardinal"`. */
  type?: "cardinal" | "ordinal";
}

/**
 * Picks the text that matches `count` in a language, with `Intl.PluralRules`, and writes the count
 * in place of `#`. Each language has its own categories (English has `one` and `other`, Arabic
 * has six), and a category missing from `forms` falls back to `other`, so it never returns
 * `undefined`. The count is formatted for the language (`1,000` in English).
 *
 * The locale defaults to `"en"` and not to the machine's, so the server and the browser agree.
 *
 * @example
 * ```ts
 * plural(1, { one: "# item", other: "# items" }); // => "1 item"
 * plural(3, { one: "# item", other: "# items" }); // => "3 items"
 * plural(0, { zero: "nothing", one: "# item", other: "# items" }); // => "0 items"
 * plural(1000, { one: "# item", other: "# itens" }, "pt-BR"); // => "1.000 itens"
 * plural(2, { one: "#st", two: "#nd", few: "#rd", other: "#th" }, { type: "ordinal" }); // => "2nd"
 * ```
 *
 * @param count - The number the text is about.
 * @param forms - The text for each category; `#` is replaced by the count.
 * @param locale - The language, or `{ locale, type }` for ordinals.
 * @returns The matching text.
 */
export function plural(count: number, forms: PluralForms, locale?: string | PluralOptions): string;
/**
 * The short form, for a language with just "one" and "other": `one` when the language puts
 * `count` in the `one` category, and `other` otherwise.
 *
 * @example
 * ```ts
 * plural(1, "# file", "# files"); // => "1 file"
 * plural(2, "file", "files"); // => "files"
 * ```
 *
 * @param count - The number the text is about.
 * @param one - The singular text.
 * @param other - The plural text.
 * @param locale - The language (default `"en"`).
 * @returns The matching text.
 */
export function plural(count: number, one: string, other: string, locale?: string): string;
export function plural(
  count: number,
  forms: PluralForms | string,
  third?: string | PluralOptions,
  fourth?: string,
): string {
  const short = typeof forms === "string";
  const table: PluralForms = short ? { one: forms, other: third as string } : forms;
  const options: PluralOptions = short
    ? { locale: fourth }
    : typeof third === "string"
      ? { locale: third }
      : (third ?? {});
  const { locale = "en", type = "cardinal" } = options;
  const text = table[new Intl.PluralRules(locale, { type }).select(count)] ?? table.other;
  return text.replaceAll("#", new Intl.NumberFormat(locale).format(count));
}
