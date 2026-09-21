import { render } from "@testing-library/react";
import { useRef, useState } from "react";
import { userEvent } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { Portal } from "./Portal";
import { useClickOutside } from "./useClickOutside";

/** The popup an app would build: an opener, a panel, and a press anywhere else that closes it. */
function Menu({ withPortal = false }: { withPortal?: boolean }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useClickOutside(panel, () => setOpen(false), { ignore: opener });

  const content = (
    <div ref={panel}>
      <button>item</button>
    </div>
  );
  return (
    <>
      <button ref={opener} onClick={() => setOpen((value) => !value)}>
        toggle
      </button>
      <p>elsewhere</p>
      {open && (withPortal ? <Portal>{content}</Portal> : content)}
    </>
  );
}

describe("useClickOutside in a real browser", () => {
  it("opens with the opener, stays open on a press inside, and closes on a press outside", async () => {
    const { getByText, queryByText } = render(<Menu />);
    await userEvent.click(getByText("toggle"));
    expect(queryByText("item")).not.toBeNull();
    await userEvent.click(getByText("item"));
    expect(queryByText("item")).not.toBeNull();
    await userEvent.click(getByText("elsewhere"));
    expect(queryByText("item")).toBeNull();
  });

  it("does not close and reopen when the opener is pressed, because it is ignored", async () => {
    const { getByText, queryByText } = render(<Menu />);
    await userEvent.click(getByText("toggle"));
    await userEvent.click(getByText("toggle"));
    expect(queryByText("item")).toBeNull();
  });

  it("treats a press inside a Portal as inside when the portal content is a ref", async () => {
    const { getByText, queryByText } = render(<Menu withPortal />);
    await userEvent.click(getByText("toggle"));
    await userEvent.click(getByText("item"));
    expect(queryByText("item")).not.toBeNull();
    await userEvent.click(getByText("elsewhere"));
    expect(queryByText("item")).toBeNull();
  });
});
