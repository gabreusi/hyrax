// Checks every code example in the documentation: the `@example` blocks of the TSDoc in `src/`,
// the ```ts fences of the guides in `site/guide/`, and those of the README.
//
//   npm run build && node scripts/check-examples.mjs
//
// Every example is type-checked against the BUILT package (`@gabreusi/hyrax`, resolved through its
// own `exports`, so the published types are what is checked). Examples of the universal core (and
// the core guides) are also RUN, and a trailing `// => value` becomes an assertion:
//
//   clamp(15, 0, 10); // => 10          asserts clamp(15, 0, 10) deep-equals 10
//   const x = lerp(0, 10, 0.5); // => 5  asserts x deep-equals 5
//   rng.int(1, 6); // => 1 to 6         prose, not a literal: no assertion, the line still runs
//
// The expected value must be a literal (number, string, boolean, null, undefined, NaN, Infinity,
// an array or an object of those). Anything else after `=>` is prose. `/dom` and `/react` examples
// need a browser or a component to mean anything, so they are type-checked only.
//
// Conventions for writing an example: Hyrax names are in scope (they are imported for you), every
// other import is written out, and the snippet declares whatever else it uses. In a guide, put
// `<!-- untested -->` on the line before a fence to skip it.
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { withAssertions } from "./examples/assertions.mjs";

const ROOT = process.cwd();
const OUT = join(ROOT, ".examples");
const NAME = "@gabreusi/hyrax";
const ENTRYPOINTS = [
  { specifier: NAME, dts: "dist/index.d.ts" },
  { specifier: `${NAME}/dom`, dts: "dist/dom.d.ts" },
  { specifier: `${NAME}/react`, dts: "dist/react.d.ts" },
];
// Guides whose examples need a DOM or a component: type-checked, not run.
const TYPES_ONLY_GUIDES = new Set(["dom.md", "react.md"]);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

/** The examples inside the TSDoc of one source file. */
function fromSource(file) {
  const rel = relative(ROOT, file);
  const text = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true);
  const tier = rel.startsWith("src/core/") || rel === "src/index.ts" ? "run" : "types";
  const found = [];
  const visit = (node) => {
    for (const doc of node.jsDoc ?? []) {
      for (const tag of doc.tags ?? []) {
        if (tag.tagName.text !== "example") continue;
        const comment = ts.getTextOfJSDocComment(tag.comment) ?? "";
        const { line } = sf.getLineAndCharacterOfPosition(tag.getStart());
        for (const m of comment.matchAll(/```(?:ts|tsx)[^\n]*\n([\s\S]*?)```/g)) {
          found.push({ where: `${rel}:${line + 1}`, tier, code: m[1] });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** The ```ts fences of one guide, except those marked `<!-- untested -->`. */
function fromGuide(file) {
  const rel = relative(ROOT, file);
  const tier = TYPES_ONLY_GUIDES.has(basename(file)) ? "types" : "run";
  const lines = readFileSync(file, "utf8").split("\n");
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    const open = /^```(ts|tsx)\b/.exec(lines[i]);
    if (!open) continue;
    let end = i + 1;
    while (end < lines.length && !lines[end].startsWith("```")) end++;
    let before = i - 1;
    while (before >= 0 && lines[before].trim() === "") before--;
    if (before < 0 || lines[before].trim() !== "<!-- untested -->") {
      found.push({
        where: `${rel}:${i + 1}`,
        tier,
        code: lines.slice(i + 1, end).join("\n") + "\n",
      });
    }
    i = end;
  }
  return found;
}

/** Names exported by an entrypoint (types included), read from its declaration file. */
function exportedNames(dts) {
  const program = ts.createProgram([join(ROOT, dts)], {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
  });
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(join(ROOT, dts));
  const symbol = checker.getSymbolAtLocation(sf);
  return new Set(checker.getExportsOfModule(symbol).map((s) => s.name));
}

/** Identifiers a snippet declares itself, so a Hyrax name it shadows is not imported over it. */
function declaredNames(sf) {
  const names = new Set();
  const bind = (name) => {
    if (ts.isIdentifier(name)) names.add(name.text);
    else name.elements.forEach((e) => !ts.isOmittedExpression(e) && bind(e.name));
  };
  const visit = (node) => {
    if (
      (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) &&
      node.name
    ) {
      bind(node.name);
    }
    if (ts.isImportSpecifier(node)) names.add(node.name.text);
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) {
      names.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return names;
}

function usedIdentifiers(sf) {
  const used = new Set();
  const visit = (node) => {
    if (ts.isIdentifier(node)) used.add(node.text);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return used;
}

let assertions = 0;
const exportsByEntrypoint = ENTRYPOINTS.map((e) => ({ ...e, names: exportedNames(e.dts) }));

/** The module to check for one example: Hyrax names imported, the rest as the snippet wrote it. */
function build(example, forRun) {
  const sf = ts.createSourceFile(
    "snippet.tsx",
    example.code,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX,
  );
  // Hyrax names are imported for the snippet, unless it imports from that entrypoint itself.
  const imported = new Set(
    sf.statements.filter(ts.isImportDeclaration).map((s) => s.moduleSpecifier.text),
  );
  const header = [];
  const skip = declaredNames(sf);
  const used = usedIdentifiers(sf);
  for (const { specifier, names } of exportsByEntrypoint) {
    if (imported.has(specifier)) continue;
    const wanted = [...names].filter((n) => used.has(n) && !skip.has(n));
    if (wanted.length) header.push(`import { ${wanted.join(", ")} } from "${specifier}";`);
  }
  if (forRun) header.push(`import { deepStrictEqual as __eq } from "node:assert/strict";`);
  if (forRun)
    header.push(`const __expect = (actual: unknown, expected: unknown) => __eq(actual, expected);`);
  const asserted = forRun ? withAssertions(example.code, example.where) : null;
  const body = asserted ? asserted.code : example.code;
  assertions += asserted ? asserted.assertions : 0;
  return { text: `${header.join("\n")}\n${body}\nexport {};\n`, offset: header.length };
}

const examples = [
  ...[...walk(join(ROOT, "src"))]
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.includes("/internal/"))
    .flatMap(fromSource),
  ...fromGuide(join(ROOT, "README.md")),
  ...(statSync(join(ROOT, "site/guide"), { throwIfNoEntry: false })
    ? [...walk(join(ROOT, "site/guide"))].filter((f) => f.endsWith(".md")).flatMap(fromGuide)
    : []),
];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const files = new Map(); // generated path -> { example, offset }
examples.forEach((example, i) => {
  const { text, offset } = build(example, example.tier === "run");
  const path = join(OUT, `example-${String(i).padStart(3, "0")}.tsx`);
  writeFileSync(path, text);
  files.set(path, { example, offset });
});

// 1. Type-check everything, against the built package.
const options = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  types: ["node"],
};
const program = ts.createProgram([...files.keys()], options);
const failures = [];
for (const d of ts.getPreEmitDiagnostics(program)) {
  const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
  const entry = d.file && files.get(d.file.fileName);
  if (!entry) {
    failures.push(`(setup) ${message}`);
    continue;
  }
  const { line } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
  failures.push(
    `${entry.example.where} (line ${line + 1 - entry.offset} of the example): TS${d.code} ${message}`,
  );
}

// 2. Run the ones that can run.
let ran = 0;
if (failures.length === 0) {
  for (const [path, { example }] of files) {
    if (example.tier !== "run") continue;
    const source = readFileSync(path, "utf8");
    const js = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    const runnable = path.replace(/\.tsx$/, ".mjs");
    writeFileSync(runnable, js);
    try {
      await import(pathToFileURL(runnable).href);
      ran++;
    } catch (error) {
      failures.push(`${example.where}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

rmSync(OUT, { recursive: true, force: true });

const runCount = examples.filter((e) => e.tier === "run").length;
if (failures.length > 0) {
  console.error(`${failures.length} example problem(s):\n\n${failures.join("\n\n")}`);
  process.exit(1);
}
console.log(
  `Examples passed: ${examples.length} type-checked, ${ran} of ${runCount} run with ${assertions} assertions (the rest need a DOM or React).`,
);
process.exit(0);
