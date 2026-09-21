// Bundles the installed package with esbuild, Vite and webpack, the way an app would, and checks the
// claims the documentation makes: an unused function is not in the bundle (tree-shaking), and importing
// one function costs about what it weighs, in each entrypoint.
//
//   node scripts/smoke-bundlers.mjs [path/to/tarball.tgz | package@spec]   (packs the repo when omitted)
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const NAME = "@gabreusi/hyrax";

// A case imports one thing (or, to prove the markers mean something, everything from an entrypoint).
// `present` and `absent` are strings that only some code contains: an error message or a name that
// survives minification. Importing everything must show the markers, so that "not found" in a
// single-function bundle is real tree-shaking and not a marker that never existed.
const RANDOM = "Random.restore()";
const SUSPEND = "This Suspend has been disposed";
const CASES = [
  {
    name: "everything from the root",
    source: `import * as all from "${NAME}"; console.log(all);`,
    present: [RANDOM, SUSPEND],
    absent: [],
    maxBytes: 60_000,
  },
  {
    name: "clamp from the root",
    source: `import { clamp } from "${NAME}"; console.log(clamp(15, 0, 10));`,
    present: [],
    absent: [RANDOM, SUSPEND],
    maxBytes: 600,
  },
  {
    name: "Random from the root",
    source: `import { Random } from "${NAME}"; console.log(new Random("x").int(1, 6));`,
    present: [RANDOM],
    absent: [SUSPEND],
    maxBytes: 14_000,
  },
  {
    name: "everything from /dom",
    source: `import * as all from "${NAME}/dom"; console.log(all);`,
    present: ["getComputedStyle"],
    absent: [],
    maxBytes: 60_000,
  },
  {
    name: "listen from /dom",
    source: `import { listen } from "${NAME}/dom"; listen(window, "resize", () => {});`,
    present: [],
    absent: ["getComputedStyle"],
    maxBytes: 600,
  },
  {
    name: "everything from /react",
    source: `import * as all from "${NAME}/react"; console.log(all);`,
    present: ["PORTAL", "hx."],
    absent: [],
    maxBytes: 60_000,
  },
  {
    name: "useForceUpdate from /react",
    source: `import { useForceUpdate } from "${NAME}/react"; console.log(useForceUpdate);`,
    present: [],
    absent: ["PORTAL", "hx."],
    maxBytes: 800,
  },
];

// Written into the temporary project, so that the bundlers resolve everything the way an app would.
const BUNDLE = `
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build as esbuild } from "esbuild";
import { build as vite } from "vite";
import webpack from "webpack";

const cases = JSON.parse(readFileSync("cases.json", "utf8"));
const external = ["react", "react-dom", "react/jsx-runtime"];
const results = {};

for (const [index, { source }] of cases.entries()) {
  const entry = join("entries", "case" + index + ".mjs");
  writeFileSync(entry, source);
  const out = {};

  const e = await esbuild({ entryPoints: [entry], bundle: true, minify: true, format: "esm", platform: "browser", external, write: false, logLevel: "silent" });
  out.esbuild = e.outputFiles[0].text;

  const v = await vite({ configFile: false, logLevel: "silent", build: { write: false, minify: true, lib: { entry, formats: ["es"], fileName: "out" }, rollupOptions: { external } } });
  const chunks = (Array.isArray(v) ? v : [v]).flatMap((r) => r.output);
  out.vite = chunks.map((c) => c.code ?? "").join("\\n");

  const dir = join("webpack-out", String(index));
  mkdirSync(dir, { recursive: true });
  await new Promise((done, fail) =>
    webpack({ mode: "production", entry: "./" + entry, target: "web", output: { path: join(process.cwd(), dir) }, externals: Object.fromEntries(external.map((name) => [name, name])) }, (error, stats) =>
      error || stats.hasErrors() ? fail(error ?? new Error(stats.toString({ all: false, errors: true }))) : done(),
    ),
  );
  out.webpack = readdirSync(dir).filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(dir, f), "utf8")).join("\\n");
  results[index] = out;
}
console.log(JSON.stringify(results));
`;

const run = (cmd, args, cwd, stdio = ["ignore", "pipe", "inherit"]) =>
  execFileSync(cmd, args, { cwd, encoding: "utf8", stdio, maxBuffer: 64 * 1024 * 1024 });

const dir = mkdtempSync(join(tmpdir(), "hyrax-bundlers-"));
try {
  const argument = process.argv[2];
  let target = argument && (existsSync(resolve(argument)) ? resolve(argument) : argument);
  if (!target) {
    // `npm pack --json` prints an array up to npm 11 and an object keyed by package name on npm 12.
    const packed = JSON.parse(
      run("npm", ["pack", "--json", "--pack-destination", dir], process.cwd()),
    );
    target = join(dir, (Array.isArray(packed) ? packed[0] : Object.values(packed)[0]).filename);
  }

  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "bundlers", private: true, type: "module" }),
  );
  // The majors are pinned: a new major of a bundler is news, and should not break the build unannounced.
  run(
    "npm",
    [
      "install",
      "--no-audit",
      "--no-fund",
      target,
      "esbuild@0.28",
      "vite@8",
      "webpack@5",
      "react",
      "react-dom",
    ],
    dir,
  );
  writeFileSync(join(dir, "cases.json"), JSON.stringify(CASES));
  writeFileSync(join(dir, "bundle.mjs"), BUNDLE);
  run("node", ["-e", 'require("fs").mkdirSync("entries", { recursive: true })'], dir);

  const results = JSON.parse(run("node", ["bundle.mjs"], dir));
  const problems = [];
  const sizes = [];
  for (const [index, c] of CASES.entries()) {
    for (const [bundler, code] of Object.entries(results[index])) {
      const bytes = Buffer.byteLength(code);
      sizes.push(`${bundler}/${c.name}: ${bytes} B`);
      const where = `${bundler}, "${c.name}"`;
      for (const text of c.absent) {
        if (code.includes(text))
          problems.push(`${where}: found "${text}", so it was not tree-shaken`);
      }
      for (const text of c.present) {
        if (!code.includes(text)) problems.push(`${where}: "${text}" is missing`);
      }
      if (bytes > c.maxBytes)
        problems.push(`${where}: ${bytes} B, over the ${c.maxBytes} B this case may take`);
    }
  }
  if (process.env.HYRAX_SMOKE_VERBOSE) console.log(sizes.join("\n"));
  if (problems.length > 0) throw new Error(`Bundler problems:\n- ${problems.join("\n- ")}`);
  console.log(
    `Bundlers passed: esbuild, Vite and webpack x ${CASES.length} cases (tree-shaking and size).`,
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
