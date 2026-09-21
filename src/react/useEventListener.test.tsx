import { act, render, renderHook, screen } from "@testing-library/react";
import { StrictMode, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEventListener } from "./useEventListener";

afterEach(() => vi.restoreAllMocks());

const ping = (target: EventTarget, type = "hyrax:ping") =>
  act(() => {
    target.dispatchEvent(new Event(type));
  });

describe("useEventListener", () => {
  it("listens on the window", () => {
    const handler = vi.fn();
    renderHook(() => useEventListener(window, "hyrax:ping" as "resize", handler));
    ping(window);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("listens on the document", () => {
    const handler = vi.fn();
    renderHook(() => useEventListener(document, "visibilitychange", handler));
    ping(document, "visibilitychange");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("listens on an element, given directly", () => {
    const button = document.createElement("button");
    const handler = vi.fn();
    renderHook(() => useEventListener(button, "click", handler));
    act(() => button.click());
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("listens on the element a ref points to", () => {
    const handler = vi.fn();
    function Box() {
      const ref = useRef<HTMLDivElement>(null);
      useEventListener(ref, "click", handler);
      return <div ref={ref}>box</div>;
    }
    render(<Box />);
    act(() => screen.getByText("box").click());
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("listens on an element that arrives later, when it is kept in state", () => {
    const handler = vi.fn();
    function Late() {
      const [node, setNode] = useState<HTMLDivElement | null>(null);
      useEventListener(node, "click", handler);
      return <div ref={setNode}>late</div>;
    }
    render(<Late />);
    act(() => screen.getByText("late").click());
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does nothing while the target is null or undefined", () => {
    const add = vi.spyOn(window, "addEventListener");
    const empty = { current: null };
    expect(() => {
      renderHook(() => useEventListener(null, "click", vi.fn()));
      renderHook(() => useEventListener(undefined, "click", vi.fn()));
      renderHook(() => useEventListener(empty, "click", vi.fn()));
    }).not.toThrow();
    expect(add).not.toHaveBeenCalled();
  });

  it("calls the latest handler without listening again", () => {
    const add = vi.spyOn(window, "addEventListener");
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ handler }) => useEventListener(window, "hyrax:ping" as "resize", handler),
      { initialProps: { handler: first } },
    );
    rerender({ handler: second });
    ping(window);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(add.mock.calls.filter(([type]) => type === "hyrax:ping")).toHaveLength(1);
  });

  it("does not listen again when the options are a new object with the same content", () => {
    const add = vi.spyOn(window, "addEventListener");
    const { rerender } = renderHook(() =>
      useEventListener(window, "hyrax:ping" as "resize", vi.fn(), { passive: true }),
    );
    rerender();
    rerender();
    expect(add.mock.calls.filter(([type]) => type === "hyrax:ping")).toHaveLength(1);
  });

  it("listens again when the event type changes", () => {
    const handler = vi.fn();
    const { rerender } = renderHook(
      ({ type }) => useEventListener(window, type as "resize", handler),
      { initialProps: { type: "hyrax:a" } },
    );
    rerender({ type: "hyrax:b" });
    ping(window, "hyrax:a");
    expect(handler).not.toHaveBeenCalled();
    ping(window, "hyrax:b");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("stops listening when the component unmounts", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useEventListener(window, "hyrax:ping" as "resize", handler),
    );
    unmount();
    ping(window);
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes the options through", () => {
    const handler = vi.fn();
    renderHook(() => useEventListener(window, "hyrax:ping" as "resize", handler, { once: true }));
    ping(window);
    ping(window);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("accepts a capture flag as a boolean", () => {
    const add = vi.spyOn(window, "addEventListener");
    renderHook(() => useEventListener(window, "hyrax:ping" as "resize", vi.fn(), true));
    const call = add.mock.calls.find(([type]) => type === "hyrax:ping");
    expect(call?.[2]).toMatchObject({ capture: true });
  });

  it("ends a StrictMode render with exactly one listener and one call per event", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const handler = vi.fn();
    renderHook(() => useEventListener(window, "hyrax:ping" as "resize", handler), {
      wrapper: StrictMode,
    });
    const added = add.mock.calls.filter(([type]) => type === "hyrax:ping").length;
    const removed = remove.mock.calls.filter(([type]) => type === "hyrax:ping").length;
    expect(added - removed).toBe(1);
    ping(window);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
