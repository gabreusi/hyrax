import { afterEach, describe, expect, it } from "vitest";
import { lockScroll } from "./lockScroll";

afterEach(() => {
  document.body.innerHTML = "";
  document.body.removeAttribute("style");
});

describe("lockScroll in a real browser", () => {
  it("keeps the content where it was by padding the gap of the scrollbar", () => {
    const tall = document.createElement("div");
    tall.style.height = "5000px";
    document.body.appendChild(tall);
    const width = tall.getBoundingClientRect().width;

    const unlock = lockScroll();
    expect(tall.getBoundingClientRect().width).toBe(width);
    unlock();
    expect(document.body.style.paddingRight).toBe("");
  });
});
