import { describe, expect, it } from "vitest";
import * as dom from "./index";

describe("@gabreusi/hyrax/dom", () => {
  it("runs in a DOM environment", () => {
    expect(typeof document).toBe("object");
  });

  it("has named exports only", () => {
    expect("default" in dom).toBe(false);
  });
});
