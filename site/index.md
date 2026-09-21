---
layout: home

hero:
  name: Hyrax
  text: A small toolkit for TypeScript
  tagline: Seeded random, number and string helpers, and DOM and React utilities. Zero dependencies, for Node, browsers, Deno and Bun.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: API reference
      link: /api/
    - theme: alt
      text: GitHub
      link: https://github.com/gabreusi/hyrax

features:
  - title: Random you can trust
    details: A seeded generator that gives the same numbers in every runtime, with no modulo bias, an optional "luck" and a cryptographic mode for tokens.
    link: /guide/random
    linkText: Read the guide
  - title: Not a React library
    details: The core runs anywhere. DOM code lives in its own entrypoint, and the React hooks are a thin layer over it, so Vue, Svelte and plain JavaScript get the same tools.
    link: /guide/getting-started#entrypoints
    linkText: The three entrypoints
  - title: Tree-shakeable and tiny
    details: One function costs what it weighs. clamp is 76 bytes, and the whole DOM entrypoint is about 1 kB, minified and compressed.
    link: /notes/design#size
    linkText: Design notes
  - title: Safe to server-render
    details: Every DOM function and every React hook and component imports and renders where there is no document, without throwing.
    link: /guide/dom
    linkText: DOM utilities
  - title: Examples that are tests
    details: Every code example in these pages and in the API reference is type-checked against the built package, and the ones for the core are run.
    link: /notes/design#tested-examples
    linkText: How it works
  - title: Migrating from 0.x
    details: A table of what was renamed, changed or removed, and why.
    link: /migration
    linkText: Migration guide
---
