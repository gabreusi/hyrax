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
