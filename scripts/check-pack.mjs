// Checks what `npm publish` would upload, before it does: the tarball holds the built package, the
// README, the LICENSE and the package.json and nothing else (no source, no tests, no source maps),
// nothing that must be there is missing, and it has not grown by accident.
//
//   npm run build && node scripts/check-pack.mjs
//   node scripts/check-pack.mjs --publish     (what `prepublishOnly` runs; also refuses a package
//                                              that is private or still at the 0.0.0 placeholder)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { missingFiles, publishProblems, unexpectedFiles } from "./release/checks.mjs";

const BUDGET_KB = 160; // measured: about 132 kB. A jump means something was added on purpose or by mistake.

const publishing = process.argv.includes("--publish");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const problems = publishing ? publishProblems(pkg) : [];

// `npm pack --json` prints an array up to npm 11 and an object keyed by package name on npm 12.
const packed = JSON.parse(
  execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }),
);
const { files, size } = Array.isArray(packed) ? packed[0] : Object.values(packed)[0];
const paths = files.map((file) => file.path);

for (const path of unexpectedFiles(paths)) problems.push(`unexpected file in the tarball: ${path}`);
for (const path of missingFiles(paths)) problems.push(`missing from the tarball: ${path}`);
if (size > BUDGET_KB * 1000) {
  problems.push(`the tarball is ${(size / 1000).toFixed(1)} kB, over the ${BUDGET_KB} kB budget`);
}

if (problems.length > 0) {
  console.error(`Not ready to publish:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Package contents OK: ${paths.length} files, ${(size / 1000).toFixed(1)} kB.`);
