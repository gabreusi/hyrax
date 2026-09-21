import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { onClickOutside } from "./onClickOutside";

let popup: HTMLDivElement;
let inner: HTMLButtonElement;
let outside: HTMLButtonElement;

beforeEach(() => {
  popup = document.createElement("div");
  inner = document.createElement("button");
  popup.appendChild(inner);
  outside = document.createElement("button");
  document.body.append(popup, outside);
});

afterEach(() => {
  document.body.innerHTML = "";
});

const press = (element: Element, type = "pointerdown") =>
  element.dispatchEvent(new Event(type, { bubbles: true, composed: true }));

describe("onClickOutside", () => {
  it("calls the handler, with the event, for a press outside", () => {
    const handler = vi.fn();
    onClickOutside(popup, handler);
    press(outside);
    expect(handler).toHaveBeenCalledOnce();
    expect((handler.mock.calls[0]?.[0] as Event).target).toBe(outside);
  });

  it("does not call it for a press on the element or on anything inside it", () => {
    const handler = vi.fn();
    onClickOutside(popup, handler);
    press(popup);
    press(inner);
    expect(handler).not.toHaveBeenCalled();
  });

  it("accepts several elements, and treats a press inside any of them as inside", () => {
    const handler = vi.fn();
    onClickOutside([popup, outside], handler);
    press(inner);
    press(outside);
    expect(handler).not.toHaveBeenCalled();
    press(document.body);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("tolerates null and undefined entries (refs that are not set yet)", () => {
    const handler = vi.fn();
    onClickOutside([null, undefined, popup], handler);
    press(inner);
    expect(handler).not.toHaveBeenCalled();
    onClickOutside(null, handler);
    press(outside);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("accepts a function, read on every press, for elements that appear later", () => {
    const handler = vi.fn();
    let target: Element | null = null;
    onClickOutside(() => target, handler);
    press(popup);
    expect(handler).toHaveBeenCalledOnce();
    target = popup;
    press(inner);
    expect(handler).toHaveBeenCalledOnce();
    target = null;
    press(inner);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("treats the `ignore` elements as inside (the button that opens the popup)", () => {
    const handler = vi.fn();
    onClickOutside(popup, handler, { ignore: outside });
    press(outside);
    expect(handler).not.toHaveBeenCalled();
    press(document.body);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("returns a function that stops listening, and can be called twice", () => {
    const handler = vi.fn();
    const off = onClickOutside(popup, handler);
    off();
    off();
    press(outside);
    expect(handler).not.toHaveBeenCalled();
  });

  it("listens to pointerdown by default, and to the event you ask for", () => {
    const handler = vi.fn();
    onClickOutside(popup, handler);
    press(outside, "click");
    expect(handler).not.toHaveBeenCalled();

    const onClick = vi.fn();
    onClickOutside(popup, onClick, { event: "click" });
    press(outside, "click");
    press(outside, "pointerdown");
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("listens in the capture phase by default, so stopPropagation cannot hide a press", () => {
    inner.addEventListener("pointerdown", (event) => event.stopPropagation());
    const handler = vi.fn();
    onClickOutside(outside, handler);
    press(inner);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("can listen in the bubble phase instead", () => {
    outside.addEventListener("pointerdown", (event) => event.stopPropagation());
    const handler = vi.fn();
    onClickOutside(popup, handler, { capture: false });
    press(outside);
    expect(handler).not.toHaveBeenCalled();
    press(document.body);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("counts a press on the document itself as outside", () => {
    const handler = vi.fn();
    onClickOutside(popup, handler);
    document.dispatchEvent(new Event("pointerdown"));
    expect(handler).toHaveBeenCalledOnce();
  });

  describe("requireInsideFirst (the legacy BlurListener behaviour)", () => {
    it("is off by default: every press outside calls the handler", () => {
      const handler = vi.fn();
      onClickOutside(popup, handler);
      press(outside);
      press(outside);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("waits for a press inside before the first press outside counts", () => {
      const handler = vi.fn();
      onClickOutside(popup, handler, { requireInsideFirst: true });
      press(outside);
      expect(handler).not.toHaveBeenCalled();
      press(inner);
      press(outside);
      expect(handler).toHaveBeenCalledOnce();
    });

    it("needs a new press inside after each call", () => {
      const handler = vi.fn();
      onClickOutside(popup, handler, { requireInsideFirst: true });
      press(inner);
      press(outside);
      press(outside);
      expect(handler).toHaveBeenCalledOnce();
      press(inner);
      press(outside);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("counts a press on an ignored element as inside", () => {
      const handler = vi.fn();
      onClickOutside(popup, handler, { requireInsideFirst: true, ignore: outside });
      press(outside);
      press(document.body);
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  it("types the event after the event name", () => {
    onClickOutside(popup, (event) => expectTypeOf(event).toEqualTypeOf<PointerEvent>());
    onClickOutside(popup, (event) => expectTypeOf(event).toEqualTypeOf<FocusEvent>(), {
      event: "focusin",
    });
    onClickOutside(popup, (event) => expectTypeOf(event).toEqualTypeOf<PointerEvent>(), {
      event: "click",
    });
    onClickOutside(popup, (event) => expectTypeOf(event).toEqualTypeOf<MouseEvent>(), {
      event: "mousedown",
    });
    expectTypeOf(onClickOutside(popup, () => {})).toEqualTypeOf<() => void>();
  });
});
