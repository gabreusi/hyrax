import { describe, expect, it } from "vitest";
import * as dom from "./index";

describe("@gabreusi/hyrax/dom", () => {
  it("runs in a DOM environment", () => {
    expect(typeof document).toBe("object");
  });

  it("has named exports only", () => {
    expect("default" in dom).toBe(false);
  });

  it("exposes exactly the intended public API", () => {
    // Adding or removing an export is an API decision: update this list on purpose.
    const expected = [
      "copyText",
      "getCSSVar",
      "listen",
      "lockScroll",
      "observeSize",
      "onClickOutside",
      "onKey",
      "onVisible",
      "readStorage",
      "setCSSVar",
      "toPixels",
      "writeStorage",
    ];
    expect(Object.keys(dom).sort()).toEqual(expected.sort());
  });
});
