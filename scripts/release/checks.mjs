// What may go to npm, as pure functions (unit-tested in checks.test.mjs). A mistake here ships the
// wrong files, or a placeholder version, to everyone.

/** Every file of the published tarball must match one of these. */
const ALLOWED = [
  /^dist\/[\w.-]+\.(?:js|cjs|d\.ts|d\.cts)$/,
  /^(?:README\.md|LICENSE|package\.json)$/,
];

/** The files that have to be there: the three entrypoints, both formats, with their types. */
export const REQUIRED = [
  ...["index", "dom", "react"].flatMap((entry) => [
    `dist/${entry}.js`,
    `dist/${entry}.cjs`,
    `dist/${entry}.d.ts`,
    `dist/${entry}.d.cts`,
  ]),
  "README.md",
  "LICENSE",
  "package.json",
];

/** Anything in the tarball that should not be: source, tests, docs, source maps, secrets. */
export function unexpectedFiles(paths) {
  return paths.filter((path) => !ALLOWED.some((pattern) => pattern.test(path)));
}

/** What the tarball is missing. */
export function missingFiles(paths) {
  return REQUIRED.filter((path) => !paths.includes(path));
}

/** Why this `package.json` must not be published yet (an empty list means it can). */
export function publishProblems(pkg) {
  const problems = [];
  if (pkg.private) problems.push('"private" is true, so npm would refuse it');
  if (pkg.version === "0.0.0") {
    problems.push('the version is still the placeholder 0.0.0: run "changeset version" first');
  }
  if (pkg.name?.startsWith("@") && pkg.publishConfig?.access !== "public") {
    problems.push('a scoped package needs "publishConfig": { "access": "public" }');
  }
  return problems;
}
