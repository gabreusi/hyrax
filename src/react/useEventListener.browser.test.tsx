import { render } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useEventListener } from "./useEventListener";

function Probe({ options, handler }: { options?: boolean; handler: () => void }) {
  useEventListener(window, "hyrax:ping" as "resize", handler, options);
  return null;
}

describe("useEventListener in a real browser", () => {
  it("removes a capture listener when the component unmounts", () => {
    // happy-dom removes a capture listener even when the removal forgets the capture flag, so
    // this can only be proven here: the legacy hook never removed one.
    const handler = vi.fn();
    const { unmount } = render(<Probe options handler={handler} />);
    window.dispatchEvent(new Event("hyrax:ping"));
    expect(handler).toHaveBeenCalledTimes(1);
    unmount();
    window.dispatchEvent(new Event("hyrax:ping"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("removes the old listener when the capture flag changes", () => {
    const handler = vi.fn();
    function Flip() {
      const [capture, setCapture] = useState(true);
      return (
        <>
          <button onClick={() => setCapture(false)}>flip</button>
          <Probe options={capture} handler={handler} />
        </>
      );
    }
    const { getByText } = render(<Flip />);
    getByText("flip").click();
    // Let React commit the flip.
    return Promise.resolve().then(() => {
      handler.mockClear();
      window.dispatchEvent(new Event("hyrax:ping"));
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
