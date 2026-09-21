import { createElement, forwardRef, Fragment } from "react";
import type { ComponentType, CSSProperties, JSX, NamedExoticComponent, ReactNode } from "react";

const shortcutKeys = [
  "backgroundColor",
  "width",
  "height",
  "margin",
  "padding",
  "color",
  "textAlign",
  "border",
  "borderRadius",
  "display",
  "position",
  "top",
  "left",
  "right",
  "bottom",
  "opacity",
] as const;

/** The names that `hx` accepts as props and turns into `style`. */
export type HxShortcutKey = (typeof shortcutKeys)[number];

type Shortcuts = { [K in HxShortcutKey]?: CSSProperties[K] };

/**
 * The tags where a shortcut name is also a real attribute, so `<hx.canvas width={300}>` sets the
 * attribute (a canvas is sized by it, not by CSS) instead of the style. The types and the runtime
 * both read this one table, so they cannot disagree.
 */
const nativeAttributes = {
  canvas: ["width", "height"],
  embed: ["width", "height"],
  iframe: ["width", "height"],
  img: ["width", "height"],
  input: ["width", "height"],
  object: ["width", "height"],
  source: ["width", "height"],
  video: ["width", "height"],
  svg: ["width", "height"],
  rect: ["width", "height"],
  image: ["width", "height"],
  foreignObject: ["width", "height"],
  use: ["width", "height"],
  pattern: ["width", "height"],
  mask: ["width", "height"],
  filter: ["width", "height"],
  symbol: ["width", "height"],
  table: ["border"],
} as const satisfies { [T in keyof JSX.IntrinsicElements]?: readonly HxShortcutKey[] };

type NativeKeys<T extends keyof JSX.IntrinsicElements> = T extends keyof typeof nativeAttributes
  ? (typeof nativeAttributes)[T][number]
  : never;

/** The props `hx` adds to every component. */
export interface HxExtraProps {
  /** Renders nothing while `false`. */
  rendered?: boolean;
  /** Renders only the children, without the element. */
  transient?: boolean;
}

/** The props of `hx.<tag>`: those of the element, the style shortcuts that do not clash, and the extras. */
export type HxProps<T extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[T] &
  Omit<Shortcuts, NativeKeys<T>> &
  HxExtraProps;

/** The type of {@link hx}. */
export type HxType = {
  <P extends object>(
    Component: ComponentType<P>,
  ): NamedExoticComponent<P & HxExtraProps & { children?: ReactNode }>;
} & {
  readonly [T in keyof JSX.IntrinsicElements]: NamedExoticComponent<HxProps<T>>;
};

interface AnyProps extends HxExtraProps {
  children?: ReactNode;
  style?: CSSProperties;
  [prop: string]: unknown;
}

const noNative: readonly string[] = [];

function createIntrinsic(tag: string): NamedExoticComponent<AnyProps> {
  // `hasOwn`: a tag called `toString` must not find the function every object inherits.
  const native: readonly string[] = Object.hasOwn(nativeAttributes, tag)
    ? nativeAttributes[tag as keyof typeof nativeAttributes]
    : noNative;

  const Hx = forwardRef<unknown, AnyProps>(function Hx(props: AnyProps, ref) {
    const { rendered, transient, children, style, ...rest } = props;
    if (rendered === false) return null;
    if (transient) return createElement(Fragment, null, children);

    const shortcuts: Record<string, unknown> = {};
    let used = false;
    for (const key of shortcutKeys) {
      if (native.includes(key) || !(key in rest)) continue;
      if (rest[key] !== undefined) {
        shortcuts[key] = rest[key];
        used = true;
      }
      delete rest[key];
    }
    return createElement(tag, {
      ...rest,
      style: used ? { ...style, ...shortcuts } : style,
      ref,
      children,
    });
  });
  Hx.displayName = `hx.${tag}`;
  return Hx;
}

function createWrapper(Component: ComponentType<AnyProps>): NamedExoticComponent<AnyProps> {
  const Wrapper = forwardRef<unknown, AnyProps>(function HxWrapper(props: AnyProps, ref) {
    const { rendered, transient, children, ...rest } = props;
    if (rendered === false) return null;
    if (transient) return createElement(Fragment, null, children);
    return createElement(Component, { ...rest, children, ref });
  });
  Wrapper.displayName = `hx(${Component.displayName ?? (Component.name || "Component")})`;
  return Wrapper;
}

const intrinsics = new Map<string, NamedExoticComponent<AnyProps>>();
const wrappers = new WeakMap<ComponentType<AnyProps>, NamedExoticComponent<AnyProps>>();

/**
 * Components with shortcuts for common style props, and two switches that save a ternary.
 *
 * `hx.<tag>` is the element, plus `backgroundColor`, `width`, `height`, `margin`, `padding`,
 * `color`, `textAlign`, `border`, `borderRadius`, `display`, `position`, `top`, `left`, `right`,
 * `bottom` and `opacity` as props that become `style` (a shortcut wins over the same key in
 * `style`). Where the element has that attribute for real (`width` and `height` of a `canvas`,
 * `img`, `video` or `svg`, `border` of a `table`) the prop stays the attribute.
 *
 * `rendered={false}` renders nothing, and `transient` renders only the children. `hx(Component)`
 * gives any component those two switches; it adds no shortcuts, so the component keeps every prop
 * it declares, `width` included.
 *
 * @example
 * ```tsx
 * function Card({ title }: { title: string }) {
 *   return <article>{title}</article>;
 * }
 * const MaybeCard = hx(Card);
 *
 * function Page({ isVisible }: { isVisible: boolean }) {
 *   return (
 *     <hx.div display="flex" padding="8px" rendered={isVisible}>
 *       <hx.canvas width={300} height={150} />
 *       <MaybeCard title="Hello" rendered={false} />
 *     </hx.div>
 *   );
 * }
 * ```
 */
export const hx: HxType = /* @__PURE__ */ new Proxy(() => {}, {
  apply(_target, _this, [Component]: [ComponentType<AnyProps>]) {
    let wrapper = wrappers.get(Component);
    if (!wrapper) wrappers.set(Component, (wrapper = createWrapper(Component)));
    return wrapper;
  },
  get(_target, tag) {
    // Symbols are how the language and the tools look at an object (`Symbol.toPrimitive`,
    // `Symbol.toStringTag`, inspection): none of them is a tag.
    if (typeof tag === "symbol") return undefined;
    let component = intrinsics.get(tag);
    if (!component) intrinsics.set(tag, (component = createIntrinsic(tag)));
    return component;
  },
}) as unknown as HxType;
