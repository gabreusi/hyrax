// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hx } from "./hx";

describe("hx on the server", () => {
  it("renders the shortcuts as style and the native attributes as attributes", () => {
    expect(typeof document).toBe("undefined");
    expect(
      renderToString(
        <hx.div display="flex" padding="8px">
          <hx.canvas width={300} height={150} />
          <hx.span rendered={false}>hidden</hx.span>
          <hx.b transient>bare</hx.b>
        </hx.div>,
      ),
    ).toBe(
      '<div style="padding:8px;display:flex"><canvas width="300" height="150"></canvas>bare</div>',
    );
  });
});
