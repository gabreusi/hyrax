/** A value for a custom property: `null`, `undefined` and a number that is not finite remove it. */
export type CSSVarValue = string | number | null | undefined;

/** Where custom properties are written: any element with an inline style, or nothing. */
export type CSSVarTarget = ElementCSSInlineStyle | null | undefined;

function write(style: CSSStyleDeclaration, name: string, value: CSSVarValue): void {
  if (value == null || (typeof value === "number" && !Number.isFinite(value))) {
    style.removeProperty(name);
  } else {
    style.setProperty(name, String(value));
  }
}

/**
 * Sets a CSS custom property in the inline style of `element`, the document root (`<html>`) by
 * default, where {@link getCSSVar} reads it. A number is written as it is, with no unit, like React
 * does for custom properties (`12`, not `12px`), so it also works for unitless values such as an
 * opacity. `null`, `undefined` or a number that is not finite remove the property instead of
 * writing `"null"` or `"NaN"`. Without a document (server-side rendering), or with a `null`
 * element, it does nothing.
 *
 * @example
 * ```ts
 * setCSSVar("--accent", "#ff5a1f");
 * setCSSVar("--columns", 3);
 * setCSSVar("--accent", null); // removes it
 * ```
 *
 * @param name - The property name, such as `"--accent"`.
 * @param value - The value to write, or `null`/`undefined` to remove the property.
 * @param element - Where to write it. Defaults to `<html>`.
 */
export function setCSSVar(name: string, value: CSSVarValue, element?: CSSVarTarget): void;
/**
 * Sets several custom properties at once, with the same rules as the single form.
 *
 * @example
 * ```ts
 * const panel = document.createElement("div");
 * setCSSVar({ "--gap": "12px", "--columns": 3, "--old": null }, panel);
 * panel.style.getPropertyValue("--columns"); // => "3"
 * ```
 *
 * @param values - Maps each property name to its value.
 * @param element - Where to write them. Defaults to `<html>`.
 */
export function setCSSVar(
  values: Readonly<Record<string, CSSVarValue>>,
  element?: CSSVarTarget,
): void;
export function setCSSVar(
  first: string | Readonly<Record<string, CSSVarValue>>,
  second?: CSSVarValue | CSSVarTarget,
  third?: CSSVarTarget,
): void {
  if (typeof document === "undefined") return;
  const element = typeof first === "string" ? third : (second as CSSVarTarget);
  // An explicit `null` element means "not there yet" (an unset ref): do nothing.
  if (element === null) return;
  const { style } = element ?? document.documentElement;

  if (typeof first === "string") write(style, first, second as CSSVarValue);
  else for (const [name, value] of Object.entries(first)) write(style, name, value);
}
