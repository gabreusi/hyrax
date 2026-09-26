// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useHotkey } from "./useHotkey";
import { useScrollLock } from "./useScrollLock";
import { useSize } from "./useSize";
import { useVisible } from "./useVisible";

describe("useHotkey, useScrollLock, useSize and useVisible on the server", () => {
  it("render the safe values and run nothing", () => {
    function Page() {
      useHotkey("mod+k", () => {});
      useScrollLock();
      const { width } = useSize(null);
      const visible = useVisible(null);
      return <p>{`${width} ${String(visible)}`}</p>;
    }
    expect(typeof window).toBe("undefined");
    expect(renderToString(<Page />)).toBe("<p>0 false</p>");
  });
});
