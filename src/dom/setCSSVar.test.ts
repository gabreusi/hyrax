import { afterEach, describe, expect, it } from "vitest";
import { getCSSVar } from "./getCSSVar";
import { setCSSVar } from "./setCSSVar";

const root = () => document.documentElement.style;

afterEach(() => {
  document.documentElement.removeAttribute("style");
});

describe("setCSSVar", () => {
  it("writes to <html>, where getCSSVar reads", () => {
    setCSSVar("--accent", "#ff5a1f");
    expect(getCSSVar("--accent")).toBe("#ff5a1f");
  });

  it("writes numbers without a unit", () => {
    setCSSVar("--columns", 3);
    setCSSVar("--opacity", 0.5);
    expect(root().getPropertyValue("--columns")).toBe("3");
    expect(root().getPropertyValue("--opacity")).toBe("0.5");
  });

  it("removes the property for null, undefined and numbers that are not finite", () => {
    for (const value of [null, undefined, NaN, Infinity]) {
      setCSSVar("--x", "1");
      setCSSVar("--x", value);
      expect(root().getPropertyValue("--x")).toBe("");
    }
  });

  it("writes to a given element", () => {
    const panel = document.createElement("div");
    setCSSVar("--gap", "12px", panel);
    expect(panel.style.getPropertyValue("--gap")).toBe("12px");
    expect(root().getPropertyValue("--gap")).toBe("");
  });

  it("writes several properties from a record", () => {
    const panel = document.createElement("div");
    panel.style.setProperty("--old", "1");
    setCSSVar({ "--gap": "12px", "--columns": 3, "--old": null }, panel);
    expect(panel.style.getPropertyValue("--gap")).toBe("12px");
    expect(panel.style.getPropertyValue("--columns")).toBe("3");
    expect(panel.style.getPropertyValue("--old")).toBe("");

    setCSSVar({ "--top": "1px" });
    expect(root().getPropertyValue("--top")).toBe("1px");
  });

  it("does nothing for a null element", () => {
    setCSSVar("--gap", "12px", null);
    setCSSVar({ "--gap": "12px" }, null);
    expect(root().getPropertyValue("--gap")).toBe("");
  });
});
