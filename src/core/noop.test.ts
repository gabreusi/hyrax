import { describe, expect, expectTypeOf, it } from "vitest";
import { noop } from "./noop";

describe("noop", () => {
  it("returns undefined for any arguments", () => {
    expect(noop()).toBeUndefined();
    expect(noop(1, "a", {})).toBeUndefined();
  });

  it("is typed as (...values: unknown[]) => void", () => {
    expectTypeOf(noop).toEqualTypeOf<(...values: unknown[]) => void>();
  });
});
