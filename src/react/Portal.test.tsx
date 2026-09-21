import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Portal } from "./Portal";

afterEach(() => vi.restoreAllMocks());

describe("Portal", () => {
  it("renders its children in the body, inside a fixed wrapper with an id", () => {
    const { container } = render(
      <Portal>
        <span>menu</span>
      </Portal>,
    );
    expect(container.textContent).toBe("");
    const wrapper = screen.getByText("menu").parentElement;
    expect(wrapper?.parentElement).toBe(document.body);
    expect(wrapper?.style.position).toBe("fixed");
    expect(wrapper?.id).toMatch(/^PORTAL/);
  });

  it("gives two portals two different ids", () => {
    render(
      <>
        <Portal>
          <span>a</span>
        </Portal>
        <Portal>
          <span>b</span>
        </Portal>
      </>,
    );
    expect(screen.getByText("a").parentElement?.id).not.toBe(
      screen.getByText("b").parentElement?.id,
    );
  });

  it("uses the id it is given", () => {
    render(
      <Portal id="tooltip">
        <span>tip</span>
      </Portal>,
    );
    expect(screen.getByText("tip").parentElement?.id).toBe("tooltip");
  });

  it("renders no wrapper when transient", () => {
    render(
      <Portal transient>
        <span>bare</span>
      </Portal>,
    );
    expect(screen.getByText("bare").parentElement).toBe(document.body);
  });

  it("renders in place when disabled", () => {
    const { container } = render(
      <Portal disabled>
        <span>here</span>
      </Portal>,
    );
    expect(screen.getByText("here").parentElement).toBe(container);
  });

  it("renders nothing while open is false, and appears when it turns true", () => {
    function Toggle() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          <Portal open={open}>
            <span>panel</span>
          </Portal>
        </>
      );
    }
    render(<Toggle />);
    expect(screen.queryByText("panel")).toBeNull();
    act(() => screen.getByText("open").click());
    expect(screen.getByText("panel")).toBeTruthy();
  });

  it("renders into the container it is given", () => {
    const host = document.createElement("section");
    document.body.append(host);
    render(
      <Portal container={host} transient>
        <span>inside</span>
      </Portal>,
    );
    expect(screen.getByText("inside").parentElement).toBe(host);
    host.remove();
  });

  it("renders nothing while the container is null, then into it once it exists", () => {
    function Late() {
      const [host, setHost] = useState<HTMLElement | null>(null);
      return (
        <>
          <section ref={setHost} data-testid="host" />
          <Portal container={host} transient>
            <span>late</span>
          </Portal>
        </>
      );
    }
    render(<Late />);
    expect(screen.getByText("late").parentElement).toBe(screen.getByTestId("host"));
    render(
      <Portal container={null}>
        <span>never</span>
      </Portal>,
    );
    expect(screen.queryByText("never")).toBeNull();
  });

  it("removes its content when it unmounts", () => {
    const { unmount } = render(
      <Portal>
        <span>gone</span>
      </Portal>,
    );
    unmount();
    expect(screen.queryByText("gone")).toBeNull();
    expect(document.body.querySelector("[id^=PORTAL]")).toBeNull();
  });

  it("hydrates a server render without a mismatch, and then shows the portal", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = (
      <main>
        <Portal>
          <span>popup</span>
        </Portal>
      </main>
    );
    const root = document.createElement("div");
    document.body.append(root);
    root.innerHTML = renderToString(app);
    expect(root.innerHTML).toBe("<main></main>");
    act(() => {
      hydrateRoot(root, app);
    });
    expect(screen.getByText("popup").parentElement?.parentElement).toBe(document.body);
    expect(error).not.toHaveBeenCalled();
    root.remove();
  });
});
