import { describe, expect, expectTypeOf, it } from "vitest";
import { attempt } from "./attempt";

const fail = (): number => {
  throw new SyntaxError("nope");
};

describe("attempt", () => {
  it("returns the result when the callback does not throw", () => {
    expect(attempt(() => 1)).toBe(1);
    expect(attempt(() => 1, 0)).toBe(1);
    expect(
      attempt(
        () => 1,
        () => 0,
      ),
    ).toBe(1);
  });

  it("returns undefined, the fallback or its result when the callback throws", () => {
    expect(attempt(fail)).toBeUndefined();
    expect(attempt(fail, 0)).toBe(0);
    expect(attempt(fail, null)).toBeNull();
    expect(attempt(fail, (error) => (error as Error).message)).toBe("nope");
  });

  it("does not call the fallback function when the callback succeeds", () => {
    let calls = 0;
    attempt(
      () => 1,
      () => calls++,
    );
    expect(calls).toBe(0);
  });

  it("catches a rejection and returns a promise", async () => {
    const rejects = () => Promise.reject(new Error("later"));
    await expect(attempt(rejects)).resolves.toBeUndefined();
    await expect(attempt(rejects, "x")).resolves.toBe("x");
    await expect(attempt(rejects, (error) => (error as Error).message)).resolves.toBe("later");
    await expect(attempt(() => Promise.resolve(5), 0)).resolves.toBe(5);
  });

  it("lets an error thrown by the fallback propagate", () => {
    expect(() =>
      attempt(fail, () => {
        throw new Error("fallback failed");
      }),
    ).toThrow("fallback failed");
  });

  it("types the result as the callback's result or the fallback", () => {
    expectTypeOf(attempt(() => 1)).toEqualTypeOf<number | undefined>();
    expectTypeOf(attempt(() => 1, "x")).toEqualTypeOf<number | string>();
    expectTypeOf(
      attempt(
        () => 1,
        () => null,
      ),
    ).toEqualTypeOf<number | null>();
    expectTypeOf(attempt(() => Promise.resolve(1), null)).toEqualTypeOf<Promise<number | null>>();
    expectTypeOf(attempt(() => Promise.resolve(1))).toEqualTypeOf<Promise<number | undefined>>();
  });
});
