/**
 * Copies text to the clipboard, and tells whether it worked instead of throwing or rejecting. It
 * resolves to `false` without a clipboard (a server render, an older browser), outside a secure
 * context (`https` or `localhost`), or when the browser refuses, which it usually does unless the
 * call comes from a user action such as a click.
 *
 * @example
 * ```ts
 * const button = document.createElement("button");
 * button.addEventListener("click", () => {
 *   void copyText("npm install @gabreusi/hyrax").then((copied) => {
 *     button.textContent = copied ? "Copied" : "Press Ctrl+C";
 *   });
 * });
 * ```
 *
 * @param text - The text to copy.
 * @returns A promise of `true` when the text was copied.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
