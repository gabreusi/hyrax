// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useInterval } from "./useInterval";

describe("useInterval on the server", () => {
  it("renders the initial state and starts no timer", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    function Page() {
      const { isRunning } = useInterval(() => {}, 100, { autoStart: true });
      return <p>{String(isRunning)}</p>;
    }
    expect(renderToString(<Page />)).toBe("<p>true</p>");
    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });
});
