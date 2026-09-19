// The core entrypoint must compile without the DOM lib. The fixture uses
// `window`/`document`; compiling it against tsconfig.core.json MUST fail.
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["tsc", "-p", "tsconfig.boundary.json"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});
const output = `${result.stdout}${result.stderr}`;

if (result.status === 0) {
  console.error("Boundary check FAILED: DOM globals compiled inside core.");
  process.exit(1);
}
if (!output.includes("TS2304") && !output.includes("TS2584")) {
  console.error("Boundary check FAILED: tsc failed for an unexpected reason:\n" + output);
  process.exit(1);
}
console.log("Boundary check passed: core rejects DOM globals.");
