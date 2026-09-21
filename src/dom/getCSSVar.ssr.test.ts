// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getCSSVar } from "./getCSSVar";

describe("getCSSVar without a DOM (server-side rendering)", () => {
  it("returns null, or the fallback, instead of throwing", () => {
    expect(typeof document).toBe("undefined");
    expect(getCSSVar("--primary")).toBeNull();
    expect(getCSSVar("--primary", "red")).toBe("red");
  });
});
