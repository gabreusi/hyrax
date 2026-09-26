// Installs the library tarball into a clean directory and imports every
// entrypoint through ESM and CJS, exactly as a consumer would.
//
//   node scripts/smoke.mjs [path/to/tarball.tgz]   (packs the repo when omitted)
//   node scripts/smoke.mjs @gabreusi/hyrax@1.0.0-rc.0   (installs from the registry: what npm serves)
//   HYRAX_SMOKE_RUNTIMES=deno,bun node scripts/smoke.mjs   (also checks those runtimes)
//   HYRAX_SMOKE_REACT=18 node scripts/smoke.mjs   (React 18 and its types instead of the latest)
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

// The /dom entrypoint must be importable and callable where there is no document (Node, Deno, Bun,
// a server render). This runs against the built package in each of them.
const DOM_SSR =
  '(dom) => [dom.getCSSVar("--x", "fallback"), Number.isNaN(dom.toPixels("2em")), typeof dom.listen(null, "click", () => {}), typeof dom.onClickOutside(null, () => {})].join(" ")';
const DOM_SSR_EXPECTED = "fallback true function function";

// /react must render on the server (no document, no effects) and, being all hooks and components,
// must say "use client" so that a Server Components bundler knows where the client boundary is.
// Only the /react entrypoint says it: the root and /dom stay usable from a server component.
const REACT_SSR =
  '(react, h, renderToString) => { const Page = () => { react.useForceUpdate(); react.useInterval(() => {}, 10, { autoStart: true }); react.useEventListener(globalThis.window, "resize", () => {}); react.useClickOutside(null, () => {}); return h(react.hx.div, { display: "flex" }, h(react.Portal, null, "popup"), h(react.hx.canvas, { width: 5 }), h("p", null, "ok")); }; return renderToString(h(Page)); }';
const REACT_SSR_EXPECTED = '<div style="display:flex"><canvas width="5"></canvas><p>ok</p></div>';

// A real TypeScript consumer of the public API. `@ts-expect-error` lines make the
// compile fail if the types ever become looser than intended.
const CONSUMER = `
import { alias, clamp, fabricate, isNumeric, random, Random, StringBuilder, Suspend, toCamelCase, traceHierarchy } from "${NAME}";
import type { RandomState, SecureRandom } from "${NAME}";
import { getCSSVar, listen, onClickOutside, toPixels } from "${NAME}/dom";
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

export const primary: string | null = getCSSVar("--primary");
export const gap: string = getCSSVar("--gap", "8px");
export const size: number = toPixels("2em");
export const stopResize: () => void = listen(window, "resize", (event: UIEvent) => void event);
export const stopOutside: () => void = onClickOutside(document.body, (event: PointerEvent) => void event);

// @ts-expect-error resize gives a UIEvent, not a KeyboardEvent
listen(window, "resize", (event: KeyboardEvent) => void event);
// @ts-expect-error toPixels takes a string or a number
toPixels(null);
// @ts-expect-error a secure generator has no state: it cannot be replayed
secure.state();
// @ts-expect-error a seeded generator has no token: a reproducible token would be a trap
new Random("seed").token();
// @ts-expect-error int needs at least one bound
new Random("seed").int();
// @ts-expect-error clamp only accepts numbers
clamp("1", 0, 2);
// @ts-expect-error unknown alias
void aliased.nope;
`;

const CONSUMER_REACT = `
import { hx, Portal, useClickOutside, useEventListener, useForceUpdate, useInterval } from "${NAME}/react";
import type { HxProps, PortalProps } from "${NAME}/react";
import { useRef } from "react";

export function Demo(props: PortalProps) {
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const forceUpdate: () => void = useForceUpdate();
  const timer: { start: () => void; stop: () => void; isRunning: boolean } = useInterval(forceUpdate, 1000, { autoStart: true, immediate: true });
  useEventListener(window, "resize", (event: UIEvent) => void event);
  useEventListener(box, "click", (event: MouseEvent) => void event);
  useClickOutside(box, (event: PointerEvent) => void event, { ignore: opener });
  const canvas: HxProps<"canvas"> = { width: 300, height: 150 };
  return (
    <hx.div display="flex" padding="8px" ref={box} rendered={timer.isRunning}>
      <hx.canvas {...canvas} backgroundColor="red" />
      <Portal {...props} container={document.body}>popup</Portal>
    </hx.div>
  );
}

// @ts-expect-error resize gives a UIEvent, not a KeyboardEvent
useEventListener(window, "resize", (event: KeyboardEvent) => void event);
// @ts-expect-error the delay is required
useInterval(() => {});
// @ts-expect-error a div has no href
void (<hx.div href="/" />);
// @ts-expect-error opacity is a number or a string, not a boolean
void (<hx.div opacity={true} />);
`;

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

const dir = mkdtempSync(join(tmpdir(), "hyrax-smoke-"));
try {
  // A tarball, or (when the argument is not a file) a package spec such as `@gabreusi/hyrax@1.0.0`.
  const argument = process.argv[2];
  const fromRegistry = argument !== undefined && !existsSync(resolve(argument));
  let tarball = argument && !fromRegistry ? resolve(argument) : undefined;
  if (!argument) {
    // `npm pack --json` prints an array up to npm 11 and an object keyed by package name on npm 12.
    const packed = JSON.parse(
      run("npm", ["pack", "--json", "--pack-destination", dir], process.cwd()),
    );
    const { filename } = Array.isArray(packed) ? packed[0] : Object.values(packed)[0];
    tarball = join(dir, filename);
  }
  const target = fromRegistry ? argument : tarball;

  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "smoke", private: true }));
  // react/react-dom are optional peers that /react needs; their types are needed to type-check a
  // consumer. HYRAX_SMOKE_REACT=18 checks the package against React 18 and its types instead.
  const at = process.env.HYRAX_SMOKE_REACT ? `@${process.env.HYRAX_SMOKE_REACT}` : "";
  const install = () =>
    run(
      "npm",
      [
        "install",
        "--no-audit",
        "--no-fund",
        target,
        ...["react", "react-dom", "@types/react", "@types/react-dom"].map((name) => name + at),
      ],
      dir,
    );
  // A version that was just published can take a moment to be served: try again before giving up.
  for (let attempt = 1; ; attempt++) {
    try {
      install();
      break;
    } catch (error) {
      if (!fromRegistry || attempt === 6) throw error;
      console.error(`${target} is not available yet (try ${attempt} of 6), waiting...`);
      await new Promise((done) => setTimeout(done, 10_000));
    }
  }

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

  const domScript = `console.log((${DOM_SSR})(dom));`;
  const domEsm = run(
    "node",
    ["--input-type=module", "-e", `import * as dom from "${NAME}/dom"; ${domScript}`],
    dir,
  ).trim();
  const domCjs = run(
    "node",
    ["-e", `const dom = require("${NAME}/dom"); ${domScript}`],
    dir,
  ).trim();
  if (domEsm !== DOM_SSR_EXPECTED || domCjs !== DOM_SSR_EXPECTED) {
    throw new Error(
      `/dom is not safe without a DOM: ESM "${domEsm}", CJS "${domCjs}", expected "${DOM_SSR_EXPECTED}"`,
    );
  }

  const reactScript = `console.log((${REACT_SSR})(react, h, renderToString));`;
  const reactEsm = run(
    "node",
    [
      "--input-type=module",
      "-e",
      `import * as react from "${NAME}/react"; import { createElement as h } from "react"; import { renderToString } from "react-dom/server"; ${reactScript}`,
    ],
    dir,
  ).trim();
  const reactCjs = run(
    "node",
    [
      "-e",
      `const react = require("${NAME}/react"); const { createElement: h } = require("react"); const { renderToString } = require("react-dom/server"); ${reactScript}`,
    ],
    dir,
  ).trim();
  if (reactEsm !== REACT_SSR_EXPECTED || reactCjs !== REACT_SSR_EXPECTED) {
    throw new Error(
      `/react does not render on the server: ESM "${reactEsm}", CJS "${reactCjs}", expected "${REACT_SSR_EXPECTED}"`,
    );
  }

  const client = (file) =>
    run(
      "node",
      [
        "-e",
        `console.log(require("fs").readFileSync(require.resolve("${NAME}/${file}"), "utf8").startsWith('"use client";'))`,
      ],
      dir,
    ).trim();
  // Resolved through the package `exports`: a file per entrypoint and per module format.
  const flags = {
    react: client("react"),
    dom: client("dom"),
    root: run(
      "node",
      [
        "-e",
        `console.log(require("fs").readFileSync(require.resolve("${NAME}"), "utf8").startsWith('"use client";'))`,
      ],
      dir,
    ).trim(),
  };
  if (flags.react !== "true" || flags.dom !== "false" || flags.root !== "false") {
    throw new Error(
      `"use client" must be on /react and only there: react=${flags.react} dom=${flags.dom} root=${flags.root}`,
    );
  }

  // Type-check a consumer against the installed package. Needs the repo's own
  // TypeScript, so it is skipped where dependencies are not installed.
  const tsc = resolve(process.cwd(), "node_modules/typescript/lib/tsc.js");
  const typed = existsSync(tsc);
  if (typed) {
    writeFileSync(join(dir, "consumer.mts"), CONSUMER);
    writeFileSync(join(dir, "consumer-react.tsx"), CONSUMER_REACT);
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
          "--jsx",
          "react-jsx",
          "--target",
          "es2022",
          "--module",
          module,
          "--moduleResolution",
          moduleResolution,
          "consumer.mts",
          "consumer-react.tsx",
        ],
        dir,
      );
    }
  }

  const runtimes = (process.env.HYRAX_SMOKE_RUNTIMES ?? "").split(",").filter(Boolean);
  const code = `${entrypoints.map((id, i) => `import * as m${i} from "${id}";`).join("")}
    import { createElement as h } from "react";
    import { renderToString } from "react-dom/server";
    if (m0.clamp(15, 10) !== 10) throw new Error("clamp broken");
    const { Random } = m0;
    const reactResult = (${REACT_SSR})(m2, h, renderToString);
    if (reactResult !== '${REACT_SSR_EXPECTED}') throw new Error("/react does not render on the server: " + reactResult);
    const domResult = (${DOM_SSR})(m1);
    if (domResult !== "${DOM_SSR_EXPECTED}") throw new Error("/dom is not safe without a DOM: " + domResult);
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
