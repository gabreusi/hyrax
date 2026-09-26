import { afterEach, describe, expect, it } from "vitest";
import { observeSize, onVisible } from "./observe";

const nextFrames = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("observeSize in a real browser", () => {
  it("reports the size at start and after a change, and stops after off()", async () => {
    const box = document.createElement("div");
    box.style.width = "100px";
    document.body.appendChild(box);
    const widths: number[] = [];
    const off = observeSize(box, (entry) => widths.push(entry.contentRect.width));

    await nextFrames();
    box.style.width = "150px";
    await nextFrames();
    off();
    box.style.width = "200px";
    await nextFrames();
    expect(widths).toEqual([100, 150]);
  });
});

describe("onVisible in a real browser", () => {
  it("reports an element in the viewport, and not one far below it", async () => {
    const near = document.createElement("div");
    const far = document.createElement("div");
    near.style.height = far.style.height = "10px";
    far.style.marginTop = "10000px";
    document.body.append(near, far);
    const seen: Element[] = [];
    const offNear = onVisible(near, (entry) => seen.push(entry.target), { once: true });
    const offFar = onVisible(far, (entry) => seen.push(entry.target));

    await nextFrames();
    await nextFrames();
    expect(seen).toEqual([near]);
    offNear();
    offFar();
  });
});
