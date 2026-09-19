// Installs the library tarball into a clean directory and imports every
// entrypoint through ESM and CJS, exactly as a consumer would.
//
//   node scripts/smoke.mjs [path/to/tarball.tgz]   (packs the repo when omitted)
//   HYRAX_SMOKE_RUNTIMES=deno,bun node scripts/smoke.mjs   (also checks those runtimes)
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const NAME = "@gabreusi/hyrax";
const entrypoints = [NAME, `${NAME}/dom`, `${NAME}/react`];

// A real TypeScript consumer of the public API. `@ts-expect-error` lines make the
// compile fail if the types ever become looser than intended.
const CONSUMER = `
import { alias, clamp, fabricate, isNumeric, toCamelCase, traceHierarchy } from "${NAME}";
import type { Maybe, Numeric } from "${NAME}";

const aliased = alias({ name: "Alice", age: 30 }, { age: ["years"] as const });
export const years: number = aliased.years;
export const limited: number = clamp(15, 0, 10);
export const camel: string = toCamelCase("hello world");
export const made: string = fabricate(() => "x");
export const maybe: Maybe<string> = undefined;

const input: unknown = "12";
if (isNumeric(input)) {
  const numeric: Numeric = input;
  void numeric;
}

interface Node { parent: Node | null }
declare const node: Node;
export const chain: Node[] = traceHierarchy(node, "parent");

// @ts-expect-error clamp only accepts numbers
clamp("1", 0, 2);
// @ts-expect-error unknown alias
void aliased.nope;
`;

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

const dir = mkdtempSync(join(tmpdir(), "hyrax-smoke-"));
try {
  let tarball = process.argv[2] && resolve(process.argv[2]);
  if (!tarball) {
    // `npm pack --json` prints an array up to npm 11 and an object keyed by package name on npm 12.
    const packed = JSON.parse(
      run("npm", ["pack", "--json", "--pack-destination", dir], process.cwd()),
    );
    const { filename } = Array.isArray(packed) ? packed[0] : Object.values(packed)[0];
    tarball = join(dir, filename);
  }

  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "smoke", private: true }));
  // react/react-dom are optional peers; /react needs them once it has real code.
  run("npm", ["install", "--no-audit", "--no-fund", tarball, "react", "react-dom"], dir);

  for (const id of entrypoints) {
    run("node", ["--input-type=module", "-e", `await import("${id}");`], dir);
    run("node", ["-e", `require("${id}");`], dir);
  }

  const esm = run(
    "node",
    ["--input-type=module", "-e", `import { clamp } from "${NAME}"; console.log(clamp(15, 10));`],
    dir,
  ).trim();
  const cjs = run("node", ["-e", `console.log(require("${NAME}").clamp(15, 10));`], dir).trim();
  if (esm !== "10" || cjs !== "10") {
    throw new Error(`clamp(15, 10) gave ${esm} (ESM) / ${cjs} (CJS), expected 10 / 10`);
  }

  // Type-check a consumer against the installed package. Needs the repo's own
  // TypeScript, so it is skipped where dependencies are not installed.
  const tsc = resolve(process.cwd(), "node_modules/typescript/lib/tsc.js");
  const typed = existsSync(tsc);
  if (typed) {
    writeFileSync(join(dir, "consumer.mts"), CONSUMER);
    for (const [module, moduleResolution] of [
      ["nodenext", "nodenext"],
      ["esnext", "bundler"],
    ]) {
      run(
        "node",
        [
          tsc,
          "--noEmit",
          "--strict",
          "--target",
          "es2022",
          "--module",
          module,
          "--moduleResolution",
          moduleResolution,
          "consumer.mts",
        ],
        dir,
      );
    }
  }

  const runtimes = (process.env.HYRAX_SMOKE_RUNTIMES ?? "").split(",").filter(Boolean);
  const code = `${entrypoints.map((id, i) => `import * as m${i} from "${id}";`).join("")}
    if (m0.clamp(15, 10) !== 10) throw new Error("clamp broken");`;
  for (const runtime of runtimes) {
    if (runtime === "deno") run("deno", ["eval", "--node-modules-dir=manual", code], dir);
    else if (runtime === "bun") run("bun", ["-e", code], dir);
    else throw new Error(`Unknown runtime: ${runtime}`);
  }

  console.log(
    `Smoke test passed: ${entrypoints.length} entrypoints x (ESM + CJS)` +
      (typed ? " + consumer types" : "") +
      (runtimes.length ? ` + ${runtimes.join(", ")}` : ""),
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
