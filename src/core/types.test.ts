import { describe, expectTypeOf, it } from "vitest";
import type { AnyString, Maybe, Nullable, Numeric } from "./types";

describe("Nullable / Maybe", () => {
  it("add null (and undefined) to a type", () => {
    expectTypeOf<Nullable<string>>().toEqualTypeOf<string | null>();
    expectTypeOf<Maybe<string>>().toEqualTypeOf<string | null | undefined>();
  });
});

describe("AnyString", () => {
  it("accepts the literals and any other string", () => {
    expectTypeOf<"a">().toExtend<AnyString<"a" | "b">>();
    expectTypeOf<string>().toExtend<AnyString<"a" | "b">>();
  });

  it("does not accept non-strings", () => {
    expectTypeOf<number>().not.toExtend<AnyString<"a">>();
  });
});

describe("Numeric", () => {
  it("covers number, bigint and numeric template strings", () => {
    expectTypeOf<Numeric>().toEqualTypeOf<number | bigint | `${number}`>();
    expectTypeOf<"12.5">().toExtend<Numeric>();
    expectTypeOf<"abc">().not.toExtend<Numeric>();
  });
});
