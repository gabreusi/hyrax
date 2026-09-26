import { act, renderHook } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "./useMediaQuery";

/** A fake `matchMedia` whose answer the test controls, and that fires `change` like a browser. */
function fakeMatchMedia(initial: boolean) {
  let matches = initial;
  const target = new EventTarget();
  const matchMedia = vi.fn((media: string) =>
    Object.assign(target, {
      media,
      get matches() {
        return matches;
      },
    }),
  );
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    matchMedia,
    set(value: boolean) {
      matches = value;
      act(() => {
        target.dispatchEvent(new Event("change"));
      });
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMediaQuery", () => {
  it("returns whether the query matches, and follows changes", () => {
    const media = fakeMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(true);
    expect(media.matchMedia).toHaveBeenCalledWith("(min-width: 768px)");
    media.set(false);
    expect(result.current).toBe(false);
  });

  it("stops listening on unmount", () => {
    const media = fakeMatchMedia(false);
    const { result, unmount } = renderHook(() => useMediaQuery("(x)"));
    unmount();
    media.set(true);
    expect(result.current).toBe(false);
  });

  it("stays at the fallback where matchMedia does not exist", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(renderHook(() => useMediaQuery("(x)")).result.current).toBe(false);
    expect(renderHook(() => useMediaQuery("(x)", true)).result.current).toBe(true);
  });

  it("hydrates with the fallback, then switches to the real value without a mismatch", async () => {
    fakeMatchMedia(true);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    function Page() {
      return <p>{useMediaQuery("(x)") ? "wide" : "narrow"}</p>;
    }
    const container = document.createElement("div");
    container.innerHTML = "<p>narrow</p>"; // what the server rendered with the fallback
    document.body.appendChild(container);

    const recoverable = vi.fn();
    let root: Root | undefined;
    // Hydration is concurrent: an async act waits for it and the update that follows.
    await act(async () => {
      root = hydrateRoot(container, <Page />, { onRecoverableError: recoverable });
      await Promise.resolve();
    });
    expect(container.textContent).toBe("wide");
    expect(recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();

    act(() => root?.unmount());
    container.remove();
    errors.mockRestore();
  });
});
