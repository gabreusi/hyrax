import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { retry, timeout, TimeoutError } from "./async";

afterEach(() => vi.useRealTimers());

/** A function that fails `failures` times, then resolves with the attempt number. */
function flaky(failures: number) {
  return vi.fn((attempt: number) =>
    attempt <= failures ? Promise.reject(new Error(`fail ${attempt}`)) : Promise.resolve(attempt),
  );
}

describe("retry", () => {
  it("returns the first success and passes the attempt number", async () => {
    const fn = flaky(2);
    await expect(retry(fn, { delay: 0 })).resolves.toBe(3);
    expect(fn.mock.calls.map(([attempt]) => attempt)).toEqual([1, 2, 3]);
  });

  it("rejects with the last error when the attempts run out", async () => {
    await expect(retry(flaky(5), { times: 2, delay: 0 })).rejects.toThrow("fail 2");
  });

  it("accepts the number of attempts as a shortcut", async () => {
    vi.useFakeTimers();
    const fn = flaky(10);
    const result = retry(fn, 4);
    const settled = expect(result).rejects.toThrow("fail 4");
    await vi.runAllTimersAsync();
    await settled;
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("waits longer after each failure", async () => {
    vi.useFakeTimers();
    const fn = flaky(3);
    const result = retry(fn, { times: 4, delay: 100, backoff: 3 });
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(99);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(299);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(900);
    await expect(result).resolves.toBe(4);
  });

  it("returns the fallback instead of rejecting", async () => {
    await expect(retry(flaky(5), { times: 2, delay: 0, fallback: null })).resolves.toBeNull();
  });

  it("stops early when retryIf says no", async () => {
    const fn = flaky(5);
    await expect(retry(fn, { delay: 0, retryIf: (_, attempt) => attempt < 2 })).rejects.toThrow(
      "fail 2",
    );
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("handles sync functions and sync throws", async () => {
    await expect(retry(() => 5)).resolves.toBe(5);
    let calls = 0;
    const sync = () => {
      if (++calls < 2) throw new Error("sync");
      return "ok";
    };
    await expect(retry(sync, { delay: 0 })).resolves.toBe("ok");
  });

  it("stops on abort, with the reason or the fallback", async () => {
    const controller = new AbortController();
    const fn = vi.fn(() => {
      controller.abort(new Error("stop"));
      return Promise.reject(new Error("fail"));
    });
    await expect(retry(fn, { delay: 10_000, signal: controller.signal })).rejects.toThrow("stop");
    expect(fn).toHaveBeenCalledTimes(1);

    const aborted = AbortSignal.abort();
    const never = vi.fn();
    await expect(retry(never, { signal: aborted, fallback: "x" })).resolves.toBe("x");
    expect(never).not.toHaveBeenCalled();
  });

  it("treats invalid numbers as the safe choice", async () => {
    const fn = flaky(5);
    await expect(retry(fn, { times: NaN, delay: -1 })).rejects.toThrow("fail 3");
    const once = flaky(5);
    await expect(retry(once, { times: 0 })).rejects.toThrow("fail 1");
    expect(once).toHaveBeenCalledTimes(1);
  });

  it("types the fallback into the result", () => {
    expectTypeOf(retry(() => 1)).toEqualTypeOf<Promise<number>>();
    expectTypeOf(retry(() => Promise.resolve(1), { fallback: null })).toEqualTypeOf<
      Promise<number | null>
    >();
  });
});

describe("timeout", () => {
  const never = () => new Promise<string>(() => {});

  it("resolves with the work when it is in time", async () => {
    await expect(timeout(Promise.resolve("fast"), 1000)).resolves.toBe("fast");
    await expect(timeout(() => "sync", 1000)).resolves.toBe("sync");
  });

  it("rejects with a TimeoutError, or resolves to the fallback, when time runs out", async () => {
    vi.useFakeTimers();
    const rejected = timeout(never(), 50);
    const settled = expect(rejected).rejects.toBeInstanceOf(TimeoutError);
    const fallback = timeout(never, 50, "cached");
    const undefinedFallback = timeout(never, 50, undefined);
    await vi.advanceTimersByTimeAsync(50);
    await settled;
    await expect(rejected).rejects.toThrow("Timed out after 50 ms.");
    await expect(fallback).resolves.toBe("cached");
    await expect(undefinedFallback).resolves.toBeUndefined();
  });

  it("lets a rejection of the work through, even with a fallback", async () => {
    await expect(timeout(Promise.reject(new Error("no")), 50, "x")).rejects.toThrow("no");
    const throws = () => {
      throw new Error("sync");
    };
    await expect(timeout(throws, 50)).rejects.toThrow("sync");
  });

  it("means no limit for an ms that is negative, NaN or infinite", async () => {
    for (const ms of [-1, NaN, Infinity]) {
      await expect(timeout(Promise.resolve(1), ms)).resolves.toBe(1);
    }
  });

  it("clears its timer when the work settles", async () => {
    vi.useFakeTimers();
    await timeout(Promise.resolve(1), 1000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("names its error", () => {
    expect(new TimeoutError("x").name).toBe("TimeoutError");
  });
});
