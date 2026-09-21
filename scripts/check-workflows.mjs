// Checks every workflow in .github/workflows against the third-party actions it uses (see
// scripts/workflows/checks.mjs): an input the action does not declare, a required input that is missing,
// and a step or job output that does not exist all fail here, and not on the day the workflow first runs.
// It reads each action's action.yml from GitHub, so it needs the network.
//
//   node scripts/check-workflows.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { actionReference, workflowProblems } from "./workflows/checks.mjs";

const DIRECTORY = ".github/workflows";
const cache = new Map();

/** The parsed action.yml (or action.yaml) of `uses`, or null when it cannot be read. */
async function metadata(uses) {
  if (!cache.has(uses)) cache.set(uses, read(uses));
  return cache.get(uses);
}

async function read(uses) {
  const { repo, path, ref } = actionReference(uses);
  for (const file of ["action.yml", "action.yaml"]) {
    const url = `https://raw.githubusercontent.com/${repo}/${ref}/${path ? `${path}/` : ""}${file}`;
    try {
      const response = await fetch(url);
      if (response.ok) return parse(await response.text());
    } catch {
      // A network error is reported below, as an action that could not be read.
    }
  }
  return null;
}

const problems = [];
let checked = 0;
for (const name of readdirSync(DIRECTORY)
  .filter((file) => /\.ya?ml$/.test(file))
  .sort()) {
  const workflow = parse(readFileSync(join(DIRECTORY, name), "utf8"));
  problems.push(...(await workflowProblems(`${DIRECTORY}/${name}`, workflow, metadata)));
  checked++;
}

if (problems.length > 0) {
  console.error(`${problems.length} workflow problem(s):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(
  `Workflows OK: ${checked} files, ${cache.size} actions checked against their action.yml.`,
);
