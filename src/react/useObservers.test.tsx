import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSize } from "./useSize";
import { useVisible } from "./useVisible";

/** Replaces an observer class with one whose callbacks the test fires by hand. */
function fakeObserver<E>(name: "ResizeObserver" | "IntersectionObserver") {
  const callbacks: Array<(entries: E[]) => void> = [];
  const disconnect = vi.fn();
  const init: unknown[] = [];
  vi.stubGlobal(
    name,
    class {
      observe = vi.fn();
      disconnect = disconnect;
      constructor(callback: (entries: E[]) => void, options?: unknown) {
        callbacks.push(callback);
        init.push(options);
      }
    },
  );
  return {
    fire: (entry: E) => act(() => callbacks.at(-1)?.([entry])),
    disconnect,
    init,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSize", () => {
  it("starts at zero and follows the content box", () => {
    const observer = fakeObserver<ResizeObserverEntry>("ResizeObserver");
    const element = document.createElement("div");
    const { result, unmount } = renderHook(() => useSize({ current: element }));
    expect(result.current).toEqual({ width: 0, height: 0 });
    observer.fire({ contentRect: { width: 100, height: 50 } } as ResizeObserverEntry);
    expect(result.current).toEqual({ width: 100, height: 50 });
    const before = result.current;
    observer.fire({ contentRect: { width: 100, height: 50 } } as ResizeObserverEntry);
    expect(result.current).toBe(before);
    unmount();
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it("stays at zero for an empty ref", () => {
    fakeObserver<ResizeObserverEntry>("ResizeObserver");
    expect(renderHook(() => useSize({ current: null })).result.current).toEqual({
      width: 0,
      height: 0,
    });
  });
});

describe("useVisible", () => {
  const entry = (isIntersecting: boolean) => ({ isIntersecting }) as IntersectionObserverEntry;

  it("follows the element entering and leaving", () => {
    const observer = fakeObserver<IntersectionObserverEntry>("IntersectionObserver");
    const element = document.createElement("div");
    const { result } = renderHook(() => useVisible(element, { rootMargin: "10px" }));
    expect(result.current).toBe(false);
    expect(observer.init[0]).toMatchObject({ rootMargin: "10px", threshold: 0 });
    observer.fire(entry(true));
    expect(result.current).toBe(true);
    observer.fire(entry(false));
    expect(result.current).toBe(false);
  });

  it("stays visible after the first time with once", () => {
    const observer = fakeObserver<IntersectionObserverEntry>("IntersectionObserver");
    const { result } = renderHook(() => useVisible(document.body, { once: true }));
    observer.fire(entry(true));
    expect(observer.disconnect).toHaveBeenCalled();
    expect(result.current).toBe(true);
  });

  it("does not observe again for a new threshold array with the same values", () => {
    fakeObserver<IntersectionObserverEntry>("IntersectionObserver");
    const observer = fakeObserver<IntersectionObserverEntry>("IntersectionObserver");
    const { rerender } = renderHook(() => useVisible(document.body, { threshold: [0, 0.5] }));
    rerender();
    rerender();
    expect(observer.init).toHaveLength(1);
  });
});
