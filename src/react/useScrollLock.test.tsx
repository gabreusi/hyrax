import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useScrollLock } from "./useScrollLock";

afterEach(() => {
  document.body.removeAttribute("style");
});

describe("useScrollLock", () => {
  it("locks while active and mounted", () => {
    const { rerender, unmount } = renderHook(({ active }) => useScrollLock(active), {
      initialProps: { active: true },
    });
    expect(document.body.style.overflow).toBe("hidden");
    rerender({ active: false });
    expect(document.body.style.overflow).toBe("");
    rerender({ active: true });
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps the page locked until every hook releases it", () => {
    const a = renderHook(() => useScrollLock());
    const b = renderHook(() => useScrollLock());
    a.unmount();
    expect(document.body.style.overflow).toBe("hidden");
    b.unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
