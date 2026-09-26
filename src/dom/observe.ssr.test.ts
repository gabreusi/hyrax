// @vitest-environment node
import { describe, expect, it } from "vitest";
import { copyText } from "./copyText";
import { observeSize, onVisible } from "./observe";

describe("observers and the clipboard without a DOM (server-side rendering)", () => {
  it("observe nothing and resolve false instead of throwing", async () => {
    expect(typeof document).toBe("undefined");
    expect(typeof observeSize(null, () => {})).toBe("function");
    expect(typeof onVisible(null, () => {})).toBe("function");
    await expect(copyText("hi")).resolves.toBe(false);
  });
});
