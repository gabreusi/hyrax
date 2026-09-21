// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as react from "./index";

describe("@gabreusi/hyrax/react without a DOM", () => {
  it("can be imported where there is no document, and runs nothing on import", () => {
    expect(typeof document).toBe("undefined");
    expect(typeof react.hx.div).toBe("object");
    expect(typeof react.Portal).toBe("function");
    expect(typeof react.useInterval).toBe("function");
  });
});
