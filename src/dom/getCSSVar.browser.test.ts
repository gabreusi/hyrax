import { afterEach, describe, expect, it } from "vitest";
import { getCSSVar } from "./getCSSVar";

afterEach(() => {
  document.head.querySelectorAll("style").forEach((style) => style.remove());
});

describe("getCSSVar in a real browser", () => {
  it("returns a trimmed value even when the stylesheet is loosely formatted", () => {
    const style = document.createElement("style");
    style.textContent = ":root {\n  --loose:\n     12px\n  ;\n}";
    document.head.appendChild(style);
    expect(getCSSVar("--loose")).toBe("12px");
  });

  it("sees values that come from the cascade, not only from inline styles", () => {
    const style = document.createElement("style");
    style.textContent = "html { --from-selector: 3rem; } :root { --from-root: 4rem; }";
    document.head.appendChild(style);
    expect(getCSSVar("--from-selector")).toBe("3rem");
    expect(getCSSVar("--from-root")).toBe("4rem");
  });

  it("keeps the fallback for a property that resolves to nothing", () => {
    expect(getCSSVar("--never-declared", "none")).toBe("none");
  });
});
