// @vitest-environment node
import { describe, expect, it } from "vitest";
import { setCSSVar } from "./setCSSVar";

describe("setCSSVar without a DOM (server-side rendering)", () => {
  it("does nothing instead of throwing", () => {
    expect(typeof document).toBe("undefined");
    expect(() => setCSSVar("--gap", 12)).not.toThrow();
    expect(() => setCSSVar({ "--gap": 12 })).not.toThrow();
  });
});
