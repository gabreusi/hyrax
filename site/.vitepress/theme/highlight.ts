// A tiny highlighter for the live code of the labs. It knows only what their snippets use: strings,
// numbers, a few keywords, calls and comments. Everything else, including whatever a reader typed
// into a lab, is escaped and left plain. The colours are the `--hx-tk-*` tokens of style.css.
const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const TOKEN =
  /("(?:[^"\\\n]|\\.)*")|(\/\/.*)|(\b(?:const|let|new|return|import|from|export)\b)|(-?\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\()|([A-Z][\w$]*)/g;

export function highlight(code: string): string {
  let out = "";
  let last = 0;
  for (const m of code.matchAll(TOKEN)) {
    out += escapeHtml(code.slice(last, m.index));
    const [text, str, comment, keyword, num, call, type] = m;
    const kind = str
      ? "s"
      : comment
        ? "c"
        : keyword
          ? "k"
          : num
            ? "n"
            : call
              ? "f"
              : type
                ? "t"
                : "";
    out += `<span class="tk-${kind}">${escapeHtml(text)}</span>`;
    last = m.index + text.length;
  }
  return out + escapeHtml(code.slice(last));
}

/** A value as the docs write it: `"text"`, `[1, 2, 3]`, `12.5`. */
export function literal(value: unknown): string {
  return JSON.stringify(value)?.replace(/,/g, ", ") ?? String(value);
}
