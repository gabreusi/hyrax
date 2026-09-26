import { afterEach, describe, expect, it } from "vitest";
import { lockScroll } from "./lockScroll";

afterEach(() => {
  document.body.removeAttribute("style");
});

describe("lockScroll", () => {
  it("hides the overflow of <body> and restores what was there", () => {
    document.body.style.overflow = "scroll";
    const unlock = lockScroll();
    expect(document.body.style.overflow).toBe("hidden");
    unlock();
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("counts locks: the page scrolls again only when the last one is released", () => {
    const first = lockScroll();
    const second = lockScroll();
    first();
    first();
    expect(document.body.style.overflow).toBe("hidden");
    second();
    expect(document.body.style.overflow).toBe("");
  });
});
