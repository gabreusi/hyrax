import { useEffect } from "react";
import { onKey } from "../dom/onKey";
import type { OnKeyOptions } from "../dom/onKey";
import { resolveRef } from "./internal/refs";
import type { MaybeRef } from "./internal/refs";
import { useLatest } from "./internal/useLatest";

/** Options for {@link useHotkey}: those of `onKey`, a target, and a switch. */
export interface UseHotkeyOptions extends OnKeyOptions {
  /** Where to listen: an element, a ref to one, or the document. Defaults to `window`. */
  target?: MaybeRef<EventTarget>;
  /** Listen only while this is `true`. Defaults to `true`. */
  enabled?: boolean;
}

/**
 * Calls `handler` when a keyboard shortcut is pressed, for as long as the component is mounted. It
 * is {@link onKey} from `@gabreusi/hyrax/dom`: the same combinations (`"mod+k"`, `"Escape"`, a list
 * of them) and the same rules for fields and `preventDefault`.
 *
 * The handler is read from the latest render, so it does not need a dependency array. A list of
 * combinations can be a new array on every render.
 *
 * @example
 * ```tsx
 * import { useState } from "react";
 *
 * function Palette() {
 *   const [open, setOpen] = useState(false);
 *   useHotkey("mod+k", () => setOpen((value) => !value));
 *   useHotkey("Escape", () => setOpen(false), { enabled: open });
 *   return open ? <dialog open>Search…</dialog> : null;
 * }
 * ```
 *
 * @param combo - A combination, or a list of them.
 * @param handler - Called with the `KeyboardEvent`.
 * @param options - `target`, `enabled`, and the options of `onKey`.
 */
export function useHotkey(
  combo: string | readonly string[],
  handler: (event: KeyboardEvent) => void,
  options: UseHotkeyOptions = {},
): void {
  const { target, enabled = true, event, ignoreInputs, preventDefault, capture } = options;
  const latestHandler = useLatest(handler);
  // A new array with the same combinations must not listen again.
  const combos = typeof combo === "string" ? combo : combo.join("\n");

  useEffect(() => {
    if (!enabled) return;
    const resolved = target === undefined ? globalThis.window : resolveRef(target);
    return onKey(resolved, combos.split("\n"), (pressed) => latestHandler.current(pressed), {
      event,
      ignoreInputs,
      preventDefault,
      capture,
    });
  }, [combos, target, enabled, event, ignoreInputs, preventDefault, capture, latestHandler]);
}
