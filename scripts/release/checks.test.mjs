import { describe, expect, it } from "vitest";
import { REQUIRED, missingFiles, publishProblems, unexpectedFiles } from "./checks.mjs";

describe("unexpectedFiles", () => {
  it("accepts the built package, the readme, the license and the package.json", () => {
    expect(unexpectedFiles(REQUIRED)).toEqual([]);
    expect(unexpectedFiles(["dist/onClickOutside-1MUT2CB8.js", "dist/x-Ab_1.d.cts"])).toEqual([]);
  });

  it.each([
    "src/core/number.ts",
    "site/index.md",
    "docs/superpowers/plans/x.md",
    "scripts/smoke.mjs",
    ".github/workflows/ci.yml",
    "dist/index.js.map",
    "dist/nested/index.js",
    ".env",
    "CHANGELOG.md.bak",
    "vitest.config.ts",
  ])("flags %s", (path) => {
    expect(unexpectedFiles([path])).toEqual([path]);
  });
});

describe("missingFiles", () => {
  it("is empty when everything is there", () => {
    expect(missingFiles([...REQUIRED, "dist/chunk-1.js"])).toEqual([]);
  });

  it("names what is not, for each entrypoint and format", () => {
    const without = REQUIRED.filter((p) => p !== "dist/react.cjs" && p !== "LICENSE");
    expect(missingFiles(without)).toEqual(["dist/react.cjs", "LICENSE"]);
  });
});

describe("publishProblems", () => {
  const ready = {
    name: "@gabreusi/hyrax",
    version: "1.0.0-rc.0",
    publishConfig: { access: "public" },
  };

  it("accepts a versioned, public package", () => {
    expect(publishProblems(ready)).toEqual([]);
  });

  it("refuses a private package", () => {
    expect(publishProblems({ ...ready, private: true })).toHaveLength(1);
  });

  it("refuses the 0.0.0 placeholder", () => {
    expect(publishProblems({ ...ready, version: "0.0.0" })[0]).toMatch(/changeset version/);
  });

  it("refuses a scoped package that is not marked public", () => {
    expect(publishProblems({ ...ready, publishConfig: undefined })[0]).toMatch(/access/);
    expect(publishProblems({ name: "plain", version: "1.0.0" })).toEqual([]);
  });

  it("reports every problem at once", () => {
    expect(publishProblems({ name: "@a/b", version: "0.0.0", private: true })).toHaveLength(3);
  });
});
