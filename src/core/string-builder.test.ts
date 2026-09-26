import { describe, expect, expectTypeOf, it } from "vitest";
import { StringBuilder } from "./string-builder";

describe("append / build", () => {
  it("joins parts with a space by default", () => {
    expect(new StringBuilder().append("a").append("b").build()).toBe("a b");
  });

  it("returns an empty string when nothing was appended", () => {
    expect(new StringBuilder().build()).toBe("");
  });

  it("ignores empty strings", () => {
    expect(new StringBuilder().append("").append("a").append("").build()).toBe("a");
  });

  it("applies the prefix once, to the text it belongs to", () => {
    expect(new StringBuilder().append("world", "hello ").build()).toBe("hello world");
    expect(new StringBuilder().append("x", "btn--").append("y", "btn--").build()).toBe(
      "btn--x btn--y",
    );
  });

  it("uses a custom separator", () => {
    const builder = new StringBuilder({ separator: ", " }).append("a").append("b");
    expect(builder.build()).toBe("a, b");
  });

  it("lets build() override the separator for one call", () => {
    const builder = new StringBuilder().append("a").append("b");
    expect(builder.build("-")).toBe("a-b");
    expect(builder.build()).toBe("a b");
  });
});

describe("toString", () => {
  it("uses the configured separator, so template literals work", () => {
    const builder = new StringBuilder({ separator: "|" }).append("a").append("b");
    expect(builder.toString()).toBe("a|b");
    // The template literal is the behaviour under test.
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    expect(`${builder}`).toBe("a|b");
    expect(String(builder)).toBe("a|b");
  });
});

describe("unique", () => {
  it("skips a text that is already there", () => {
    const builder = new StringBuilder({ unique: true }).append("a").append("b").append("a");
    expect(builder.build()).toBe("a b");
  });

  it("compares the final text, prefix included", () => {
    const builder = new StringBuilder({ unique: true })
      .append("x", "a-")
      .append("x", "a-")
      .append("x", "b-");
    expect(builder.build()).toBe("a-x b-x");
  });

  it("allows duplicates when it is off", () => {
    expect(new StringBuilder().append("a").append("a").build()).toBe("a a");
  });
});

describe("remove", () => {
  it("removes every occurrence of the text", () => {
    const builder = new StringBuilder().append("a").append("b").append("a").remove("a");
    expect(builder.build()).toBe("b");
  });

  it("matches the final text, so prefixed parts can be removed", () => {
    // The legacy remove() compared against the raw text and never matched a prefixed part.
    const builder = new StringBuilder().append("x", "a-").remove("a-x");
    expect(builder.build()).toBe("");
  });

  it("lets a removed text be appended again when unique is on", () => {
    const builder = new StringBuilder({ unique: true }).append("a").remove("a").append("a");
    expect(builder.build()).toBe("a");
  });

  it("does nothing when the text is absent", () => {
    expect(new StringBuilder().append("a").remove("zzz").build()).toBe("a");
  });
});

describe("if / elif / else", () => {
  it("appends on a truthy if and skips a falsy one", () => {
    expect(new StringBuilder().if(true, "yes").if(false, "no").build()).toBe("yes");
  });

  it("supports a prefix", () => {
    expect(new StringBuilder().if(1, "on", "state-").build()).toBe("state-on");
  });

  it("takes the first matching branch of an if / elif / else chain", () => {
    const build = (value: number) =>
      new StringBuilder()
        .if(value === 1, "one")
        .elif(value === 2, "two")
        .else("many")
        .build();
    expect(build(1)).toBe("one");
    expect(build(2)).toBe("two");
    expect(build(3)).toBe("many");
  });

  it("does not evaluate later branches once one matched", () => {
    const builder = new StringBuilder()
      .if(true, "first")
      .elif(true, "second")
      .elif(true, "third")
      .else("last");
    expect(builder.build()).toBe("first");
  });

  it("starts a new chain at every if", () => {
    const builder = new StringBuilder().if(true, "a").else("not-a").if(false, "b").else("not-b");
    expect(builder.build()).toBe("a not-b");
  });

  it("closes the chain after an else", () => {
    const builder = new StringBuilder().if(false, "a").else("b").else("c").elif(true, "d");
    expect(builder.build()).toBe("b");
  });

  it("lets else run when there was no if before it", () => {
    expect(new StringBuilder().else("fallback").build()).toBe("fallback");
  });

  it("is not affected by unconditional appends inside a chain", () => {
    const builder = new StringBuilder().if(true, "a").append("x").else("b");
    expect(builder.build()).toBe("a x");
  });

  it("counts a truthy condition as a match even when the text is empty", () => {
    expect(new StringBuilder().if(true, "").else("b").build()).toBe("");
  });

  it("accepts any truthy or falsy value as the condition", () => {
    const builder = new StringBuilder()
      .if("text", "a")
      .if(0, "b")
      .if(null, "c")
      .if([], "d")
      .if(undefined, "e");
    expect(builder.build()).toBe("a d");
  });
});

describe("types", () => {
  it("chains by returning `this`", () => {
    const builder = new StringBuilder();
    expectTypeOf(builder.append("a")).toEqualTypeOf<StringBuilder>();
    expectTypeOf(builder.if(true, "a").elif(false, "b").else("c")).toEqualTypeOf<StringBuilder>();
    expectTypeOf(builder.build()).toEqualTypeOf<string>();
  });
});

describe("append with a record", () => {
  it("adds the keys with a truthy value, in order, with the prefix", () => {
    const built = new StringBuilder()
      .append("btn")
      .append({ active: true, disabled: false, large: 1, empty: "" }, "btn--")
      .build();
    expect(built).toBe("btn btn--active btn--large");
  });

  it("respects unique and does not touch the if chain", () => {
    const builder = new StringBuilder({ unique: true }).append("a");
    expect(builder.append({ a: true, b: true }).build()).toBe("a b");
    expect(builder.if(false, "x").append({ y: true }).else("z").build()).toBe("a b y z");
  });
});

describe("toggle", () => {
  it("adds a missing part and removes a present one", () => {
    expect(new StringBuilder().append("a").toggle("a").toggle("b").build()).toBe("b");
  });

  it("follows force when it is given", () => {
    expect(new StringBuilder().append("a").toggle("a", true).build()).toBe("a");
    expect(new StringBuilder().toggle("a", 1).build()).toBe("a");
    expect(new StringBuilder().append("a").toggle("a", false).build()).toBe("");
    expect(new StringBuilder().toggle("a", null).build()).toBe("");
  });

  it("compares the final text and removes every copy", () => {
    expect(new StringBuilder().append("x", "a-").append("x", "a-").toggle("a-x").build()).toBe("");
  });

  it("ignores an empty part", () => {
    expect(new StringBuilder().toggle("").build()).toBe("");
  });
});
