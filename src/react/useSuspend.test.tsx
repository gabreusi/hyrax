import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSuspend } from "./useSuspend";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Freezes the timers while the wall clock jumps, as a suspended machine does. */
function sleep(ms: number) {
  vi.setSystemTime(Date.now() + ms);
  vi.advanceTimersByTime(1000);
}

describe("useSuspend", () => {
  it("calls the latest callback after a suspension, and stops on unmount", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(({ callback }) => useSuspend(callback), {
      initialProps: { callback: first },
    });
    rerender({ callback: second });
    sleep(10_000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(second.mock.calls[0]?.[0]).toBeGreaterThan(3000);

    unmount();
    sleep(10_000);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("does not fire for normal ticks, and honours the threshold", () => {
    const callback = vi.fn();
    renderHook(() => useSuspend(callback, { threshold: 20_000 }));
    vi.advanceTimersByTime(60_000);
    sleep(10_000);
    expect(callback).not.toHaveBeenCalled();
    sleep(30_000);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
