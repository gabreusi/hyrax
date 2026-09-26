import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  splitWords,
  toCamelCase,
  toConstantCase,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
  toTitleCase,
  truncate,
} from "./string";

describe("splitWords", () => {
  it("splits on anything that is not a letter, mark or digit", () => {
    expect(splitWords("hello world")).toEqual(["hello", "world"]);
    expect(splitWords("foo_bar-baz.qux")).toEqual(["foo", "bar", "baz", "qux"]);
    expect(splitWords("  padded   ")).toEqual(["padded"]);
  });

  it("splits at lower-to-upper case boundaries", () => {
    expect(splitWords("fooBar")).toEqual(["foo", "Bar"]);
    expect(splitWords("fooBarBaz")).toEqual(["foo", "Bar", "Baz"]);
  });

  it("keeps acronyms together and splits them from the next word", () => {
    expect(splitWords("XMLHttpRequest")).toEqual(["XML", "Http", "Request"]);
    expect(splitWords("parseHTMLString")).toEqual(["parse", "HTML", "String"]);
    expect(splitWords("Convert THIS text")).toEqual(["Convert", "THIS", "text"]);
  });

  it("keeps digits attached to the letters around them", () => {
    expect(splitWords("foo2bar")).toEqual(["foo2bar"]);
    expect(splitWords("version2")).toEqual(["version2"]);
    expect(splitWords("foo2Bar")).toEqual(["foo2", "Bar"]);
    expect(splitWords("HTML5Parser")).toEqual(["HTML5", "Parser"]);
  });

  it("handles Unicode letters and combining marks", () => {
    expect(splitWords("naïve café")).toEqual(["naïve", "café"]);
    expect(splitWords("café au lait")).toEqual(["café", "au", "lait"]);
    expect(splitWords("ÁrvoreGrande")).toEqual(["Árvore", "Grande"]);
  });

  it("returns an empty list when there are no words", () => {
    expect(splitWords("")).toEqual([]);
    expect(splitWords(" _-. ")).toEqual([]);
  });
});

describe("toCamelCase", () => {
  it("converts words to camelCase", () => {
    expect(toCamelCase("hello world")).toBe("helloWorld");
    expect(toCamelCase("Convert THIS text")).toBe("convertThisText");
    expect(toCamelCase("MAX_VALUE")).toBe("maxValue");
    expect(toCamelCase("XMLHttpRequest")).toBe("xmlHttpRequest");
  });

  it("preserves digits (the legacy implementation dropped them)", () => {
    expect(toCamelCase("foo2bar")).toBe("foo2bar");
    expect(toCamelCase("foo 2 bar")).toBe("foo2Bar");
    expect(toCamelCase("version 2")).toBe("version2");
  });

  it("handles Unicode", () => {
    expect(toCamelCase("ÁRVORE genial")).toBe("árvoreGenial");
    expect(toCamelCase("naïve café")).toBe("naïveCafé");
  });

  it("returns an empty string when there are no words", () => {
    expect(toCamelCase("")).toBe("");
    expect(toCamelCase("___")).toBe("");
  });
});

describe("toPascalCase", () => {
  it("converts words to PascalCase", () => {
    expect(toPascalCase("hello world")).toBe("HelloWorld");
    expect(toPascalCase("foo_bar")).toBe("FooBar");
    expect(toPascalCase("HTML5Parser")).toBe("Html5Parser");
  });
});

describe("toSnakeCase", () => {
  it("converts words to snake_case", () => {
    expect(toSnakeCase("helloWorld")).toBe("hello_world");
    expect(toSnakeCase("XMLHttpRequest")).toBe("xml_http_request");
    expect(toSnakeCase("foo2bar")).toBe("foo2bar");
    expect(toSnakeCase("foo2Bar")).toBe("foo2_bar");
  });
});

describe("toKebabCase", () => {
  it("converts words to kebab-case", () => {
    expect(toKebabCase("helloWorld")).toBe("hello-world");
    expect(toKebabCase("HTML5Parser")).toBe("html5-parser");
    expect(toKebabCase("Some Title Here")).toBe("some-title-here");
  });
});

describe("case conversions (properties)", () => {
  const anything = fc.stringMatching(/^[A-Za-z0-9 _.-]*$/);
  // Words of two or more characters that start with a letter: single-letter words
  // are ambiguous in camelCase ("a b" -> "aB"), and a digit-led word cannot be
  // told apart from the previous one ("foo 2go" -> "foo2go").
  const wordList = fc.array(fc.stringMatching(/^[a-z][a-z0-9]{1,5}$/), {
    minLength: 1,
    maxLength: 6,
  });

  it("snake_case and kebab-case are idempotent", () => {
    fc.assert(
      fc.property(anything, (input) => {
        for (const convert of [toSnakeCase, toKebabCase]) {
          const once = convert(input);
          expect(convert(once)).toBe(once);
        }
      }),
    );
  });

  it("camelCase and PascalCase split back into the original words", () => {
    fc.assert(
      fc.property(wordList, (words) => {
        const input = words.join(" ");
        for (const convert of [toCamelCase, toPascalCase]) {
          const back = splitWords(convert(input)).map((word) => word.toLowerCase());
          expect(back).toEqual(words);
        }
      }),
    );
  });

  it("snake_case and kebab-case agree on the underlying words", () => {
    fc.assert(
      fc.property(anything, (input) => {
        expect(toSnakeCase(input).split("_").join("-")).toBe(toKebabCase(input));
      }),
    );
  });
});

describe("toConstantCase", () => {
  it("uppercases the words and joins them with underscores", () => {
    expect(toConstantCase("maxValue")).toBe("MAX_VALUE");
    expect(toConstantCase("api-key 2")).toBe("API_KEY_2");
    expect(toConstantCase("")).toBe("");
  });
});

describe("toTitleCase", () => {
  it("capitalizes every word and joins them with spaces", () => {
    expect(toTitleCase("hello_world")).toBe("Hello World");
    expect(toTitleCase("XMLHttpRequest")).toBe("Xml Http Request");
    expect(toTitleCase("ação rápida")).toBe("Ação Rápida");
    expect(toTitleCase("")).toBe("");
  });
});

describe("truncate", () => {
  it("returns text that fits as it is", () => {
    expect(truncate("Hi", 8)).toBe("Hi");
    expect(truncate("Hello, w", 8)).toBe("Hello, w");
  });

  it("cuts to length with the ending included", () => {
    expect(truncate("Hello, world", 8)).toBe("Hello,…");
    expect(truncate("Hello, world", 8, "...")).toBe("Hello...");
    expect(truncate("Hello, world", 8, "")).toBe("Hello, w");
  });

  it("never cuts a grapheme in half", () => {
    expect(truncate("👍🏽👍🏽👍🏽", 2)).toBe("👍🏽…");
    expect(truncate("ééé", 2)).toBe("é…");
  });

  it("drops the ending when there is no room for it, and gives nothing below 1", () => {
    expect(truncate("abcdef", 1)).toBe("a");
    expect(truncate("abcdef", 3, "...")).toBe("abc");
    expect(truncate("abcdef", 0)).toBe("");
    expect(truncate("abcdef", -2)).toBe("");
    expect(truncate("abcdef", NaN)).toBe("");
    expect(truncate("abcdef", 4.9)).toBe("abc…");
  });

  it("cuts at a word boundary with words: true", () => {
    expect(truncate("The quick brown fox", { length: 13, words: true })).toBe("The quick…");
    expect(truncate("The quick brown fox", { length: 11, words: true })).toBe("The quick…");
    expect(truncate("Supercalifragilistic", { length: 6, words: true })).toBe("Super…");
    expect(truncate("The quick brown fox", { length: 13, ending: "..." })).toBe("The quick...");
  });

  it("never exceeds length", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer({ min: 0, max: 30 }),
        fc.boolean(),
        (text, length, words) => {
          // fc.string() draws single code point characters, so code points count graphemes here.
          expect(Array.from(truncate(text, { length, words })).length).toBeLessThanOrEqual(length);
        },
      ),
    );
  });
});
