# @gabreusi/hyrax

## 1.0.0-rc.0

### Major Changes

- Hyrax is rebuilt from scratch as an isomorphic TypeScript toolkit, and is now published as `@gabreusi/hyrax` (the 0.x package was `@gpsign/hyrax`).

  - **Three entrypoints, split by where the code runs.** `@gabreusi/hyrax` runs anywhere (numbers, strings, `Random`, `StringBuilder`, `Suspend` and more), `@gabreusi/hyrax/dom` needs a browser (`getCSSVar`, `toPixels`, `listen`, `onClickOutside`), and `@gabreusi/hyrax/react` has the hooks, `hx` and `Portal` for React 18 and 19. ESM and CommonJS builds with their own types, no runtime dependencies, tree-shakeable, and safe to render on the server.
  - **`Random` is reproducible and has no bias.** A seed gives the same numbers in every runtime. It has an optional `luck`, `fork`, `state` and `restore`, weighted choices, dice notation, and `Random.secure()` for secrets.
  - **The DOM and React utilities were rewritten**, and they fix a number of bugs of 0.x: capture listeners that were never removed, percentages measured against the window and not the container, a click-outside that could not cross Shadow DOM, and a `Portal` that broke server rendering.
  - **Documented, and the examples are tests.** There is a site with a guide per module and a generated API reference, and every code example in them is checked against the built package.

  This is a breaking change from 0.x in every corner: the API uses named imports only, and several functions were renamed, changed or removed. The migration guide lists all of it: https://gabreusi.github.io/hyrax/migration
