import { describe, expect, expectTypeOf, it } from "vitest";
import { fabricate } from "./fabricate";

describe("fabricate", () => {
  it("runs a callback with no parameters", () => {
    expect(fabricate(() => 42)).toBe(42);
  });

  it("runs a callback with parameters", () => {
    const sum = (a: number, b: number) => a + b;
    expect(fabricate(sum, [3, 4])).toBe(7);
  });

  it("runs a callback with a context as `this`", () => {
    const context = { multiplier: 2 };
    const result = fabricate(context, function (this: typeof context) {
      return this.multiplier * 5;
    });
    expect(result).toBe(10);
  });

  it("runs a callback with a context and parameters", () => {
    const context = { multiplier: 3 };
    const result = fabricate(
      context,
      function (this: typeof context, a: number, b: number) {
        return (a + b) * this.multiplier;
      },
      [4, 5],
    );
    expect(result).toBe(27);
  });

  it("initialises a const with early returns, without `let`", () => {
    const describeAge = (age: number) =>
      fabricate(() => {
        if (age < 13) return "child";
        if (age < 20) return "teen";
        return "adult";
      });
    expect(describeAge(8)).toBe("child");
    expect(describeAge(15)).toBe("teen");
    expect(describeAge(40)).toBe("adult");
  });

  it("returns the promise of an async callback untouched", async () => {
    const result = fabricate(async () => {
      await Promise.resolve();
      return 1;
    });
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBe(1);
  });

  it("propagates errors thrown by the callback", () => {
    expect(() =>
      fabricate(() => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
  });

  it("infers the return type in every form", () => {
    expectTypeOf(fabricate(() => 1)).toEqualTypeOf<number>();
    expectTypeOf(fabricate((a: string) => a.length, ["x"])).toEqualTypeOf<number>();
    expectTypeOf(
      fabricate({ n: 1 }, function (this: { n: number }) {
        return this.n > 0 ? "yes" : "no";
      }),
    ).toEqualTypeOf<string>();
  });
});
