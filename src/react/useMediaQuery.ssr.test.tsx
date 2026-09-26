// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useMediaQuery } from "./useMediaQuery";

describe("useMediaQuery on the server", () => {
  it("renders the fallback", () => {
    function Page({ fallback }: { fallback?: boolean }) {
      return <p>{useMediaQuery("(min-width: 768px)", fallback) ? "wide" : "narrow"}</p>;
    }
    expect(typeof window).toBe("undefined");
    expect(renderToString(<Page />)).toBe("<p>narrow</p>");
    expect(renderToString(<Page fallback />)).toBe("<p>wide</p>");
  });
});
