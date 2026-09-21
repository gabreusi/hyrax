import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { listen } from "./listen";

const click = () => new MouseEvent("click", { bubbles: true });

describe("listen", () => {
  it("calls the handler with the event", () => {
    const button = document.createElement("button");
    const handler = vi.fn();
    listen(button, "click", handler);
    const event = click();
    button.dispatchEvent(event);
    expect(handler).toHaveBeenCalledExactlyOnceWith(event);
  });

  it("returns a function that removes the listener", () => {
    const button = document.createElement("button");
    const handler = vi.fn();
    const off = listen(button, "click", handler);
    off();
    button.dispatchEvent(click());
    expect(handler).not.toHaveBeenCalled();
  });

  it("can be undone more than once without touching other listeners", () => {
    const button = document.createElement("button");
    const first = vi.fn();
    const second = vi.fn();
    const off = listen(button, "click", first);
    listen(button, "click", second);
    off();
    off();
    button.dispatchEvent(click());
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it("removes a capture listener too (the legacy hook never did)", () => {
    const parent = document.createElement("div");
    const child = document.createElement("button");
    parent.appendChild(child);
    const handler = vi.fn();
    const offBoolean = listen(parent, "click", handler, true);
    child.dispatchEvent(click());
    expect(handler).toHaveBeenCalledOnce();
    offBoolean();
    child.dispatchEvent(click());
    expect(handler).toHaveBeenCalledOnce();

    const offObject = listen(parent, "click", handler, { capture: true });
    offObject();
    child.dispatchEvent(click());
    expect(handler).toHaveBeenCalledOnce();
  });

  it("runs capture listeners before bubbling ones", () => {
    const parent = document.createElement("div");
    const child = document.createElement("button");
    parent.appendChild(child);
    const order: string[] = [];
    listen(parent, "click", () => order.push("bubble"));
    listen(parent, "click", () => order.push("capture"), { capture: true });
    child.dispatchEvent(click());
    expect(order).toEqual(["capture", "bubble"]);
  });

  it("passes the other options through", () => {
    const button = document.createElement("button");
    const once = vi.fn();
    listen(button, "click", once, { once: true });
    button.dispatchEvent(click());
    button.dispatchEvent(click());
    expect(once).toHaveBeenCalledOnce();

    const aborted = vi.fn();
    const controller = new AbortController();
    listen(button, "click", aborted, { signal: controller.signal });
    controller.abort();
    button.dispatchEvent(click());
    expect(aborted).not.toHaveBeenCalled();
  });

  it("works with window and document", () => {
    const onWindow = vi.fn();
    const onDocument = vi.fn();
    const offWindow = listen(window, "resize", onWindow);
    const offDocument = listen(document, "visibilitychange", onDocument);
    window.dispatchEvent(new Event("resize"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(onWindow).toHaveBeenCalledOnce();
    expect(onDocument).toHaveBeenCalledOnce();
    offWindow();
    offDocument();
    window.dispatchEvent(new Event("resize"));
    expect(onWindow).toHaveBeenCalledOnce();
  });

  it("works with any EventTarget and custom events", () => {
    const bus = new EventTarget();
    const handler = vi.fn();
    const off = listen(bus, "ping", handler);
    bus.dispatchEvent(new Event("ping"));
    expect(handler).toHaveBeenCalledOnce();
    off();
  });

  it("does nothing, and still returns a function, for a missing target (a ref that is not set yet, or SSR)", () => {
    const handler = vi.fn();
    expect(() => listen(null, "click", handler)()).not.toThrow();
    expect(() => listen(undefined, "click", handler)()).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it("types the event after the target and the event name", () => {
    const button = document.createElement("button");
    listen(button, "click", (event) => expectTypeOf(event).toEqualTypeOf<PointerEvent>());
    listen(button, "keydown", (event) => expectTypeOf(event).toEqualTypeOf<KeyboardEvent>());
    listen(window, "resize", (event) => expectTypeOf(event).toEqualTypeOf<UIEvent>());
    listen(document, "visibilitychange", (event) => expectTypeOf(event).toEqualTypeOf<Event>());
    listen(new EventTarget(), "anything", (event) => expectTypeOf(event).toEqualTypeOf<Event>());
    expectTypeOf(listen(button, "click", () => {})).toEqualTypeOf<() => void>();
  });
});
