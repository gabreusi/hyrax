import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInterval } from "./useInterval";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("useInterval", () => {
  it("waits for start() by default", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useInterval(handler, 100));
    tick(500);
    expect(handler).not.toHaveBeenCalled();
    expect(result.current.isRunning).toBe(false);
  });

  it("runs the handler every `delay` between start() and stop()", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useInterval(handler, 100));
    act(() => result.current.start());
    expect(result.current.isRunning).toBe(true);
    tick(350);
    expect(handler).toHaveBeenCalledTimes(3);
    act(() => result.current.stop());
    expect(result.current.isRunning).toBe(false);
    tick(500);
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it("starts by itself with autoStart", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useInterval(handler, 100, { autoStart: true }));
    expect(result.current.isRunning).toBe(true);
    tick(200);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("calls the handler right away when it starts, with `immediate`", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useInterval(handler, 100, { immediate: true }));
    act(() => result.current.start());
    expect(handler).toHaveBeenCalledTimes(1);
    tick(100);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("does not call it right away without `immediate`", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useInterval(handler, 100));
    act(() => result.current.start());
    expect(handler).not.toHaveBeenCalled();
  });

  it("restarts the timer with the new delay when `delay` changes while running", () => {
    const handler = vi.fn();
    const { result, rerender } = renderHook(({ delay }) => useInterval(handler, delay), {
      initialProps: { delay: 1000 },
    });
    act(() => result.current.start());
    tick(500);
    rerender({ delay: 200 });
    tick(199);
    expect(handler).not.toHaveBeenCalled();
    tick(1);
    expect(handler).toHaveBeenCalledTimes(1);
    tick(200);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("does not call an `immediate` handler again just because `delay` changed", () => {
    const handler = vi.fn();
    const { result, rerender } = renderHook(
      ({ delay }) => useInterval(handler, delay, { immediate: true }),
      { initialProps: { delay: 1000 } },
    );
    act(() => result.current.start());
    rerender({ delay: 200 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not start a timer when `delay` changes while stopped", () => {
    const { rerender } = renderHook(({ delay }) => useInterval(vi.fn(), delay), {
      initialProps: { delay: 100 },
    });
    rerender({ delay: 50 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("calls the latest handler without restarting the timer", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ handler }) => useInterval(handler, 100), {
      initialProps: { handler: first },
    });
    act(() => result.current.start());
    rerender({ handler: second });
    tick(100);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps start and stop the same function, and a second start() adds no second timer", () => {
    const { result, rerender } = renderHook(() => useInterval(vi.fn(), 100));
    const { start, stop } = result.current;
    act(() => start());
    act(() => start());
    rerender();
    expect(result.current.start).toBe(start);
    expect(result.current.stop).toBe(stop);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("lets the handler stop the interval", () => {
    const handler = vi.fn(() => stopRef.current());
    const stopRef = { current: () => {} };
    const { result } = renderHook(() => {
      const interval = useInterval(handler, 100, { autoStart: true });
      stopRef.current = interval.stop;
      return interval;
    });
    tick(100);
    expect(result.current.isRunning).toBe(false);
    tick(500);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("clears the timer when the component unmounts", () => {
    const { unmount } = renderHook(() => useInterval(vi.fn(), 100, { autoStart: true }));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps a single timer, and the right rate, in StrictMode", () => {
    const handler = vi.fn();
    renderHook(() => useInterval(handler, 100, { autoStart: true }), { wrapper: StrictMode });
    expect(vi.getTimerCount()).toBe(1);
    tick(300);
    expect(handler).toHaveBeenCalledTimes(3);
  });
});
