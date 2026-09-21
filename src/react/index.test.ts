import { describe, expect, it } from "vitest";
import * as react from "./index";

describe("@gabreusi/hyrax/react", () => {
  it("runs in a DOM environment", () => {
    expect(typeof document).toBe("object");
  });

  it("has named exports only", () => {
    expect("default" in react).toBe(false);
  });

  it("exposes exactly the intended public API", () => {
    // Adding or removing an export is an API decision: update this list on purpose.
    const expected = [
      "hx",
      "Portal",
      "useClickOutside",
      "useEventListener",
      "useForceUpdate",
      "useInterval",
    ];
    expect(Object.keys(react).sort()).toEqual(expected.sort());
  });
});
