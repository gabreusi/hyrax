// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useEventListener } from "./useEventListener";

describe("useEventListener on the server", () => {
  it("renders without a DOM, and globalThis.window is a target that is simply ignored", () => {
    function Page() {
      useEventListener(globalThis.window, "resize", () => {});
      useEventListener(globalThis.document, "click", () => {});
      return <p>ready</p>;
    }
    expect(typeof window).toBe("undefined");
    expect(renderToString(<Page />)).toBe("<p>ready</p>");
  });
});
