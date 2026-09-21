import { resolveVars } from "./internal/vars";

/** Words that are valid CSS for a margin but are not a length, so they measure as `0`. */
const NOT_A_LENGTH = /^(auto|inherit|initial|unset|revert|revert-layer)$/i;

/** A resolved length as browsers report it: a number followed by `px`. */
const PIXELS = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?px$/i;

/**
 * The measuring element. It has no margin of its own on purpose: the value under test goes into
 * `margin-left`, which unlike `width` accepts negative lengths, and reading it back is how we know
 * whether the browser rejected the value.
 */
const PROBE_STYLE =
  "display:block;height:0;overflow:hidden;visibility:hidden;pointer-events:none;padding:0;border:0;box-sizing:content-box;";

/**
 * Converts a CSS length into pixels by letting the browser lay it out: `em` uses the font size of
 * `element`, `%` uses its width, `rem`, `vw`, `dvh` and friends use the root and the viewport, and
 * `calc()`, `min()`, `max()` and `clamp()` are computed. `var(--name)` and a bare `--name` read the
 * custom property from `element`, so scoped values win.
 *
 * It needs a layout engine: in a browser it works, and without a document (server-side rendering)
 * it returns `NaN`. Pass an element that is rendered (not `display: none`, not detached), or `%`
 * has nothing to resolve against.
 *
 * @example
 * ```ts
 * toPixels("2em"); // => 32 when the page font size is 16px
 * toPixels("50%", container); // => half the width of `container`
 * toPixels("calc(100vh - var(--header))"); // => a number of pixels
 * toPixels("--gap"); // the same as toPixels("var(--gap)")
 * toPixels(12); // => 12 (a number is already pixels)
 * ```
 *
 * @param value - A CSS length, a `--custom-property` name, or a number of pixels.
 * @param element - Where to measure: the context of `em`, `%` and custom properties. Defaults to
 *   `<body>`.
 * @returns The size in pixels (possibly negative or fractional), or `NaN` when it cannot be
 *   resolved: no document, an invalid value, a keyword such as `auto`, an undefined `var()` with
 *   no fallback, or an element that is not rendered.
 */
export function toPixels(value: string | number, element?: Element): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof document === "undefined") return NaN;

  const context = element ?? document.body;
  if (!context) return NaN;

  const trimmed = value.trim();
  const style = getComputedStyle(context);
  const resolved = resolveVars(trimmed.startsWith("--") ? `var(${trimmed})` : trimmed, (name) =>
    style.getPropertyValue(name).trim(),
  );
  // A var() left to the browser that fails to resolve just makes the property "not set", and the
  // measurement would silently return something else: that is why we resolve it ourselves.
  if (resolved === null || resolved === "" || NOT_A_LENGTH.test(resolved)) return NaN;

  const probe = document.createElement("div");
  probe.style.cssText = PROBE_STYLE;
  probe.style.marginLeft = resolved;
  if (probe.style.marginLeft === "") return NaN;

  context.appendChild(probe);
  try {
    const margin = getComputedStyle(probe).marginLeft;
    return PIXELS.test(margin) ? Number.parseFloat(margin) : NaN;
  } finally {
    probe.remove();
  }
}
