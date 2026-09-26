import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { debounce, throttle } from "./timing";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Calls `f` every `step` ms for `duration` ms, starting now, with the elapsed time as argument. */
function burst(f: (t: number) => void, duration: number, step: number) {
  for (let t = 0; t < duration; t += step) {
    f(t);
    vi.advanceTimersByTime(step);
  }
}

describe("debounce", () => {
  it("runs once, with the latest arguments, after the calls stop", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced("a");
    vi.advanceTimersByTime(50);
    debounced("b");
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("b");
  });

  it("runs again for a new burst", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced(1);
    vi.advanceTimersByTime(100);
    debounced(2);
    vi.advanceTimersByTime(100);
    expect(fn.mock.calls).toEqual([[1], [2]]);
  });

  it("runs on the first call with leading, and not twice for a single call", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, { wait: 100, leading: true });
    debounced(1);
    expect(fn.mock.calls).toEqual([[1]]);
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);

    debounced(2);
    debounced(3);
    vi.advanceTimersByTime(100);
    expect(fn.mock.calls).toEqual([[1], [2], [3]]);
  });

  it("skips the run when the calls stop with trailing: false", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, { wait: 100, leading: true, trailing: false });
    debounced(1);
    debounced(2);
    vi.advanceTimersByTime(200);
    expect(fn.mock.calls).toEqual([[1]]);
  });

  it("runs at least every maxWait during a long burst", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, { wait: 100, maxWait: 250 });
    burst(debounced, 600, 50);
    expect(fn.mock.calls).toEqual([[200], [450]]);
    vi.advanceTimersByTime(100);
    expect(fn.mock.calls).toEqual([[200], [450], [550]]);
  });

  it("cancels and flushes", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced(1);
    expect(debounced.pending).toBe(true);
    debounced.cancel();
    expect(debounced.pending).toBe(false);
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();

    debounced(2);
    debounced.flush();
    expect(fn.mock.calls).toEqual([[2]]);
    expect(debounced.pending).toBe(false);
    vi.advanceTimersByTime(200);
    debounced.flush();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("treats a wait that is negative, NaN or infinite as 0", () => {
    for (const wait of [-5, NaN, Infinity]) {
      const fn = vi.fn();
      debounce(fn, wait)(1);
      expect(fn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(0);
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it("stays consistent when fn throws or calls it again", () => {
    const debounced: ReturnType<typeof debounce<[number]>> = debounce((n: number) => {
      if (n === 1) throw new Error("boom");
      if (n === 2) debounced(3);
    }, 10);
    debounced(1);
    expect(() => vi.advanceTimersByTime(10)).toThrow("boom");
    expect(debounced.pending).toBe(false);

    debounced(2);
    vi.advanceTimersByTime(10);
    expect(debounced.pending).toBe(true);
  });

  it("types the arguments", () => {
    const debounced = debounce((a: string, b: number) => a + b, 10);
    expectTypeOf(debounced).parameters.toEqualTypeOf<[string, number]>();
    expectTypeOf(debounced.pending).toEqualTypeOf<boolean>();
  });
});

describe("throttle", () => {
  it("runs on the first call, once per wait during a burst, and once at the end", () => {
    const fn = vi.fn();
    burst(throttle(fn, 100), 350, 10);
    vi.advanceTimersByTime(200);
    expect(fn.mock.calls).toEqual([[0], [90], [190], [290], [340]]);
  });

  it("waits for the first wait with leading: false", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, { wait: 100, leading: false });
    throttled(1);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn.mock.calls).toEqual([[1]]);
  });

  it("skips the last run with trailing: false", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, { wait: 100, trailing: false });
    throttled(1);
    throttled(2);
    vi.advanceTimersByTime(300);
    expect(fn.mock.calls).toEqual([[1]]);
  });
});
