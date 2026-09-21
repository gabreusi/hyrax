/** How deep `var()` may point to another `var()` before it is treated as a cycle. */
const MAX_DEPTH = 10;

const VAR_CALL = /(?<![\w-])var\(/g;

/** The index of the `)` that closes the `(` at `open`, or -1. */
function closingParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return i;
  }
  return -1;
}

/** The index of the first comma that is not inside nested parentheses, or -1. */
function topLevelComma(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") depth--;
    else if (text[i] === "," && depth === 0) return i;
  }
  return -1;
}

/**
 * Replaces every `var(--name)` and `var(--name, fallback)` in a CSS value with what the custom
 * property holds. The browser's own substitution is not used because it cannot tell us that a
 * property was missing: a `var()` that fails to resolve just makes the property behave as if it
 * had not been set, and a measurement would silently return the wrong size.
 *
 * @param value - A CSS value, possibly containing `var()` calls.
 * @param read - Returns the value of a custom property, or `undefined`/`""` when it is not set.
 * @param depth - Used by the recursion: how many `var()` levels deep this call is.
 * @returns The value with every `var()` replaced, or `null` when one cannot be resolved (missing
 *   property with no fallback, malformed call, or a cycle).
 */
export function resolveVars(
  value: string,
  read: (name: string) => string | undefined,
  depth = 0,
): string | null {
  if (depth > MAX_DEPTH) return null;

  let out = "";
  let from = 0;
  VAR_CALL.lastIndex = 0;
  for (let match = VAR_CALL.exec(value); match !== null; match = VAR_CALL.exec(value)) {
    const open = match.index + 3;
    const close = closingParen(value, open);
    if (close === -1) return null;

    const inner = value.slice(open + 1, close);
    const comma = topLevelComma(inner);
    const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma === -1 ? "" : inner.slice(comma + 1).trim();
    if (!/^--[^\s,()]+$/.test(name)) return null;

    const held = read(name);
    const source = held !== undefined && held !== "" ? held : fallback;
    if (source === "") return null;
    const replacement = resolveVars(source, read, depth + 1);
    if (replacement === null) return null;

    out += value.slice(from, match.index) + replacement;
    from = close + 1;
    VAR_CALL.lastIndex = from;
  }
  return out + value.slice(from);
}
