import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "./useDebouncedValue";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDebouncedValue", () => {
  it("returns the first value at once, and later ones after they settle", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 100), {
      initialProps: { value: "a" },
    });
    expect(result.current).toBe("a");
    rerender({ value: "ab" });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    rerender({ value: "abc" });
    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(result.current).toBe("a");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("abc");
  });

  it("stores a function value as a value, not as an updater", () => {
    const first = () => 1;
    const second = () => 2;
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 10), {
      initialProps: { value: first },
    });
    rerender({ value: second });
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(result.current).toBe(second);
  });
});
