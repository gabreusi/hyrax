// Checks the workflows against the actions they use. A workflow is not run until it has to be, and
// GitHub only tells you an input is wrong when the step runs: a release workflow would find out on the
// day of the release. So every third-party action is looked up (its action.yml) and each `with` input,
// each required input and each `steps.<id>.outputs.<name>` that a workflow reads is compared with what
// the action declares. Pure, so it is unit-tested (checks.test.mjs) with a fake `metadata`.

/** `owner/repo[/path]@ref` as its parts, or null for a local (`./x`) or Docker action, or no ref. */
export function actionReference(uses) {
  if (uses.startsWith("./") || uses.startsWith("docker://")) return null;
  const at = uses.lastIndexOf("@");
  if (at === -1) return null;
  const [owner, repo, ...path] = uses.slice(0, at).split("/");
  if (!owner || !repo) return null;
  return { repo: `${owner}/${repo}`, path: path.join("/"), ref: uses.slice(at + 1) };
}

const names = (object) => Object.keys(object ?? {}).join(", ") || "none";

/**
 * The problems of one workflow (a list of sentences, empty when it is fine). `metadata(uses)` gives the
 * parsed action.yml of an action (`{ inputs, outputs }`), or null when it cannot be read.
 */
export async function workflowProblems(file, workflow, metadata) {
  const problems = [];
  const jobs = workflow.jobs ?? {};

  // What each step with an id, and each job, declares as outputs.
  const stepOutputs = {}; // `${job}.${id}` -> the outputs of the action, or null when unknown
  const jobOutputs = {}; // job -> the outputs it declares
  for (const [jobId, job] of Object.entries(jobs)) {
    jobOutputs[jobId] = Object.keys(job.outputs ?? {});
    for (const step of job.steps ?? []) {
      if (!step.uses) continue;
      if (!actionReference(step.uses)) continue;
      const meta = await metadata(step.uses);
      if (!meta) {
        problems.push(
          `${file}: could not read the metadata of ${step.uses}, so it was not checked`,
        );
        continue;
      }
      const where = `${file}, job "${jobId}", ${step.uses}`;
      const inputs = meta.inputs ?? {};
      for (const key of Object.keys(step.with ?? {})) {
        if (!(key in inputs)) {
          problems.push(
            `${where}: "${key}" is not an input of this action (it declares: ${names(inputs)})`,
          );
        }
      }
      for (const [key, spec] of Object.entries(inputs)) {
        if (spec?.required && spec.default === undefined && !(key in (step.with ?? {}))) {
          problems.push(`${where}: the action requires the input "${key}"`);
        }
      }
      if (step.id) stepOutputs[`${jobId}.${step.id}`] = meta.outputs ?? {};
    }
  }

  // What the workflow reads: `steps.<id>.outputs.<name>` (inside its own job) and
  // `needs.<job>.outputs.<name>`.
  for (const [jobId, job] of Object.entries(jobs)) {
    const text = JSON.stringify(job);
    for (const [, id, name] of text.matchAll(/steps\.([\w-]+)\.outputs\.([\w-]+)/g)) {
      const outputs = stepOutputs[`${jobId}.${id}`];
      if (outputs && !(name in outputs)) {
        problems.push(
          `${file}, job "${jobId}": steps.${id}.outputs.${name} does not exist (the action declares: ${names(outputs)})`,
        );
      }
    }
    for (const [, other, name] of text.matchAll(/needs\.([\w-]+)\.outputs\.([\w-]+)/g)) {
      if (jobOutputs[other] && !jobOutputs[other].includes(name)) {
        problems.push(
          `${file}, job "${jobId}": needs.${other}.outputs.${name} is not declared by job "${other}" (it declares: ${jobOutputs[other].join(", ") || "none"})`,
        );
      }
    }
  }
  return problems;
}
