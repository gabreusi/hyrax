import { describe, expect, it } from "vitest";
import { actionReference, workflowProblems } from "./checks.mjs";

// What the third-party actions declare, standing in for their action.yml files.
const ACTIONS = {
  "acme/deploy@v2": {
    inputs: {
      "github-token": { default: "x" },
      "publish-script": {},
      target: { required: true },
    },
    outputs: { published: {}, "published-packages": {} },
  },
  "acme/plain@v1": { inputs: {}, outputs: {} },
};
const metadata = async (reference) => ACTIONS[reference] ?? null;

const job = (steps, extra = {}) => ({
  jobs: { main: { "runs-on": "ubuntu-latest", steps, ...extra } },
});

describe("actionReference", () => {
  it.each([
    ["actions/checkout@v7", { repo: "actions/checkout", path: "", ref: "v7" }],
    ["owner/repo/sub/dir@abc123", { repo: "owner/repo", path: "sub/dir", ref: "abc123" }],
  ])("reads %s", (uses, expected) => {
    expect(actionReference(uses)).toEqual(expected);
  });

  it.each(["./local-action", "docker://alpine:3", "no-ref", "owner/repo"])("skips %s", (uses) => {
    expect(actionReference(uses)).toBeNull();
  });
});

describe("workflowProblems", () => {
  it("accepts a step that only uses inputs the action declares", async () => {
    const workflow = job([
      { uses: "acme/deploy@v2", with: { target: "prod", "publish-script": "npm run x" } },
    ]);
    expect(await workflowProblems("w.yml", workflow, metadata)).toEqual([]);
  });

  it("names an input the action does not declare, and what it declares", async () => {
    const workflow = job([
      { uses: "acme/deploy@v2", with: { target: "prod", publish: "npm run x" } },
    ]);
    const [problem] = await workflowProblems("w.yml", workflow, metadata);
    expect(problem).toMatch(/w\.yml/);
    expect(problem).toMatch(/"publish"/);
    expect(problem).toMatch(/publish-script/);
  });

  it("reports every unknown input", async () => {
    const workflow = job([{ uses: "acme/deploy@v2", with: { target: "prod", a: 1, b: 2 } }]);
    expect(await workflowProblems("w.yml", workflow, metadata)).toHaveLength(2);
  });

  it("asks for a required input that has no default", async () => {
    const workflow = job([{ uses: "acme/deploy@v2", with: {} }]);
    const [problem] = await workflowProblems("w.yml", workflow, metadata);
    expect(problem).toMatch(/requires the input "target"/);
  });

  it("checks that a step output that is used exists", async () => {
    const workflow = job(
      [
        { id: "d", uses: "acme/deploy@v2", with: { target: "t" } },
        { run: "echo ${{ steps.d.outputs.publishedPackages }}" },
      ],
      { outputs: { ok: "${{ steps.d.outputs.published }}" } },
    );
    const problems = await workflowProblems("w.yml", workflow, metadata);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/steps\.d\.outputs\.publishedPackages/);
    expect(problems[0]).toMatch(/published-packages/);
  });

  it("accepts an output whose name has a hyphen", async () => {
    const workflow = job([
      { id: "d", uses: "acme/deploy@v2", with: { target: "t" } },
      { run: "echo ${{ steps.d.outputs.published-packages }}" },
    ]);
    expect(await workflowProblems("w.yml", workflow, metadata)).toEqual([]);
  });

  it("checks the outputs a job needs from another job of the same workflow", async () => {
    const workflow = {
      jobs: {
        build: { steps: [{ run: "true" }], outputs: { version: "1" } },
        publish: {
          needs: "build",
          steps: [
            { run: "echo ${{ needs.build.outputs.version }} ${{ needs.build.outputs.nope }}" },
          ],
        },
      },
    };
    const problems = await workflowProblems("w.yml", workflow, metadata);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/needs\.build\.outputs\.nope/);
  });

  it("leaves local and docker actions alone", async () => {
    const workflow = job([
      { uses: "./local", with: { anything: 1 } },
      { uses: "docker://alpine:3", with: { x: 1 } },
    ]);
    expect(await workflowProblems("w.yml", workflow, metadata)).toEqual([]);
  });

  it("says so when it cannot read an action's metadata, instead of passing in silence", async () => {
    const workflow = job([{ uses: "acme/ghost@v1", with: {} }]);
    const [problem] = await workflowProblems("w.yml", workflow, metadata);
    expect(problem).toMatch(/acme\/ghost@v1/);
    expect(problem).toMatch(/could not read/);
  });

  it("checks a job that calls a step without inputs against an action with none", async () => {
    const workflow = job([{ uses: "acme/plain@v1", with: { x: 1 } }]);
    expect(await workflowProblems("w.yml", workflow, metadata)).toHaveLength(1);
  });
});
