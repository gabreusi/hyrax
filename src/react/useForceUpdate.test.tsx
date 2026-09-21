import { act, render, renderHook, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { useForceUpdate } from "./useForceUpdate";

describe("useForceUpdate", () => {
  it("returns a function that never changes", () => {
    const { result, rerender } = renderHook(() => useForceUpdate());
    const first = result.current;
    rerender();
    act(() => first());
    expect(result.current).toBe(first);
  });

  it("renders the component again every time it is called", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useForceUpdate();
    });
    expect(renders).toBe(1);
    act(() => result.current());
    expect(renders).toBe(2);
    act(() => result.current());
    expect(renders).toBe(3);
  });

  it("shows a value that changed outside React state", () => {
    function Counter() {
      const forceUpdate = useForceUpdate();
      const clicks = useRef(0);
      return (
        <button
          onClick={() => {
            clicks.current += 1;
            forceUpdate();
          }}
        >
          clicks: {clicks.current}
        </button>
      );
    }
    render(<Counter />);
    expect(screen.getByRole("button").textContent).toBe("clicks: 0");
    act(() => screen.getByRole("button").click());
    expect(screen.getByRole("button").textContent).toBe("clicks: 1");
  });
});
