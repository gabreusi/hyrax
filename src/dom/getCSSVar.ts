/**
 * Reads the value of a CSS custom property from the document root (`<html>`), trimmed. Without a
 * document (server-side rendering) it returns the fallback instead of throwing.
 *
 * @example
 * ```ts
 * // :root { --primary: #3498db; }
 * getCSSVar("--primary"); // => "#3498db"
 * getCSSVar("--missing"); // => null
 * getCSSVar("--missing", "red"); // => "red"
 * ```
 *
 * @param name - The property name, such as `"--primary"`.
 * @returns The trimmed value, or `null` when it is not defined.
 */
export function getCSSVar(name: string): string | null;
/**
 * Reads the value of a CSS custom property from the document root, or returns `fallback` when it
 * is not defined, empty, or there is no document.
 *
 * @example
 * ```ts
 * getCSSVar("--gap", 16); // => "12px" when defined, otherwise 16
 * ```
 *
 * @param name - The property name, such as `"--gap"`.
 * @param fallback - What to return when the property is missing (any type).
 * @returns The trimmed value, or `fallback`.
 */
export function getCSSVar<T>(name: string, fallback: T): string | T;
export function getCSSVar(name: string, fallback: unknown = null): unknown {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value === "" ? fallback : value;
}
