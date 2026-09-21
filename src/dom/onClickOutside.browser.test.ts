import { userEvent } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { onClickOutside } from "./onClickOutside";

afterEach(() => {
  document.body.innerHTML = "";
});

/** A visible button at a fixed position, so a real click can hit it. */
const button = (label: string, top: number) => {
  const element = document.createElement("button");
  element.textContent = label;
  element.style.cssText = `position:fixed;left:10px;top:${top}px;width:120px;height:40px`;
  document.body.appendChild(element);
  return element;
};

describe("onClickOutside with real mouse clicks", () => {
  it("fires once for a click on a button outside, and not for one inside", async () => {
    const inside = button("inside", 10);
    const outside = button("outside", 100);
    const handler = vi.fn();
    onClickOutside(inside, handler);
    await userEvent.click(inside);
    expect(handler).not.toHaveBeenCalled();
    await userEvent.click(outside);
    expect(handler).toHaveBeenCalledOnce();
    expect((handler.mock.calls[0]?.[0] as PointerEvent).target).toBe(outside);
  });

  it("handles the classic toggle: `ignore` keeps the opener from closing and reopening the popup", async () => {
    const popup = button("popup", 10);
    const opener = button("opener", 100);
    const handler = vi.fn();
    onClickOutside(popup, handler, { ignore: opener });
    await userEvent.click(opener);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("onClickOutside when the DOM changes during the event", () => {
  it("still counts a press as inside when its element was removed by an earlier handler", async () => {
    // A click that removes the clicked node (a list item that deletes itself). Asking the DOM
    // `popup.contains(target)` afterwards says "outside"; the event path, fixed at dispatch, does not.
    const popup = document.createElement("div");
    popup.style.cssText = "position:fixed;left:10px;top:10px;width:160px;height:60px";
    const item = document.createElement("button");
    item.style.cssText = "width:150px;height:50px";
    popup.appendChild(item);
    document.body.appendChild(popup);
    item.addEventListener("pointerdown", () => item.remove());
    const handler = vi.fn();
    onClickOutside(popup, handler, { capture: false });
    await userEvent.click(item);
    expect(item.isConnected).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("onClickOutside with Shadow DOM", () => {
  const withShadow = (mode: "open" | "closed") => {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:10px;top:10px;width:160px;height:60px";
    const root = host.attachShadow({ mode });
    const inner = document.createElement("button");
    inner.textContent = "in the shadow";
    inner.style.cssText = "width:150px;height:50px";
    root.appendChild(inner);
    document.body.appendChild(host);
    return { host, inner };
  };

  it("retargets an event from inside a shadow tree to its host, which is why the event path is used", () => {
    const { host, inner } = withShadow("open");
    let seenTarget: EventTarget | null = null;
    document.addEventListener("pointerdown", (event) => (seenTarget = event.target), {
      once: true,
    });
    inner.dispatchEvent(new Event("pointerdown", { bubbles: true, composed: true }));
    expect(seenTarget).toBe(host);
  });

  it("counts a click inside an open shadow tree as inside its host", async () => {
    const { host, inner } = withShadow("open");
    const outside = button("outside", 200);
    const handler = vi.fn();
    onClickOutside(host, handler);
    await userEvent.click(inner);
    expect(handler).not.toHaveBeenCalled();
    await userEvent.click(outside);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("counts a press inside a closed shadow tree as inside its host, too", () => {
    // userEvent cannot locate an element inside a closed root, so the press is dispatched.
    const { host, inner } = withShadow("closed");
    const outside = button("outside", 200);
    const handler = vi.fn();
    onClickOutside(host, handler);
    inner.dispatchEvent(new Event("pointerdown", { bubbles: true, composed: true }));
    expect(handler).not.toHaveBeenCalled();
    outside.dispatchEvent(new Event("pointerdown", { bubbles: true, composed: true }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("finds an element that lives inside a shadow tree as the inside target", () => {
    const { inner } = withShadow("open");
    const outside = button("outside", 200);
    const handler = vi.fn();
    onClickOutside(inner, handler);
    inner.dispatchEvent(new Event("pointerdown", { bubbles: true, composed: true }));
    expect(handler).not.toHaveBeenCalled();
    outside.dispatchEvent(new Event("pointerdown", { bubbles: true, composed: true }));
    expect(handler).toHaveBeenCalledOnce();
  });
});
