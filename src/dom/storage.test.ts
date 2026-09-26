import { afterEach, describe, expect, expectTypeOf, it } from "vitest";
import { readStorage, writeStorage } from "./storage";

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("readStorage / writeStorage", () => {
  it("round-trips JSON values through localStorage", () => {
    expect(writeStorage("settings", { theme: "dark", size: 2 })).toBe(true);
    expect(localStorage.getItem("settings")).toBe('{"theme":"dark","size":2}');
    expect(readStorage("settings", { theme: "light", size: 1 })).toEqual({
      theme: "dark",
      size: 2,
    });
    writeStorage("zero", 0);
    expect(readStorage("zero", 5)).toBe(0);
  });

  it("returns the fallback for a missing key or invalid JSON", () => {
    expect(readStorage("missing", 10)).toBe(10);
    localStorage.setItem("broken", "{oops");
    expect(readStorage("broken", "fallback")).toBe("fallback");
  });

  it("removes the key when writing undefined", () => {
    writeStorage("count", 3);
    expect(writeStorage("count", undefined)).toBe(true);
    expect(localStorage.getItem("count")).toBeNull();
  });

  it("refuses values JSON cannot write, without throwing", () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(writeStorage("x", () => {})).toBe(false);
    expect(writeStorage("x", 1n)).toBe(false);
    expect(writeStorage("x", cycle)).toBe(false);
    expect(localStorage.getItem("x")).toBeNull();
  });

  it("uses another store when given one, and none for null", () => {
    writeStorage("tab", "a", sessionStorage);
    expect(sessionStorage.getItem("tab")).toBe('"a"');
    expect(readStorage("tab", "", sessionStorage)).toBe("a");
    expect(localStorage.getItem("tab")).toBeNull();

    expect(writeStorage("tab", "b", null)).toBe(false);
    expect(readStorage("tab", "none", null)).toBe("none");
  });

  it("falls back when the store throws (blocked or full)", () => {
    const blocked = {
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
      removeItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    } as unknown as Storage;
    expect(readStorage("x", 1, blocked)).toBe(1);
    expect(writeStorage("x", 2, blocked)).toBe(false);
    expect(writeStorage("x", undefined, blocked)).toBe(false);
  });

  it("types the result like the fallback", () => {
    expectTypeOf(readStorage("x", 0)).toEqualTypeOf<number>();
    expectTypeOf(readStorage("x", { a: "" })).toEqualTypeOf<{ a: string }>();
  });
});
