# DOM utilities

`@gabreusi/hyrax/dom` has functions for the browser, with no framework: use them from Vue, Svelte, React or plain
JavaScript. The React hooks are a thin layer over them.

Every function is **safe to import and call where there is no `document`** (a server render, a worker, Node): it returns
its fallback, or does nothing, and never throws. Nothing runs when you import the module.

## `getCSSVar`

`getCSSVar(name, fallback?)` reads a custom property from `:root`, trimmed. A missing or empty property gives the
fallback (`null` if you give none), and the fallback can be any type.

```ts
// :root { --primary: #3498db; }
getCSSVar("--primary"); // "#3498db"
getCSSVar("--missing"); // null
getCSSVar("--missing", "red"); // "red"
getCSSVar("--gap", 16); // "12px" when defined, otherwise 16
```

It only looks at the document element, so a variable defined on `<body>` or on another element is not seen.

## `setCSSVar`

`setCSSVar(name, value, element?)` writes a custom property to the inline style of `<html>`, where `getCSSVar` reads it,
or of the element you pass. An object sets several at once. A number is written with no unit, as React does for custom
properties, so it also works for unitless values; `null`, `undefined` and a number that is not finite remove the
property instead of writing `"null"` or `"NaN"`.

```ts
setCSSVar("--accent", "#ff5a1f");
setCSSVar("--columns", 3); // "3", not "3px"
setCSSVar("--accent", null); // removes it

const panel = document.createElement("div");
setCSSVar({ "--gap": "12px", "--columns": 3 }, panel);
```

A `null` element (a ref that is not set yet) does nothing.

## `readStorage` and `writeStorage`

`localStorage` throws in more places than people expect: a private window, a sandboxed iframe, a full quota, a value
that is not valid JSON, and the server, where there is no window. `readStorage(key, fallback)` returns the parsed value
or `fallback`, and `writeStorage(key, value)` returns whether it worked. Neither throws.

```ts
writeStorage("settings", { theme: "dark" }); // true, or false when storage is blocked
readStorage("settings", { theme: "light" }); // { theme: "dark" }, or the fallback
readStorage("missing", 10); // 10
writeStorage("settings", undefined); // removes the key
```

Pass `sessionStorage` (or any `Storage`) as the last argument to use another store. On the server they never touch a
global store, not even the one Node has, since it would be shared by every request. The value is parsed, not validated:
it is typed like the fallback, so check its shape when it may come from an older version of your app.

## `observeSize` and `onVisible`

`observeSize(element, callback, options?)` calls back with the `ResizeObserverEntry` whenever the size of the element
changes, and once right after it starts when the element already has a size. `onVisible(element, callback, options?)` calls back when the element enters the
viewport; with `once: true` it stops after the first time, which is what lazy loading needs.

```ts
const panel = document.createElement("div");
const off = observeSize(panel, (entry) => console.log(entry.contentRect.width));

const image = document.createElement("img");
onVisible(image, () => (image.src = image.dataset.src ?? ""), { once: true, rootMargin: "200px" });

off();
```

Both return the function that stops observing, like `listen`. A `null` element (a ref that is not set yet), a server
render or a runtime without the observer do nothing. Leaving the viewport is not reported by `onVisible`; for that,
use an `IntersectionObserver` directly.

## `onKey`

`onKey(target, combo, handler, options?)` calls the handler when a keyboard shortcut is pressed, and returns the
function that stops listening, like `listen`. A combination is modifiers and a key joined by `+`, in any case, and a
list matches any of them.

```ts
const off = onKey(window, "mod+k", () => console.log("open the palette"));
onKey(document, ["Escape", "mod+."], () => console.log("close"));
off();
```

`mod` is ⌘ on Apple devices and Ctrl elsewhere. Modifiers match exactly, so `"k"` does not fire on Ctrl+K. Letters and
digits are also matched by the physical key, so `"alt+a"` works on a Mac, where Alt+A types `å`. A symbol such as `?`
does not need `shift+`.

Two defaults make it safe to bind single keys. A combination that types a character (`"/"`, `"k"`) is ignored while the
user is typing in a field, and a match calls `preventDefault()`, so `mod+s` does not open the browser's save dialog.
Both can be turned off with `ignoreInputs: false` and `preventDefault: false`.

## `lockScroll`

`lockScroll()` stops the page from scrolling, for a modal or a drawer, and returns the function that lets it scroll
again. The width of the scrollbar that disappears is added as padding, so the content does not jump sideways.

```ts
const unlock = lockScroll();
// ...the dialog is open...
unlock();
```

Locks are counted: with two dialogs open, closing one keeps the page locked until the other closes too. It sets
`overflow: hidden` on `<body>`, which older versions of iOS Safari ignored for touch scrolling.

## `copyText`

`copyText(text)` copies to the clipboard and resolves to whether it worked. It never rejects: without a clipboard, outside
a secure context (`https` or `localhost`), or when the browser refuses, it resolves to `false`, so the button can say
"Press Ctrl+C" instead. Browsers usually only allow it from a user action, such as a click.

```ts
const button = document.createElement("button");
button.addEventListener("click", () => {
  void copyText("npm install @gabreusi/hyrax").then((copied) => {
    button.textContent = copied ? "Copied" : "Press Ctrl+C";
  });
});
```

There is no fallback to the old `document.execCommand("copy")`, which browsers deprecated.

## `toPixels`

`toPixels(value, element?)` turns a CSS length into a number of pixels, by laying it out in the browser. It understands
what CSS understands: `em`, `%`, `dvh`, `calc()`, `min()`, negative values and `var()`.

```ts
const panel = document.querySelector<HTMLElement>("#panel")!;

toPixels("2em"); // 32 when the page font size is 16px
toPixels("50%", panel); // half the width of the panel
toPixels("calc(100vh - var(--header))"); // a number of pixels
toPixels("--gap"); // the same as toPixels("var(--gap)")
toPixels(-1.5); // -1.5 (a number is already pixels)
```

The `element` (the page body by default) is the context for `em`, `%` and variables. When it cannot resolve a value it
returns **`NaN`** and not `0`, because `0` is a real size that you could mistake it for:

```ts
const width = toPixels("nonsense");
const usable = Number.isNaN(width) ? 240 : width;
```

`toPixels` needs a layout engine. An element that is `display: none`, or not in the document, gives `NaN` for a
percentage. The keywords `auto`, `inherit`, `initial`, `unset` and `revert` are not lengths, and give `NaN`.

## `listen`

`listen(target, type, handler, options?)` is `addEventListener` with the event typed by name, that gives back the
function that removes it. The target can be the window, the document, an element or any `EventTarget`, and `null` or
`undefined` listens to nothing.

```ts
const off = listen(window, "resize", (event) => console.log(event.type));
off();

const button = document.querySelector<HTMLButtonElement>("button");
listen(button, "click", (event) => console.log(event.clientX)); // clientX: the event is a MouseEvent
```

The function it returns removes the listener with the same capture flag it was added with. (`removeEventListener`
without the flag silently keeps a capture listener, which is how listeners leak.)

## `onClickOutside`

`onClickOutside(targets, handler, options?)` calls the handler when the user presses **outside** of the targets: the
usual way to close a menu, a popup or a dialog. It gives back the function that stops it.

```ts
const menu = document.querySelector<HTMLElement>("#menu")!;
const openButton = document.querySelector<HTMLElement>("#open")!;

const off = onClickOutside(menu, () => menu.classList.remove("open"), { ignore: openButton });
off();
```

It listens for `pointerdown` in the capture phase, so it covers mouse, touch and pen, and a `stopPropagation()` inside
the menu cannot hide a press from it. "Inside" is decided by the event's `composedPath()`, so it works across Shadow
DOM, and it still sees a node that another handler removed while the event was travelling.

| Option               | Default         | Effect                                                                                                 |
| -------------------- | --------------- | ------------------------------------------------------------------------------------------------------ |
| `event`              | `"pointerdown"` | Any document event: `"click"`, `"mousedown"`, `"focusin"`... The handler's type follows.               |
| `capture`            | `true`          | Listen in the capture phase. `false` listens while the event bubbles.                                  |
| `ignore`             | none            | Elements that count as inside, such as the button that opens the popup.                                |
| `requireInsideFirst` | `false`         | Only call the handler after a press _inside_, and again only after another one. It was `BlurListener`. |

`targets` can be an element, a list of elements, or a **function** that is called at every press, which is how you point
at something that appears later:

```ts
let dialog: HTMLElement | null = null;
onClickOutside(
  () => dialog,
  () => console.log("outside"),
);
dialog = document.createElement("div");
```

## Reference

The full signatures, with every option and error, are in the API reference: [`getCSSVar`](/api/hyrax/dom/functions/getCSSVar), [`toPixels`](/api/hyrax/dom/functions/toPixels), [`listen`](/api/hyrax/dom/functions/listen), [`onClickOutside`](/api/hyrax/dom/functions/onClickOutside), [`setCSSVar`](/api/hyrax/dom/functions/setCSSVar), [`readStorage`](/api/hyrax/dom/functions/readStorage), [`writeStorage`](/api/hyrax/dom/functions/writeStorage), [`observeSize`](/api/hyrax/dom/functions/observeSize), [`onVisible`](/api/hyrax/dom/functions/onVisible), [`copyText`](/api/hyrax/dom/functions/copyText), [`onKey`](/api/hyrax/dom/functions/onKey), [`lockScroll`](/api/hyrax/dom/functions/lockScroll).
