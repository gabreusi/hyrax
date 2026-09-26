import { afterEach, describe, expect, it, vi } from "vitest";
import { onKey } from "./onKey";

const press = (init: KeyboardEventInit, target: EventTarget = window) => {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("onKey", () => {
  it("matches a key with its modifiers exactly", () => {
    const handler = vi.fn();
    const off = onKey(window, "ctrl+k", handler);
    press({ key: "k" });
    press({ key: "k", ctrlKey: true, shiftKey: true });
    expect(handler).not.toHaveBeenCalled();
    press({ key: "K", ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
    off();
    press({ key: "k", ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("reads mod as ⌘ on Apple devices and Ctrl elsewhere", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel", userAgent: "" });
    const mac = vi.fn();
    const offMac = onKey(window, "mod+s", mac);
    press({ key: "s", ctrlKey: true });
    press({ key: "s", metaKey: true });
    expect(mac).toHaveBeenCalledTimes(1);
    offMac();

    vi.stubGlobal("navigator", { platform: "Win32", userAgent: "" });
    const pc = vi.fn();
    onKey(window, "mod+s", pc);
    press({ key: "s", metaKey: true });
    press({ key: "s", ctrlKey: true });
    expect(pc).toHaveBeenCalledTimes(1);
  });

  it("accepts a list, aliases and named keys", () => {
    const handler = vi.fn();
    onKey(window, ["Esc", "ctrl+Enter", "space", "shift+up"], handler);
    press({ key: "Escape" });
    press({ key: "Enter", ctrlKey: true });
    press({ key: " " });
    press({ key: "ArrowUp", shiftKey: true });
    expect(handler).toHaveBeenCalledTimes(4);
  });

  it("matches letters and digits by physical key when the character changes", () => {
    const handler = vi.fn();
    onKey(window, ["alt+a", "shift+1"], handler);
    press({ key: "å", code: "KeyA", altKey: true });
    press({ key: "!", code: "Digit1", shiftKey: true });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("does not check Shift for a symbol, and handles the + key", () => {
    const handler = vi.fn();
    onKey(window, ["?", "ctrl++"], handler);
    press({ key: "?", shiftKey: true });
    press({ key: "+", ctrlKey: true, shiftKey: true });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("ignores typing keys in fields, but not shortcuts with Ctrl or keys like Escape", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    const handler = vi.fn();
    onKey(window, ["/", "ctrl+k", "escape"], handler);
    press({ key: "/" }, input);
    expect(handler).not.toHaveBeenCalled();
    press({ key: "k", ctrlKey: true }, input);
    press({ key: "Escape" }, input);
    expect(handler).toHaveBeenCalledTimes(2);

    const everywhere = vi.fn();
    onKey(window, "/", everywhere, { ignoreInputs: false });
    press({ key: "/" }, input);
    expect(everywhere).toHaveBeenCalledTimes(1);
  });

  it("prevents the default action of a match, unless told not to", () => {
    onKey(window, "ctrl+s", () => {});
    expect(press({ key: "s", ctrlKey: true }).defaultPrevented).toBe(true);
    expect(press({ key: "x", ctrlKey: true }).defaultPrevented).toBe(false);
    document.body.innerHTML = "";
    const button = document.createElement("button");
    onKey(button, "ctrl+p", () => {}, { preventDefault: false });
    expect(press({ key: "p", ctrlKey: true }, button).defaultPrevented).toBe(false);
  });

  it("listens to keyup when asked", () => {
    const handler = vi.fn();
    onKey(window, "a", handler, { event: "keyup" });
    press({ key: "a" });
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "a" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("never matches a combination with an unknown modifier, and does nothing for null", () => {
    const handler = vi.fn();
    onKey(window, "hyper+k", handler);
    press({ key: "k" });
    expect(handler).not.toHaveBeenCalled();
    expect(() => onKey(null, "k", handler)()).not.toThrow();
  });
});
