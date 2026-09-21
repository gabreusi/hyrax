// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useClickOutside } from "./useClickOutside";

describe("useClickOutside on the server", () => {
  it("renders without a DOM", () => {
    function Page() {
      useClickOutside({ current: null }, () => {});
      return <p>ready</p>;
    }
    expect(typeof document).toBe("undefined");
    expect(renderToString(<Page />)).toBe("<p>ready</p>");
  });
});
