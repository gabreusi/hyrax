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

// The determinism contract: a seed gives the same output in every runtime and module format.
// EXACT covers everything built on integer arithmetic (the engine, int, from, shuffle, sample,
// weighted, roll, uuid, bytes, fork): it must match bit for bit everywhere.
// TRANSCENDENTAL covers luck != 0, normal and exponential, which use Math.pow, Math.log and
// Math.cos. ECMAScript does not require those to round identically in every engine, so a
// mismatch there is reported separately. Neither value may change without a major version.
const EXACT =
  '(() => { const r = new Random("hyrax"); const f = r.fork("terrain", 3, 4); return [r.int(1, 100), r.uuid(), Array.from(r.bytes(4)).join(","), f.next(), r.sample([1, 2, 3, 4, 5], 3).join(""), r.shuffle([1, 2, 3, 4, 5]).join(""), r.weighted(["a", "b", "c"], [80, 15, 5]), r.roll("2d6+3")].join(" "); })()';
const EXACT_EXPECTED =
  "33 627a9f02-43de-4af3-acb3-e143723b09c5 99,168,18,109 0.31158723663990495 452 21543 a 6";
const TRANSCENDENTAL =
  '(() => { const r = new Random({ seed: "hyrax", luck: 1.5 }); return [r.float(), r.int(1, 20), r.boolean(), r.normal(), r.exponential(2)].join(" "); })()';
const TRANSCENDENTAL_EXPECTED = "0.5756361196616097 17 false 0.9888625997383569 0.5883254698180862";

// A real TypeScript consumer of the public API. `@ts-expect-error` lines make the
// compile fail if the types ever become looser than intended.
const CONSUMER = `
import { alias, clamp, fabricate, isNumeric, random, Random, StringBuilder, Suspend, toCamelCase, traceHierarchy } from "${NAME}";
import type { RandomState, SecureRandom } from "${NAME}";
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

export const roll: number = new Random("seed").int(1, 6);
export const pick: string | undefined = random.from(["a", "b"]);
export const classes: string = new StringBuilder().append("btn").if(true, "on").build();
export const stop: () => void = new Suspend().on((elapsed: number) => void elapsed);

export const child: Random = new Random({ seed: "w", luck: 1 }).fork("terrain", 3, 4);
export const saved: RandomState = child.state();
export const restored: Random = Random.restore(saved);
export const drop: "common" | "rare" = new Random("x").weighted({ common: 80, rare: 20 });
export const total: number = new Random("x").roll("2d6+3");
const secure: SecureRandom = Random.secure();
export const session: string = secure.token();

// @ts-expect-error a secure generator has no state: it cannot be replayed
secure.state();
// @ts-expect-error a seeded generator has no token: a reproducible token would be a trap
new Random("seed").token();
// @ts-expect-error int needs both bounds
new Random("seed").int(1);
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

  const script = `console.log(${EXACT}); console.log(${TRANSCENDENTAL});`;
  const viaEsm = run(
    "node",
    ["--input-type=module", "-e", `import { Random } from "${NAME}"; ${script}`],
    dir,
  ).trim();
  const viaCjs = run(
    "node",
    ["-e", `const { Random } = require("${NAME}"); ${script}`],
    dir,
  ).trim();
  const expected = `${EXACT_EXPECTED}\n${TRANSCENDENTAL_EXPECTED}`;
  if (viaEsm !== expected || viaCjs !== expected) {
    throw new Error(
      `Seeded output changed.\nESM:\n${viaEsm}\nCJS:\n${viaCjs}\nExpected:\n${expected}`,
    );
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
    if (m0.clamp(15, 10) !== 10) throw new Error("clamp broken");
    const { Random } = m0;
    const exact = ${EXACT};
    if (exact !== "${EXACT_EXPECTED}") throw new Error("EXACT seeded output differs: " + exact);
    const transcendental = ${TRANSCENDENTAL};
    if (transcendental !== "${TRANSCENDENTAL_EXPECTED}") {
      throw new Error("TRANSCENDENTAL seeded output differs (Math.pow/log/cos): " + transcendental);
    }`;
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
