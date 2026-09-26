import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useHotkey } from "./useHotkey";

const press = (init: KeyboardEventInit, target: EventTarget = window) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));

describe("useHotkey", () => {
  it("calls the latest handler, and stops on unmount", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(({ handler }) => useHotkey("ctrl+k", handler), {
      initialProps: { handler: first },
    });
    rerender({ handler: second });
    press({ key: "k", ctrlKey: true });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    unmount();
    press({ key: "k", ctrlKey: true });
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("listens only while enabled", () => {
    const handler = vi.fn();
    const { rerender } = renderHook(({ enabled }) => useHotkey("Escape", handler, { enabled }), {
      initialProps: { enabled: false },
    });
    press({ key: "Escape" });
    expect(handler).not.toHaveBeenCalled();
    rerender({ enabled: true });
    press({ key: "Escape" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not listen again for a new array with the same combinations", () => {
    const add = vi.spyOn(window, "addEventListener");
    const { rerender } = renderHook(() => useHotkey(["a", "b"], () => {}));
    const calls = add.mock.calls.length;
    rerender();
    rerender();
    expect(add.mock.calls.length).toBe(calls);
    add.mockRestore();
  });

  it("listens on a ref target", () => {
    const element = document.createElement("div");
    const handler = vi.fn();
    renderHook(() => useHotkey("enter", handler, { target: { current: element } }));
    press({ key: "Enter" }, element);
    press({ key: "Enter" });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
