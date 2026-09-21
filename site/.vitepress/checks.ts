// Marks each code example with what scripts/check-examples.mjs does to it, so that the page tells
// the truth about its own examples:
//
//   data-check="run"       the example is run, and each `// => literal` is asserted
//   data-check="types"     the example is type-checked against the built package, not run
//   data-check="untested"  the example is skipped (`<!-- untested -->` before the fence)
//
// and turns every `// => value` comment into an answer that the theme sets in the answer column.
// A value the checker asserts (a literal) gets `data-asserted`; prose such as `// => 1 to 6` does not.
import type { MarkdownRenderer } from "vitepress";
import type { ShikiTransformer } from "shiki";
import ts from "typescript";
import { isLiteral } from "../../scripts/examples/assertions.mjs";
import { examplesFor } from "./sheets";

type Token = ReturnType<MarkdownRenderer["parse"]>[number];

/** Whether the fence at `idx` sits under an "Example" heading (TypeDoc's pages also hold signatures). */
function underExampleHeading(tokens: Token[], idx: number): boolean {
  for (let i = idx - 1; i >= 0; i--) {
    if (tokens[i]!.type === "heading_open")
      return /^Examples?$/.test(tokens[i + 1]!.content.trim());
  }
  return false;
}

/** `clamp(value, min, max)` from a TypeDoc signature block such as `function clamp(\n value: number, ...): number;`. */
export function signatureLabel(code: string): string | null {
  const m = /^(?:function\s+|new\s+)?([\w$.]+)\s*(?:<[^()]*>)?\(([\s\S]*?)\)\s*:/.exec(code.trim());
  if (!m) return null;
  const params: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of m[2]!) {
    if ("<([{".includes(char)) depth++;
    if (">)]}".includes(char)) depth--;
    if (char === "," && depth === 0) {
      params.push(current);
      current = "";
    } else current += char;
  }
  params.push(current);
  const names = params
    .map((p) => /^\s*(\.\.\.)?([\w$]+)(\?)?/.exec(p))
    .filter((p) => p !== null)
    .map((p) => `${p[1] ?? ""}${p[2]}${p[3] ?? ""}`);
  return `${m[1]}(${names.join(", ")})`;
}

// TypeDoc titles every overload "Call Signature", so a page with two overloads has two identical
// headings and outline entries. Each one is renamed after its signature.
export function namedOverloads(md: MarkdownRenderer) {
  md.core.ruler.push("hyrax:named-overloads", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const inline = tokens[i + 1];
      if (tokens[i]!.type !== "heading_open" || inline?.content !== "Call Signature") continue;
      const fence = tokens
        .slice(i + 2)
        .find((t) => t.type === "fence" || t.type === "heading_open");
      const label = fence?.type === "fence" ? signatureLabel(fence.content) : null;
      if (!label) continue;
      const code = new state.Token("code_inline", "code", 0);
      code.content = label;
      code.markup = "`";
      inline.content = `\`${label}\``;
      inline.children = [code];
    }
  });
}

// Option and parameter tables list a "Default value" column. It is marked so the theme can set the
// default apart from the option it belongs to.
export function defaultColumns(md: MarkdownRenderer) {
  md.core.ruler.push("hyrax:default-columns", (state) => {
    const tokens = state.tokens;
    let defaultAt = -1;
    let cell = -1;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]!;
      if (token.type === "table_open") defaultAt = -1;
      else if (token.type === "tr_open") cell = -1;
      else if (token.type === "th_open") {
        cell++;
        if (tokens[i + 1]?.content.trim() === "Default value") {
          defaultAt = cell;
          token.attrJoin("class", "hx-default");
        }
      } else if (token.type === "td_open") {
        cell++;
        if (cell === defaultAt) token.attrJoin("class", "hx-default");
      }
    }
  });
}

// The facts row (what the page documents, where it runs, what it costs, how its examples are
// checked) sits under the title of every page. It is a component, so the markdown only has to say
// where: right after the first h1.
export function pageFacts(md: MarkdownRenderer) {
  md.core.ruler.push("hyrax:page-facts", (state) => {
    const tokens = state.tokens;
    const close = tokens.findIndex(
      (t, i) => t.type === "heading_close" && tokens[i - 2]?.tag === "h1",
    );
    if (close < 0) return;
    const facts = new state.Token("html_block", "", 0);
    facts.content = "<PageFacts />\n";
    tokens.splice(close + 1, 0, facts);
  });
}

export function checkedExamples(md: MarkdownRenderer) {
  const fence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const html = fence(tokens, idx, options, env, self);
    const token = tokens[idx]!;
    const lang = /^[\w-]+/.exec(token.info.trim())?.[0];
    if (lang !== "ts" && lang !== "tsx") return html;

    const relativePath = (env as { relativePath?: string }).relativePath ?? "";
    let state = examplesFor(relativePath);
    if (!state) return html;
    if (relativePath.startsWith("api/") && !underExampleHeading(tokens, idx)) return html;
    const previous = tokens[idx - 1];
    if (previous?.type === "html_block" && previous.content.trim() === "<!-- untested -->") {
      state = "untested";
    }
    return html.replace(/^<div class="language-/, `<div data-check="${state}" class="language-`);
  };
}

function asserted(value: string): boolean {
  const parsed = ts.createSourceFile("answer.ts", `(${value})`, ts.ScriptTarget.ES2022, false);
  const [only] = parsed.statements;
  // parseDiagnostics is internal to TypeScript, and it is what the checker reads too.
  const diagnostics = (parsed as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics;
  return (
    diagnostics.length === 0 &&
    parsed.statements.length === 1 &&
    !!only &&
    ts.isExpressionStatement(only) &&
    isLiteral(only.expression)
  );
}

type Hast = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: Hast[];
};

const textOf = (node: Hast): string =>
  node.type === "text" ? (node.value ?? "") : (node.children ?? []).map(textOf).join("");

const span = (
  className: string,
  children: Hast[],
  properties: Record<string, unknown> = {},
): Hast => ({
  type: "element",
  tagName: "span",
  properties: { class: className, ...properties },
  children,
});

export const answerColumn: ShikiTransformer = {
  name: "hyrax:answer-column",
  line(node) {
    const children = node.children as Hast[];
    const full = children.map(textOf).join("");
    const at = full.search(/\/\/ =>/);
    // Only a trailing comment after code: a line that is all comment is prose.
    if (at <= 0 || full.slice(0, at).trim() === "") return;

    const kept: Hast[] = [];
    let pos = 0;
    for (const child of children) {
      const text = textOf(child);
      if (pos + text.length <= at) {
        kept.push(child);
        pos += text.length;
        continue;
      }
      const head = text.slice(0, at - pos);
      if (head) kept.push({ ...child, children: [{ type: "text", value: head }] });
      break;
    }
    // Drop the spaces between the statement and the comment: the column does the spacing.
    const last = kept.at(-1);
    if (last) {
      const trimmed = textOf(last).replace(/\s+$/, "");
      kept[kept.length - 1] =
        last.type === "text"
          ? { type: "text", value: trimmed }
          : { ...last, children: [{ type: "text", value: trimmed }] };
    }

    const value = full
      .slice(at)
      .replace(/^\/\/ =>\s*/, "")
      .trimEnd();
    const isAsserted = asserted(value);
    kept.push(
      span(
        "hx-answer",
        [
          span("hx-answer-op", [{ type: "text", value: "// =>" }]),
          { type: "text", value: " " },
          span("hx-answer-value", [{ type: "text", value }]),
        ],
        isAsserted ? { "data-asserted": "" } : {},
      ),
    );
    node.children = kept as typeof node.children;
    this.addClassToHast(node, "hx-answer-line");
  },
  // Pads the statements so that the answers of a block line up in one column. A statement longer
  // than WIDEST keeps its answer beside it.
  code(node) {
    const WIDEST = 58;
    const classOf = (line: Hast) => {
      const value = line.properties?.class;
      return Array.isArray(value) ? value.join(" ") : typeof value === "string" ? value : "";
    };
    const lines = (node.children as Hast[]).filter((line) =>
      classOf(line).includes("hx-answer-line"),
    );
    if (lines.length === 0) return;
    const statementLength = (line: Hast) =>
      textOf({ ...line, children: line.children!.slice(0, -1) }).length;
    const lengths = lines.map(statementLength).filter((n) => n <= WIDEST);
    const column = (lengths.length ? Math.max(...lengths) : 0) + 3;
    for (const line of lines) {
      const pad = Math.max(2, column - statementLength(line));
      line.children!.splice(-1, 0, { type: "text", value: " ".repeat(pad) });
    }
    node.properties = { ...node.properties, style: `--hx-answer-column: ${column}ch` };
  },
};
