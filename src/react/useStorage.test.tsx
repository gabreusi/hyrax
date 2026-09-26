import { act, renderHook } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStorage } from "./useStorage";

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("useStorage", () => {
  it("starts at the fallback and stores what is set", () => {
    const { result } = renderHook(() => useStorage("count", 0));
    expect(result.current[0]).toBe(0);
    act(() => result.current[1](5));
    expect(result.current[0]).toBe(5);
    expect(localStorage.getItem("count")).toBe("5");
  });

  it("reads what is already stored, and falls back for invalid JSON", () => {
    localStorage.setItem("settings", '{"theme":"dark"}');
    localStorage.setItem("broken", "{oops");
    expect(renderHook(() => useStorage("settings", { theme: "light" })).result.current[0]).toEqual({
      theme: "dark",
    });
    expect(renderHook(() => useStorage("broken", "fallback")).result.current[0]).toBe("fallback");
  });

  it("chains updater functions on the stored value", () => {
    const { result } = renderHook(() => useStorage("count", 0));
    act(() => {
      result.current[1]((n) => n + 1);
      result.current[1]((n) => n + 1);
    });
    expect(result.current[0]).toBe(2);
  });

  it("removes the key with undefined", () => {
    const { result } = renderHook(() => useStorage("count", 0));
    act(() => result.current[1](3));
    act(() => result.current[1](undefined));
    expect(localStorage.getItem("count")).toBeNull();
    expect(result.current[0]).toBe(0);
  });

  it("keeps every hook with the same key in sync, and the value stable between renders", () => {
    const a = renderHook(() => useStorage("shared", { n: 0 }));
    const b = renderHook(() => useStorage("shared", { n: 0 }));
    act(() => a.result.current[1]({ n: 1 }));
    expect(b.result.current[0]).toEqual({ n: 1 });
    const before = b.result.current[0];
    b.rerender();
    expect(b.result.current[0]).toBe(before);
  });

  it("follows writes from other tabs", () => {
    const { result } = renderHook(() => useStorage("theme", "light"));
    act(() => {
      localStorage.setItem("theme", '"dark"');
      window.dispatchEvent(new StorageEvent("storage", { key: "theme" }));
    });
    expect(result.current[0]).toBe("dark");
  });

  it("uses another store, and none for null", () => {
    const { result } = renderHook(() => useStorage("tab", "a", sessionStorage));
    act(() => result.current[1]("b"));
    expect(sessionStorage.getItem("tab")).toBe('"b"');
    expect(localStorage.getItem("tab")).toBeNull();

    const none = renderHook(() => useStorage("tab", "fallback", null));
    act(() => none.result.current[1]("x"));
    expect(none.result.current[0]).toBe("fallback");
  });

  it("hydrates with the fallback, then switches to the stored value without a mismatch", async () => {
    localStorage.setItem("theme", '"dark"');
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    function Page() {
      return <p>{useStorage("theme", "light")[0]}</p>;
    }
    const container = document.createElement("div");
    container.innerHTML = "<p>light</p>"; // what the server rendered with the fallback
    document.body.appendChild(container);

    const recoverable = vi.fn();
    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(container, <Page />, { onRecoverableError: recoverable });
      await Promise.resolve();
    });
    expect(container.textContent).toBe("dark");
    expect(recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();

    act(() => root?.unmount());
    container.remove();
    errors.mockRestore();
  });
});
