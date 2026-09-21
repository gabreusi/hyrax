// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useForceUpdate } from "./useForceUpdate";

describe("useForceUpdate on the server", () => {
  it("renders without a DOM", () => {
    function Page() {
      useForceUpdate();
      return <p>ready</p>;
    }
    expect(typeof document).toBe("undefined");
    expect(renderToString(<Page />)).toBe("<p>ready</p>");
  });
});
