import { describe, expect, it } from "vitest";

describe("the browser test project", () => {
  it("runs in a real browser, not in a simulated DOM", () => {
    expect(navigator.userAgent).toContain("Chrome");
    expect(navigator.userAgent).not.toContain("happy-dom");
  });

  it("computes real layout: a 50% child of a 400px parent is 200px wide", () => {
    // happy-dom leaves `50%` unresolved, which is why /dom measures layout in this project.
    const parent = document.createElement("div");
    parent.style.width = "400px";
    const child = document.createElement("div");
    child.style.width = "50%";
    parent.appendChild(child);
    document.body.appendChild(parent);
    expect(getComputedStyle(child).width).toBe("200px");
    parent.remove();
  });
});
