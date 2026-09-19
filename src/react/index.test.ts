import { describe, expect, it } from "vitest";
import * as react from "./index";

describe("@gabreusi/hyrax/react", () => {
  it("runs in a DOM environment", () => {
    expect(typeof document).toBe("object");
  });

  it("has named exports only", () => {
    expect("default" in react).toBe(false);
  });
});
