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
