import { act, render, renderHook, screen } from "@testing-library/react";
import { StrictMode, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useClickOutside } from "./useClickOutside";

afterEach(() => vi.restoreAllMocks());

const press = (target: Element, type = "pointerdown") =>
  act(() => {
    target.dispatchEvent(new Event(type, { bubbles: true, composed: true }));
  });

/** A popup with an outside area, the way an app would use the hook. */
function Popup({ handler, ignore = false }: { handler: (event: Event) => void; ignore?: boolean }) {
  const popup = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  useClickOutside(popup, handler, ignore ? { ignore: opener } : undefined);
  return (
    <div>
      <button ref={opener}>open</button>
      <div ref={popup}>
        <span>inside</span>
      </div>
      <p>outside</p>
    </div>
  );
}

describe("useClickOutside", () => {
  it("calls the handler, with the event, for a press outside the ref", () => {
    const handler = vi.fn();
    render(<Popup handler={handler} />);
    press(screen.getByText("outside"));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toBeInstanceOf(Event);
  });

  it("does not call it for a press inside, however deep", () => {
    const handler = vi.fn();
    render(<Popup handler={handler} />);
    press(screen.getByText("inside"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("counts every ref of a list as inside", () => {
    const handler = vi.fn();
    function Two() {
      const a = useRef<HTMLDivElement>(null);
      const b = useRef<HTMLDivElement>(null);
      useClickOutside([a, b], handler);
      return (
        <>
          <div ref={a}>a</div>
          <div ref={b}>b</div>
          <p>out</p>
        </>
      );
    }
    render(<Two />);
    press(screen.getByText("a"));
    press(screen.getByText("b"));
    expect(handler).not.toHaveBeenCalled();
    press(screen.getByText("out"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("accepts an element, and mixes elements with refs", () => {
    const handler = vi.fn();
    const box = document.createElement("div");
    document.body.append(box);
    const ref = { current: null };
    renderHook(() => useClickOutside([box, ref, null, undefined], handler));
    press(box);
    expect(handler).not.toHaveBeenCalled();
    press(document.body);
    expect(handler).toHaveBeenCalledTimes(1);
    box.remove();
  });

  it("treats the elements in `ignore` as inside", () => {
    const handler = vi.fn();
    render(<Popup handler={handler} ignore />);
    press(screen.getByText("open"));
    expect(handler).not.toHaveBeenCalled();
    press(screen.getByText("outside"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("finds a ref that is only set after the first render", () => {
    const handler = vi.fn();
    function Late() {
      const [shown, setShown] = useState(false);
      const box = useRef<HTMLDivElement>(null);
      useClickOutside(box, handler);
      return (
        <>
          <button onClick={() => setShown(true)}>show</button>
          {shown && <div ref={box}>late</div>}
        </>
      );
    }
    render(<Late />);
    act(() => screen.getByText("show").click());
    press(screen.getByText("late"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("treats a ref that is empty as nothing inside", () => {
    const handler = vi.fn();
    renderHook(() => useClickOutside({ current: null }, handler));
    press(document.body);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("calls the latest handler without listening again", () => {
    const add = vi.spyOn(document, "addEventListener");
    const first = vi.fn();
    const second = vi.fn();
    const box = { current: null };
    const { rerender } = renderHook(
      ({ handler }) => useClickOutside(box, handler, { ignore: [] }),
      {
        initialProps: { handler: first },
      },
    );
    rerender({ handler: second });
    rerender({ handler: second });
    press(document.body);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(add.mock.calls.filter(([type]) => type === "pointerdown")).toHaveLength(1);
  });

  it("reads the latest targets, so a new list needs no new listener", () => {
    const handler = vi.fn();
    const a = document.createElement("div");
    const b = document.createElement("div");
    document.body.append(a, b);
    const { rerender } = renderHook(({ list }) => useClickOutside(list, handler), {
      initialProps: { list: [a] as Element[] },
    });
    rerender({ list: [b] });
    press(b);
    expect(handler).not.toHaveBeenCalled();
    press(a);
    expect(handler).toHaveBeenCalledTimes(1);
    a.remove();
    b.remove();
  });

  it("listens to the event named in the options", () => {
    const handler = vi.fn();
    renderHook(() => useClickOutside(null, handler, { event: "click" }));
    press(document.body, "pointerdown");
    expect(handler).not.toHaveBeenCalled();
    press(document.body, "click");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("only calls the handler after a press inside when requireInsideFirst is on", () => {
    const handler = vi.fn();
    const box = document.createElement("div");
    document.body.append(box);
    renderHook(() => useClickOutside(box, handler, { requireInsideFirst: true }));
    press(document.body);
    expect(handler).not.toHaveBeenCalled();
    press(box);
    press(document.body);
    expect(handler).toHaveBeenCalledTimes(1);
    box.remove();
  });

  it("stops listening when the component unmounts", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useClickOutside(null, handler));
    unmount();
    press(document.body);
    expect(handler).not.toHaveBeenCalled();
  });

  it("ends a StrictMode render with exactly one listener and one call per press", () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const handler = vi.fn();
    renderHook(() => useClickOutside(null, handler), { wrapper: StrictMode });
    const added = add.mock.calls.filter(([type]) => type === "pointerdown").length;
    const removed = remove.mock.calls.filter(([type]) => type === "pointerdown").length;
    expect(added - removed).toBe(1);
    press(document.body);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
