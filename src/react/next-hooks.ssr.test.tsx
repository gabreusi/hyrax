// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useDebouncedValue } from "./useDebouncedValue";
import { useStorage } from "./useStorage";
import { useSuspend } from "./useSuspend";

describe("useStorage, useDebouncedValue and useSuspend on the server", () => {
  it("render the fallback and the first value, and run nothing", () => {
    function Page() {
      const [theme] = useStorage("theme", "light");
      const query = useDebouncedValue("q", 100);
      useSuspend(() => {});
      return <p>{`${theme} ${query}`}</p>;
    }
    expect(typeof window).toBe("undefined");
    expect(renderToString(<Page />)).toBe("<p>light q</p>");
  });
});
