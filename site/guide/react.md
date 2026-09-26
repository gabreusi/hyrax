# React

`@gabreusi/hyrax/react` has hooks and two components for React 18 and 19. It is a thin layer over
[`@gabreusi/hyrax/dom`](./dom), it renders on the server without a `document`, and the entrypoint starts with
`"use client"` so that Next.js and other Server Components bundlers know where the client boundary is.

## `useEventListener`

`useEventListener(target, type, handler, options?)` listens for as long as the component is mounted. The handler is read
from the latest render, so it can use fresh props and state without a dependency array, and without listening again.

```tsx
import { useState } from "react";

function Width() {
  const [width, setWidth] = useState(0);
  useEventListener(window, "resize", () => setWidth(window.innerWidth));
  return <p>{width}px</p>;
}
```

The target can be the window, the document, an element, any `EventTarget`, or a ref to one. `null` and `undefined`
listen to nothing. `options` may be a new object on every render: only its content matters.

```tsx
import { useRef } from "react";

function Clicker() {
  const button = useRef<HTMLButtonElement>(null);
  useEventListener(button, "click", (event) => console.log(event.clientX));
  return <button ref={button}>Click</button>;
}
```

A ref is read after the first render. An element that is rendered conditionally, and so appears later, is missed by a
ref: keep it in state with a callback ref (`<div ref={setNode}>`) and pass the state.

On the server there is no `window`, and writing the name throws a `ReferenceError`. Pass `globalThis.window` instead,
which is `undefined` there, and the hook ignores it.

## `useClickOutside`

`useClickOutside(refs, handler, options?)` is [`onClickOutside`](./dom#onclickoutside) for a component. `refs` and
`ignore` take a ref, an element or a list of them, and they are read at every press, so an element that appears later is
found.

```tsx
import { useRef, useState } from "react";

function Menu() {
  const [open, setOpen] = useState(false);
  const popup = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  useClickOutside(popup, () => setOpen(false), { ignore: opener });
  return (
    <>
      <button ref={opener} onClick={() => setOpen(!open)}>
        Menu
      </button>
      {open && <div ref={popup}>Items</div>}
    </>
  );
}
```

"Inside" is decided by the DOM, and not by the React tree. The content of a [`Portal`](#portal) is elsewhere in the page,
so list it in `refs` too, or a press on it counts as outside.

## `useInterval`

`useInterval(handler, delay, options?)` calls the handler every `delay` milliseconds and returns `{ start, stop, isRunning }`. Nothing runs until `start()`, unless you pass `autoStart: true`. With `immediate: true` the handler also runs at the moment it starts.

```tsx
import { useState } from "react";

function Timer() {
  const [seconds, setSeconds] = useState(0);
  const { start, stop, isRunning } = useInterval(() => setSeconds((s) => s + 1), 1000);
  return (
    <button onClick={isRunning ? stop : start}>
      {isRunning ? "Pause" : "Play"} {seconds}
    </button>
  );
}
```

The handler is read from the latest render and does not restart the timer. Changing `delay` while it runs restarts the
timer with the new delay. `start` and `stop` never change between renders, and they take effect when React commits the
update, not on the same line. There is no `delay: null`: to pause, call `stop()`.

In StrictMode, during development, React runs every effect twice on mount, so `immediate` together with `autoStart`
calls the handler twice then.

## `useMediaQuery`

`useMediaQuery(query, fallback = false)` returns whether a media query matches, and renders again when that changes.

```tsx
function Layout() {
  const isWide = useMediaQuery("(min-width: 768px)", true);
  return <main>{isWide ? "sidebar" : "tabs"}</main>;
}
```

The server has no screen to ask, so it renders `fallback`. While hydrating, the hook returns `fallback` too and switches
to the real value right after, so the server markup and the first client render agree and React does not report a
mismatch. Pick as `fallback` what most visitors will see, to avoid a flash.

## `useStorage`

`useStorage(key, fallback, storage?)` is `useState` kept in `localStorage` as JSON. It survives a reload, follows
changes from other tabs, and every component using the same key in the tab shows the same value.

```tsx
function ThemeToggle() {
  const [theme, setTheme] = useStorage<"light" | "dark">("theme", "light");
  return (
    <button onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}>
      {theme}
    </button>
  );
}
```

Like `useMediaQuery`, it renders `fallback` on the server and while hydrating, then switches to the stored value, so
there is no mismatch. `setValue` takes a value or a function of the current one, and `undefined` removes the key. It
is built on [`readStorage` and `writeStorage`](./dom#readstorage-and-writestorage), so it never throws; when storage is
blocked, the value simply stays at what could be read.

## `useDebouncedValue`

`useDebouncedValue(value, wait)` returns a copy of `value` that only changes once `value` has stayed the same for
`wait` milliseconds: the query to search with while the user is still typing.

```tsx
import { useState } from "react";

function Search() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  // fetch results for `debouncedQuery`...
  return <input value={query} onChange={(event) => setQuery(event.target.value)} />;
}
```

Pass a primitive, or a value that keeps its identity between renders: a new object on every render is a change every
time.

## `useSuspend`

`useSuspend(callback, options?)` runs a [`Suspend`](./suspend) detector for as long as the component is mounted, and
calls back when the machine or the tab wakes up: the moment to reconnect a socket or refetch stale data.

```tsx
import { useState } from "react";

function Clock() {
  const [now, setNow] = useState(() => Date.now());
  useSuspend(() => setNow(Date.now()), { threshold: 5000 });
  return <time>{new Date(now).toLocaleTimeString()}</time>;
}
```

The callback is read from the latest render. Changing `threshold` or `interval` starts a new detector.

## `useHotkey` and `useScrollLock`

`useHotkey(combo, handler, options?)` is [`onKey`](./dom#onkey) for as long as the component is mounted, with the
handler read from the latest render. `enabled: false` pauses it, and `target` takes a ref.

```tsx
import { useState } from "react";

function Palette() {
  const [open, setOpen] = useState(false);
  useHotkey("mod+k", () => setOpen((value) => !value));
  useHotkey("Escape", () => setOpen(false), { enabled: open });
  useScrollLock(open);
  return open ? <dialog open>Search…</dialog> : null;
}
```

`useScrollLock(active = true)` is [`lockScroll`](./dom#lockscroll) while `active` is true: the page stays locked until
every component that locked it lets go.

## `useSize` and `useVisible`

`useSize(ref)` returns the size of an element's content box, and `useVisible(ref, options?)` whether it is in the
viewport. Both are built on the observers of `/dom` and start from a safe value on the server and on the first render:
`{ width: 0, height: 0 }` and `false`.

```tsx
import { useRef } from "react";

function Chart() {
  const ref = useRef<HTMLDivElement>(null);
  const { width } = useSize(ref);
  const visible = useVisible(ref, { once: true });
  return <div ref={ref}>{visible ? `a chart ${width}px wide` : null}</div>;
}
```

`useVisible` follows the element in and out; with `once: true` it stays `true` after the first time. The element is
read when the component mounts, so pass an element held in state when it is swapped for another one.

## `useForceUpdate`

`useForceUpdate()` returns a function that renders the component again, for when the screen must follow something that is
not React state: a mutable ref, an external store, a plain object. The function never changes between renders.

```tsx
import { useRef } from "react";

function Clicks() {
  const forceUpdate = useForceUpdate();
  const count = useRef(0);
  return (
    <button
      onClick={() => {
        count.current += 1;
        forceUpdate();
      }}
    >
      {count.current}
    </button>
  );
}
```

## `hx`

`hx.<tag>` is the element, plus shortcuts for common style props: `backgroundColor`, `width`, `height`, `margin`,
`padding`, `color`, `textAlign`, `border`, `borderRadius`, `display`, `position`, `top`, `left`, `right`, `bottom` and
`opacity`. They become `style`, and a shortcut wins over the same key in `style`. Two switches save a ternary:
`rendered={false}` renders nothing, and `transient` renders only the children.

```tsx
function Card({ title }: { title: string }) {
  return <article>{title}</article>;
}
const MaybeCard = hx(Card);

function Page({ isVisible }: { isVisible: boolean }) {
  return (
    <hx.div display="flex" padding="8px" rendered={isVisible}>
      <hx.canvas width={300} height={150} />
      <MaybeCard title="Hello" rendered={false} />
    </hx.div>
  );
}
```

Where the element has that attribute for real, the prop stays the attribute: `width` and `height` of `canvas`, `img`,
`video`, `svg` and a few others, and `border` of `table`. A canvas is sized by the attribute, and not by CSS, so
`<hx.canvas width={300}>` does what you mean, and the types agree with the runtime because both read the same table.

`hx(Component)` gives any component `rendered` and `transient`, and nothing else: it adds no shortcuts, so the component
keeps every prop it declares, `width` included.

## `Portal`

`Portal` renders its children outside of the parent's DOM, in `document.body` or in a `container`: for popups, menus and
dialogs that a parent with `overflow: hidden` or its own stacking context would clip. The children stay in the React
tree, so context and events work as if they were rendered in place.

```tsx
function Dialog({ isOpen }: { isOpen: boolean }) {
  return (
    <Portal open={isOpen}>
      <div role="dialog">Hello</div>
    </Portal>
  );
}
```

It is safe for server rendering: with no `document` it renders nothing, and after hydration it moves into place instead of
causing a mismatch. `open` (default `true`), `disabled` (render in place), `transient` (no wrapper element) and `id` are
its other props. `container` chooses where to render; `null` means "not ready yet" and renders nothing, so you can keep
the element in state with a callback ref:

```tsx
import { useState } from "react";

function Panel() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  return (
    <>
      <section ref={setHost} />
      <Portal container={host}>Rendered inside the section</Portal>
    </>
  );
}
```

## Reference

The full signatures, with every option and error, are in the API reference: [`useEventListener`](/api/hyrax/react/functions/useEventListener), [`useClickOutside`](/api/hyrax/react/functions/useClickOutside), [`useInterval`](/api/hyrax/react/functions/useInterval), [`useMediaQuery`](/api/hyrax/react/functions/useMediaQuery), [`useStorage`](/api/hyrax/react/functions/useStorage), [`useDebouncedValue`](/api/hyrax/react/functions/useDebouncedValue), [`useSuspend`](/api/hyrax/react/functions/useSuspend), [`useHotkey`](/api/hyrax/react/functions/useHotkey), [`useScrollLock`](/api/hyrax/react/functions/useScrollLock), [`useSize`](/api/hyrax/react/functions/useSize), [`useVisible`](/api/hyrax/react/functions/useVisible), [`useForceUpdate`](/api/hyrax/react/functions/useForceUpdate), [`Portal`](/api/hyrax/react/functions/Portal), [`hx`](/api/hyrax/react/variables/hx).
