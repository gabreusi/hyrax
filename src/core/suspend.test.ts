import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { Suspend } from "./suspend";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Simulates the machine sleeping: the wall clock jumps while the timers stay put. */
const sleepFor = (milliseconds: number) => vi.setSystemTime(Date.now() + milliseconds);

describe("construction", () => {
  it("defaults to a 3 s threshold checked every 1 s", () => {
    const suspend = new Suspend();
    expect(suspend.threshold).toBe(3000);
    expect(suspend.interval).toBe(1000);
  });

  it("accepts custom values", () => {
    const suspend = new Suspend({ threshold: 500, interval: 100 });
    expect(suspend.threshold).toBe(500);
    expect(suspend.interval).toBe(100);
  });

  it("rejects values that would fire constantly or never", () => {
    expect(() => new Suspend({ interval: 0 })).toThrow(RangeError);
    expect(() => new Suspend({ interval: -5 })).toThrow(RangeError);
    expect(() => new Suspend({ interval: NaN })).toThrow(RangeError);
    expect(() => new Suspend({ interval: 1000, threshold: 1000 })).toThrow(RangeError);
    expect(() => new Suspend({ interval: 1000, threshold: 500 })).toThrow(RangeError);
  });
});

describe("timer lifecycle", () => {
  it("does not start a timer until there is a listener", () => {
    new Suspend();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("starts on the first listener and stops when the last one leaves", () => {
    const suspend = new Suspend();
    const offA = suspend.on(() => {});
    const offB = suspend.on(() => {});
    expect(vi.getTimerCount()).toBe(1);
    offA();
    expect(vi.getTimerCount()).toBe(1);
    offB();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("restarts when a listener is added again", () => {
    const suspend = new Suspend();
    suspend.on(() => {})();
    expect(vi.getTimerCount()).toBe(0);
    suspend.on(() => {});
    expect(vi.getTimerCount()).toBe(1);
  });

  it("unsubscribing twice is harmless", () => {
    const suspend = new Suspend();
    const off = suspend.on(() => {});
    off();
    expect(() => off()).not.toThrow();
  });
});

describe("detecting a suspension", () => {
  it("stays quiet while time flows normally", () => {
    const callback = vi.fn();
    new Suspend().on(callback);
    vi.advanceTimersByTime(30_000);
    expect(callback).not.toHaveBeenCalled();
  });

  it("calls the listener with the elapsed time after a long gap", () => {
    const callback = vi.fn();
    new Suspend().on(callback);
    sleepFor(60_000);
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledExactlyOnceWith(61_000);
  });

  it("respects a custom threshold", () => {
    const callback = vi.fn();
    new Suspend({ threshold: 200, interval: 100 }).on(callback);
    sleepFor(250);
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledOnce();
  });

  it("does not fire for a gap at or below the threshold", () => {
    const callback = vi.fn();
    new Suspend({ threshold: 3000, interval: 1000 }).on(callback);
    sleepFor(1999);
    vi.advanceTimersByTime(1000);
    expect(callback).not.toHaveBeenCalled();
  });

  it("calls every listener", () => {
    const first = vi.fn();
    const second = vi.fn();
    const suspend = new Suspend();
    suspend.on(first);
    suspend.on(second);
    sleepFor(10_000);
    vi.advanceTimersByTime(1000);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it("keeps calling a persistent listener on every suspension", () => {
    const callback = vi.fn();
    new Suspend().on(callback);
    sleepFor(10_000);
    vi.advanceTimersByTime(1000);
    sleepFor(10_000);
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("calls a `once` listener a single time and then stops the timer", () => {
    const callback = vi.fn();
    new Suspend().on(callback, { once: true });
    sleepFor(10_000);
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("the first tick after starting", () => {
  it("does not report the time before the first listener was added", () => {
    // The legacy class took `last` at load time, so a listener added 10 minutes later was
    // told the machine had been suspended for 10 minutes.
    const suspend = new Suspend();
    sleepFor(600_000);
    const callback = vi.fn();
    suspend.on(callback);
    vi.advanceTimersByTime(1000);
    expect(callback).not.toHaveBeenCalled();
  });

  it("does not report the time while there were no listeners", () => {
    const suspend = new Suspend();
    suspend.on(() => {})();
    sleepFor(600_000);
    const callback = vi.fn();
    suspend.on(callback);
    vi.advanceTimersByTime(1000);
    expect(callback).not.toHaveBeenCalled();
  });
});

describe("listeners that misbehave", () => {
  it("runs the other listeners when one throws, then surfaces the error", () => {
    const survivor = vi.fn();
    const suspend = new Suspend();
    suspend.on(() => {
      throw new Error("boom");
    });
    suspend.on(survivor);
    sleepFor(10_000);
    expect(() => vi.advanceTimersByTime(1000)).toThrow("boom");
    expect(survivor).toHaveBeenCalledOnce();
  });

  it("wraps several errors in an AggregateError", () => {
    const suspend = new Suspend();
    suspend.on(() => {
      throw new Error("one");
    });
    suspend.on(() => {
      throw new Error("two");
    });
    sleepFor(10_000);
    expect(() => vi.advanceTimersByTime(1000)).toThrow(AggregateError);
  });

  it("does not call a listener that an earlier one removed", () => {
    const suspend = new Suspend();
    const late = vi.fn();
    let removeLate = () => {};
    suspend.on(() => removeLate());
    removeLate = suspend.on(late);
    sleepFor(10_000);
    vi.advanceTimersByTime(1000);
    expect(late).not.toHaveBeenCalled();
  });
});

describe("dispose", () => {
  it("stops the timer and drops every listener", () => {
    const callback = vi.fn();
    const suspend = new Suspend();
    suspend.on(callback);
    suspend.dispose();
    expect(vi.getTimerCount()).toBe(0);
    sleepFor(10_000);
    vi.advanceTimersByTime(5000);
    expect(callback).not.toHaveBeenCalled();
  });

  it("can be called more than once", () => {
    const suspend = new Suspend();
    suspend.dispose();
    expect(() => suspend.dispose()).not.toThrow();
  });

  it("refuses new listeners afterwards", () => {
    const suspend = new Suspend();
    suspend.dispose();
    expect(() => suspend.on(() => {})).toThrow("disposed");
  });

  it("stops listeners from inside a callback without skipping the cleanup", () => {
    const suspend = new Suspend();
    const after = vi.fn();
    suspend.on(() => suspend.dispose());
    suspend.on(after);
    sleepFor(10_000);
    vi.advanceTimersByTime(1000);
    expect(after).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("runtime differences", () => {
  it("unrefs the timer when the runtime supports it, so it cannot keep Node alive", () => {
    vi.useRealTimers();
    const unref = vi.fn();
    const clear = vi.fn();
    vi.stubGlobal("setInterval", () => ({ unref }));
    vi.stubGlobal("clearInterval", clear);
    const off = new Suspend().on(() => {});
    expect(unref).toHaveBeenCalledOnce();
    off();
    expect(clear).toHaveBeenCalledOnce();
  });

  it("works with timer handles that are plain numbers (browsers)", () => {
    vi.useRealTimers();
    const clear = vi.fn();
    vi.stubGlobal("setInterval", () => 42);
    vi.stubGlobal("clearInterval", clear);
    const off = new Suspend().on(() => {});
    off();
    expect(clear).toHaveBeenCalledWith(42);
  });

  it("explains itself when there are no timers", () => {
    vi.stubGlobal("setInterval", undefined);
    expect(() => new Suspend().on(() => {})).toThrow("setInterval");
  });
});

describe("types", () => {
  it("returns an unsubscribe function and passes the elapsed time", () => {
    const suspend = new Suspend();
    const off = suspend.on((elapsed) => {
      expectTypeOf(elapsed).toEqualTypeOf<number>();
    });
    expectTypeOf(off).toEqualTypeOf<() => void>();
    off();
  });
});
