// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Portal } from "./Portal";

describe("Portal on the server", () => {
  it("renders nothing, and does not read document, which does not exist", () => {
    expect(typeof document).toBe("undefined");
    expect(
      renderToString(
        <Portal>
          <p>popup</p>
        </Portal>,
      ),
    ).toBe("");
  });

  it("renders its children in place when disabled, since nothing has to be moved", () => {
    expect(
      renderToString(
        <Portal disabled>
          <p>popup</p>
        </Portal>,
      ),
    ).toBe("<p>popup</p>");
  });

  it("renders nothing when it is not open", () => {
    expect(
      renderToString(
        <Portal open={false}>
          <p>popup</p>
        </Portal>,
      ),
    ).toBe("");
  });
});
