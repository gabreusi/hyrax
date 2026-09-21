import { describe, expect, it, vi } from "vitest";
import { listen } from "./listen";

const click = () => new MouseEvent("click", { bubbles: true });

describe("listen in a real browser", () => {
  it("removes a capture listener: a removal that forgets the capture flag leaves it attached", () => {
    // happy-dom removes it either way, so only a browser can tell the two implementations apart.
    // The legacy useHTMLEventListener called removeEventListener(type, callback) and leaked these.
    const parent = document.createElement("div");
    const child = document.createElement("button");
    parent.appendChild(child);
    document.body.appendChild(parent);

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

    parent.remove();
  });
});
