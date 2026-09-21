import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import type { ComponentProps, ComponentType, CSSProperties } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hx } from "./hx";

afterEach(() => vi.restoreAllMocks());

describe("hx", () => {
  describe("intrinsic elements", () => {
    it("renders the tag it is named after", () => {
      render(<hx.section data-testid="s">hi</hx.section>);
      expect(screen.getByTestId("s").tagName).toBe("SECTION");
    });

    it("turns the style shortcuts into style", () => {
      render(
        <hx.div
          data-testid="d"
          backgroundColor="red"
          width="10px"
          height={20}
          margin="1px"
          padding="2px"
          color="blue"
          textAlign="center"
          border="1px solid black"
          borderRadius="3px"
          display="flex"
          position="absolute"
          top="1px"
          left="2px"
          right="3px"
          bottom="4px"
          opacity={0.5}
        />,
      );
      const { style } = screen.getByTestId("d");
      expect(style.backgroundColor).toBe("red");
      expect(style.width).toBe("10px");
      expect(style.height).toBe("20px");
      expect(style.color).toBe("blue");
      expect(style.textAlign).toBe("center");
      expect(style.borderRadius).toBe("3px");
      expect(style.display).toBe("flex");
      expect(style.position).toBe("absolute");
      expect(style.opacity).toBe("0.5");
      expect(style.top).toBe("1px");
    });

    it("does not leave a shortcut behind as an attribute", () => {
      render(<hx.div data-testid="d" width="10px" backgroundColor="red" />);
      const div = screen.getByTestId("d");
      expect(div.hasAttribute("width")).toBe(false);
      expect(div.hasAttribute("backgroundColor")).toBe(false);
      expect(div.hasAttribute("backgroundcolor")).toBe(false);
    });

    it("merges the shortcuts into `style`, and a shortcut wins over the same key in `style`", () => {
      render(<hx.div data-testid="d" style={{ width: "1px", zIndex: 4 }} width="9px" />);
      const { style } = screen.getByTestId("d");
      expect(style.width).toBe("9px");
      expect(style.zIndex).toBe("4");
    });

    it("leaves `style` alone when there is no shortcut", () => {
      render(<hx.div data-testid="d" style={{ zIndex: 4 }} />);
      expect(screen.getByTestId("d").getAttribute("style")).toBe("z-index: 4;");
      render(<hx.div data-testid="e" />);
      expect(screen.getByTestId("e").hasAttribute("style")).toBe(false);
    });

    it("skips a shortcut that is undefined", () => {
      render(<hx.div data-testid="d" style={{ width: "1px" }} width={undefined} />);
      expect(screen.getByTestId("d").style.width).toBe("1px");
    });

    it("keeps `width` and `height` as attributes where they are native (canvas, img, video, svg)", () => {
      render(
        <>
          <hx.canvas data-testid="c" width={300} height={150} />
          <hx.img data-testid="i" alt="" width={20} height={10} />
          <hx.video data-testid="v" width={64} />
          <hx.svg data-testid="s" width={8} height={9} />
        </>,
      );
      for (const id of ["c", "i", "v", "s"]) {
        const element = screen.getByTestId(id);
        expect(element.getAttribute("width")).not.toBeNull();
        expect(element.style.width).toBe("");
      }
      expect(screen.getByTestId("c").getAttribute("height")).toBe("150");
    });

    it("keeps `border` as an attribute on a table, and `color` and `width` on a div as style", () => {
      render(
        <>
          <hx.table data-testid="t" border={2} />
          <hx.div data-testid="d" border="1px solid red" />
        </>,
      );
      expect(screen.getByTestId("t").getAttribute("border")).toBe("2");
      expect(screen.getByTestId("t").style.border).toBe("");
      expect(screen.getByTestId("d").style.border).toBe("1px solid red");
    });

    it("still turns the other shortcuts of a tag with native ones into style", () => {
      render(<hx.canvas data-testid="c" width={300} backgroundColor="red" />);
      expect(screen.getByTestId("c").style.backgroundColor).toBe("red");
    });

    it("looks a tag up in the native-attribute table by its own key, not through the prototype", () => {
      // `toString` is inherited by every object: a plain lookup would find a function there.
      const Odd = Reflect.get(hx, "toString") as ComponentType<{ width?: string }>;
      const { container } = render(<Odd width="5px" />);
      expect((container.firstElementChild as HTMLElement).style.width).toBe("5px");
    });

    it("renders nothing when `rendered` is false", () => {
      const { container } = render(<hx.div rendered={false}>hi</hx.div>);
      expect(container.innerHTML).toBe("");
    });

    it("renders only the children when `transient`, without the element", () => {
      const { container } = render(
        <hx.div transient width="10px">
          <span>inner</span>
        </hx.div>,
      );
      expect(container.innerHTML).toBe("<span>inner</span>");
    });

    it("forwards the ref to the element", () => {
      const ref = createRef<HTMLDivElement>();
      render(<hx.div ref={ref} />);
      expect(ref.current?.tagName).toBe("DIV");
    });

    it("passes every other prop through", () => {
      const onClick = vi.fn();
      render(
        <hx.button data-testid="b" id="go" className="btn" onClick={onClick} aria-label="Go">
          go
        </hx.button>,
      );
      const button = screen.getByTestId("b");
      button.click();
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(button.id).toBe("go");
      expect(button.className).toBe("btn");
      expect(button.getAttribute("aria-label")).toBe("Go");
    });

    it("renders a list of children without a key warning", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      render(
        <hx.ul>
          <li>a</li>
          <li>b</li>
        </hx.ul>,
      );
      expect(error).not.toHaveBeenCalled();
    });

    it("renders a void element, which must not receive children", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      render(<hx.input data-testid="in" />);
      expect(screen.getByTestId("in").tagName).toBe("INPUT");
      expect(error).not.toHaveBeenCalled();
    });

    it("gives each component a displayName for the devtools", () => {
      expect(hx.div.displayName).toBe("hx.div");
      expect(hx.canvas.displayName).toBe("hx.canvas");
    });

    it("returns the same component every time, so a re-render does not remount", () => {
      expect(hx.div).toBe(hx.div);
      expect(hx.div).not.toBe(hx.span);
    });

    it("does not turn a symbol key into a component", () => {
      const anyHx = hx as unknown as Record<symbol, unknown>;
      expect(anyHx[Symbol.iterator]).toBeUndefined();
      expect(anyHx[Symbol.toPrimitive]).toBeUndefined();
      expect(anyHx[Symbol.toStringTag]).toBeUndefined();
      expect(() => String(Object.prototype.toString.call(hx))).not.toThrow();
    });
  });

  describe("custom components", () => {
    function Card({
      title,
      style,
      width,
    }: {
      title: string;
      style?: CSSProperties;
      width?: number;
    }) {
      return (
        <article data-testid="card" style={style} data-width={width}>
          {title}
        </article>
      );
    }
    const HxCard = hx(Card);

    it("renders the component with its props", () => {
      render(<HxCard title="Hello" style={{ color: "red" }} />);
      expect(screen.getByTestId("card").textContent).toBe("Hello");
      expect(screen.getByTestId("card").style.color).toBe("red");
    });

    it("supports `rendered` and `transient`", () => {
      const { container } = render(<HxCard title="x" rendered={false} />);
      expect(container.innerHTML).toBe("");
      const { container: other } = render(
        <HxCard title="x" transient>
          <b>kept</b>
        </HxCard>,
      );
      expect(other.innerHTML).toBe("<b>kept</b>");
    });

    it("passes the component's own `width` prop through instead of taking it as a shortcut", () => {
      render(<HxCard title="x" width={7} />);
      expect(screen.getByTestId("card").getAttribute("data-width")).toBe("7");
    });

    it("returns the same wrapper for the same component, and names it", () => {
      expect(hx(Card)).toBe(HxCard);
      expect(HxCard.displayName).toBe("hx(Card)");
    });

    it("names a wrapper for an anonymous component", () => {
      expect(hx(() => null).displayName).toBe("hx(Component)");
    });

    it("does not warn about a ref when nobody passed one (React 18 warns for a function component)", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      render(<HxCard title="x" />);
      expect(error).not.toHaveBeenCalled();
    });
  });

  it("accepts the props of the element it stands for, and no others (types)", () => {
    type DivProps = ComponentProps<typeof hx.div>;
    const ok: DivProps = { width: "10px", rendered: true, onClick: () => {} };
    void ok;
    // @ts-expect-error a div has no `href`
    const bad: DivProps = { href: "/" };
    void bad;
  });
});
