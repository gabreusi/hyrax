import { describe, expect, it } from "vitest";
import * as root from "./index";

describe("@gabreusi/hyrax (root entrypoint)", () => {
  it("loads in a plain Node environment, without DOM globals", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });

  it("has named exports only (no default export or aggregate object)", () => {
    expect("default" in root).toBe(false);
  });

  it("exposes exactly the intended public API", () => {
    // Adding or removing an export is an API decision: update this list on purpose.
    const expected = [
      "alias",
      "clamp",
      "coalesce",
      "fabricate",
      "isNumeric",
      "lerp",
      "noop",
      "Random",
      "random",
      "ratio",
      "remap",
      "splitWords",
      "StringBuilder",
      "Suspend",
      "toCamelCase",
      "toKebabCase",
      "toNumber",
      "toPascalCase",
      "toSnakeCase",
      "traceHierarchy",
    ];
    expect(Object.keys(root).sort()).toEqual(expected.sort());
  });
});
