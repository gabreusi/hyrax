import ts from "typescript";
import { describe, expect, it } from "vitest";
import { expectation, withAssertions } from "./assertions.mjs";

/** The expected value that `// => ...` after the first statement of `code` asks for. */
function expected(code) {
  const sf = ts.createSourceFile("x.ts", code, ts.ScriptTarget.ES2022, true);
  return expectation(code, sf.statements[0]);
}

describe("expectation", () => {
  it.each([
    ["clamp(1, 0, 2); // => 1", "1"],
    ["f(); // => -1.5", "-1.5"],
    ['f(); // => "text"', '"text"'],
    ["f(); // => 'text'", "'text'"],
    ["f(); // => true", "true"],
    ["f(); // => null", "null"],
    ["f(); // => undefined", "undefined"],
    ["f(); // => NaN", "NaN"],
    ["f(); // => Infinity", "Infinity"],
    ["f(); // => [1, 2, 3]", "[1, 2, 3]"],
    ['f(); // => ["a", ["b"]]', '["a", ["b"]]'],
    ["f(); // => { a: 1, b: [2] }", "{ a: 1, b: [2] }"],
    ['f(); // => { "key": "v" }', '{ "key": "v" }'],
    ["f(); //=>   5   ", "5"],
  ])("reads the literal in %s", (code, literal) => {
    expect(expected(code)).toBe(literal);
  });

  it.each([
    "f(); // => 1, 2, 3, 4, 5 or 6",
    "f(); // => a number in [0, 1)",
    "f(); // => e.g. [3, 1, 4, 2]",
    "f(); // => Uint8Array [ 213, 7, 88, 140 ]",
    'f(); // => "a", "b" or "c"',
    "f(); // => 5 to 15",
    "f(); // => 108.4 or so",
    "f(); // => new Date(0)",
    "f(); // => g()",
    "f(); // => x + 1",
    "f(); // => ",
    "f(); // a comment that is not an expectation",
    "f(); // 75% true",
    "f(); /* => 1 */",
    "f();",
  ])("treats %s as prose or nothing", (code) => {
    expect(expected(code)).toBeNull();
  });
});

describe("withAssertions", () => {
  it("asserts the value of an expression statement", () => {
    const { code, assertions } = withAssertions("clamp(15, 0, 10); // => 10\n", "x:1");
    expect(code).toBe("__expect(clamp(15, 0, 10), 10); // => 10\n");
    expect(assertions).toBe(1);
  });

  it("asserts the value bound by a single const", () => {
    const { code, assertions } = withAssertions('const size = pick(1); // => "small"\n', "x:1");
    expect(code).toBe('const size = pick(1); __expect(size, "small"); // => "small"\n');
    expect(assertions).toBe(1);
  });

  it("handles a statement that spans lines, with the comment on the last one", () => {
    const source = 'const out = new B()\n  .a("x")\n  .build(); // => "x"\n';
    const { code, assertions } = withAssertions(source, "x:1");
    expect(code).toContain('  .build(); __expect(out, "x");');
    expect(assertions).toBe(1);
  });

  it("asserts every statement that has an expectation, and no other", () => {
    const source = "a(); // => 1\nb(); // prose\nc(); // => 2, 3 or 4\nd(); // => [5]\n";
    const { code, assertions } = withAssertions(source, "x:1");
    expect(assertions).toBe(2);
    expect(code).toContain("__expect(a(), 1);");
    expect(code).toContain("b(); // prose");
    expect(code).toContain("c(); // => 2, 3 or 4");
    expect(code).toContain("__expect(d(), [5]);");
  });

  it("leaves an example with no expectation untouched", () => {
    const source = "const x = 1;\nx + 1;\n";
    expect(withAssertions(source, "x:1")).toEqual({ code: source, assertions: 0 });
  });

  it("does not mistake an arrow in a string or a comment in the middle for an expectation", () => {
    const source = 'log("a => b");\n// => 1\nlog(1);\n';
    expect(withAssertions(source, "x:1").assertions).toBe(0);
  });

  it("refuses an expectation after a statement it cannot assert on, naming the example", () => {
    expect(() => withAssertions("if (x) {} // => 1\n", "src/a.ts:9")).toThrow(/src\/a\.ts:9/);
    expect(() => withAssertions("const { a } = o; // => 1\n", "src/a.ts:9")).toThrow(
      /needs an expression/,
    );
  });
});
