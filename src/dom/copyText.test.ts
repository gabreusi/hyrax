import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./copyText";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyText", () => {
  it("writes to the clipboard and resolves true", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(copyText("hi")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hi");
  });

  it("resolves false when the browser refuses or there is no clipboard", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: () => Promise.reject(new DOMException("denied", "NotAllowedError")) },
    });
    await expect(copyText("hi")).resolves.toBe(false);
    vi.stubGlobal("navigator", {});
    await expect(copyText("hi")).resolves.toBe(false);
  });
});
