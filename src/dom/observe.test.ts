import { afterEach, describe, expect, it, vi } from "vitest";
import { observeSize, onVisible } from "./observe";

/** A fake observer class that records instances, so the test can fire entries by hand. */
function fakeObserver<E>() {
  const instances: Array<{
    fire: (entries: E[]) => void;
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    init: unknown;
  }> = [];
  class Fake {
    observe = vi.fn();
    disconnect = vi.fn();
    constructor(callback: (entries: E[]) => void, init?: unknown) {
      instances.push({ fire: callback, observe: this.observe, disconnect: this.disconnect, init });
    }
  }
  return { Fake, instances };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("observeSize", () => {
  it("calls back for every entry and disconnects on off()", () => {
    const { Fake, instances } = fakeObserver<ResizeObserverEntry>();
    vi.stubGlobal("ResizeObserver", Fake);
    const element = document.createElement("div");
    const callback = vi.fn();
    const off = observeSize(element, callback, { box: "border-box" });

    const [observer] = instances;
    expect(observer?.observe).toHaveBeenCalledWith(element, { box: "border-box" });
    const entry = { target: element } as unknown as ResizeObserverEntry;
    observer?.fire([entry, entry]);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith(entry);

    off();
    off();
    expect(observer?.disconnect).toHaveBeenCalled();
  });

  it("does nothing for a null element or without ResizeObserver", () => {
    expect(() => observeSize(null, () => {})()).not.toThrow();
    vi.stubGlobal("ResizeObserver", undefined);
    expect(() => observeSize(document.body, () => {})()).not.toThrow();
  });
});

describe("onVisible", () => {
  const entry = (isIntersecting: boolean) => ({ isIntersecting }) as IntersectionObserverEntry;

  it("calls back only when the element becomes visible, and passes the options on", () => {
    const { Fake, instances } = fakeObserver<IntersectionObserverEntry>();
    vi.stubGlobal("IntersectionObserver", Fake);
    const callback = vi.fn();
    const off = onVisible(document.body, callback, { rootMargin: "200px" });

    const [observer] = instances;
    expect(observer?.init).toEqual({ rootMargin: "200px" });
    observer?.fire([entry(false)]);
    expect(callback).not.toHaveBeenCalled();
    observer?.fire([entry(true)]);
    observer?.fire([entry(false), entry(true)]);
    expect(callback).toHaveBeenCalledTimes(2);
    off();
    expect(observer?.disconnect).toHaveBeenCalled();
  });

  it("stops after the first time with once", () => {
    const { Fake, instances } = fakeObserver<IntersectionObserverEntry>();
    vi.stubGlobal("IntersectionObserver", Fake);
    const callback = vi.fn();
    onVisible(document.body, callback, { once: true });

    const [observer] = instances;
    observer?.fire([entry(true), entry(true)]);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(observer?.disconnect).toHaveBeenCalled();
  });

  it("does nothing for a null element or without IntersectionObserver", () => {
    expect(() => onVisible(undefined, () => {})()).not.toThrow();
    vi.stubGlobal("IntersectionObserver", undefined);
    expect(() => onVisible(document.body, () => {})()).not.toThrow();
  });
});
