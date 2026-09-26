import { listen } from "./listen";

/** Options for {@link onKey}. */
export interface OnKeyOptions {
  /** Which event to listen to. Defaults to `"keydown"`. */
  event?: "keydown" | "keyup";
  /**
   * Skip a combination that types a character (a single key with no Ctrl, Alt or ⌘) while the user
   * is typing in a field, so `"/"` does not fire from a search box. Defaults to `true`.
   */
  ignoreInputs?: boolean;
  /** Call `preventDefault()` on a matching event, so `mod+s` does not open "Save page". Defaults to `true`. */
  preventDefault?: boolean;
  /** Listen in the capture phase. Defaults to `false`. */
  capture?: boolean;
}

interface Combo {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

const ALIASES: Record<string, string> = {
  esc: "escape",
  space: " ",
  spacebar: " ",
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  del: "delete",
  return: "enter",
  plus: "+",
};

function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}

/** Reads `"mod+shift+k"`. An unknown modifier gives a combination that never matches. */
function parse(text: string, mac: boolean): Combo | null {
  // Split on a `+` followed by something, so `"mod++"` is `mod` and `+`.
  const tokens = text
    .toLowerCase()
    .split(/\+(?=.)/)
    .map((token) => token.trim());
  const last = tokens.pop() ?? "";
  const combo: Combo = {
    key: ALIASES[last] ?? last,
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
  };
  for (const token of tokens) {
    if (token === "ctrl" || token === "control") combo.ctrl = true;
    else if (token === "alt" || token === "option") combo.alt = true;
    else if (token === "shift") combo.shift = true;
    else if (token === "meta" || token === "cmd" || token === "command") combo.meta = true;
    else if (token === "mod") combo[mac ? "meta" : "ctrl"] = true;
    else return null;
  }
  return combo;
}

function matches(event: KeyboardEvent, combo: Combo): boolean {
  if (event.ctrlKey !== combo.ctrl || event.altKey !== combo.alt || event.metaKey !== combo.meta) {
    return false;
  }
  // A symbol such as `?` needs Shift on most layouts: unless asked for, Shift is not checked.
  const symbol = combo.key.length === 1 && !/[a-z0-9]/.test(combo.key);
  if (!symbol && event.shiftKey !== combo.shift) return false;
  if (event.key.toLowerCase() === combo.key) return true;
  // With Alt or Shift the character changes (`Alt+A` types `å`, `Shift+1` types `!`): the physical
  // key still says which letter or digit it is.
  return (
    /^[a-z0-9]$/.test(combo.key) &&
    event.code.toLowerCase() === (/\d/.test(combo.key) ? "digit" : "key") + combo.key
  );
}

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(
    element?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element?.tagName ?? ""),
  );
}

/**
 * Calls `handler` when a keyboard shortcut is pressed, and returns the function that stops
 * listening. A combination is modifiers and a key joined by `+`, in any case: `"mod+k"`,
 * `"shift+?"`, `"Escape"`, `"ctrl+alt+Delete"`. `mod` is ⌘ on Apple devices and Ctrl elsewhere,
 * which is what most apps mean. A list of combinations matches any of them.
 *
 * Modifiers must match exactly, so `"k"` does not fire on Ctrl+K. Keys are compared by what they
 * type and, for letters and digits, by the physical key, so `"alt+a"` works on a Mac and
 * `"shift+1"` works on any layout. The aliases `esc`, `space`, `up`, `down`, `left`, `right`, `del`,
 * `return` and `plus` are understood.
 *
 * @example
 * ```ts
 * const off = onKey(window, "mod+k", () => console.log("open the palette"));
 * onKey(document, ["Escape", "mod+."], () => console.log("close"));
 * off();
 * ```
 *
 * @param target - Where to listen: the window, the document, an element, or `null` (nothing).
 * @param combo - A combination, or a list of them.
 * @param handler - Called with the `KeyboardEvent`.
 * @param options - `event`, `ignoreInputs`, `preventDefault` and `capture`.
 * @returns A function that stops listening. Calling it again does nothing.
 */
export function onKey(
  target: EventTarget | null | undefined,
  combo: string | readonly string[],
  handler: (event: KeyboardEvent) => void,
  {
    event = "keydown",
    ignoreInputs = true,
    preventDefault = true,
    capture = false,
  }: OnKeyOptions = {},
): () => void {
  const mac = isMac();
  const combos = (typeof combo === "string" ? [combo] : combo)
    .map((text) => parse(text, mac))
    .filter((parsed): parsed is Combo => parsed !== null);

  return listen(
    target,
    event,
    (raw) => {
      const pressed = raw as KeyboardEvent;
      if (typeof pressed.key !== "string") return;
      const match = combos.find((candidate) => matches(pressed, candidate));
      if (!match) return;
      const types = match.key.length === 1 && !match.ctrl && !match.alt && !match.meta;
      if (ignoreInputs && types && isTyping(pressed.target)) return;
      if (preventDefault) pressed.preventDefault();
      handler(pressed);
    },
    capture,
  );
}
