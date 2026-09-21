# DOM utilities

`@gabreusi/hyrax/dom` has four functions for the browser, with no framework: use them from Vue, Svelte, React or plain
JavaScript. The React hooks are a thin layer over `listen` and `onClickOutside`.

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

The full signatures, with every option and error, are in the API reference: [`getCSSVar`](/api/hyrax/dom/functions/getCSSVar), [`toPixels`](/api/hyrax/dom/functions/toPixels), [`listen`](/api/hyrax/dom/functions/listen), [`onClickOutside`](/api/hyrax/dom/functions/onClickOutside).
