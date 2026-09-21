// The reading order of the hand-written pages, and the facts their facts lines show. The sidebar
// and the facts line both read this list, so the two cannot disagree.
//
// Size budgets are the `size-limit` entries of package.json (minified and Brotli-compressed): the
// build fails when an import grows past them. Keep the two in step.

export type CheckState = "run" | "types" | "untested";

export interface Sheet {
  link: string;
  title: string;
  /** The import the page documents. */
  entry?: string;
  runsIn?: string;
  budget?: string;
  /** How the checker treats the ```ts examples of the page (scripts/check-examples.mjs). */
  examples?: CheckState;
}

export interface SheetGroup {
  /** Plain text: the sidebar heading and the title block's "part" field. */
  text: string;
  /** The import path shown next to the heading, when the group is an entrypoint. */
  entry?: string;
  items: Sheet[];
}

const CORE = "@gabreusi/hyrax";
const ANYWHERE = "Node, browsers, Deno, Bun";

export const sheetGroups: SheetGroup[] = [
  {
    text: "Start",
    items: [
      {
        link: "/guide/getting-started",
        title: "Getting started",
        entry: "All three",
        runsIn: "Node 20+, browsers, Deno, Bun",
        budget: "Whole core ≤ 6 kB",
        examples: "run",
      },
    ],
  },
  {
    text: "Core",
    entry: CORE,
    items: [
      {
        link: "/guide/numbers",
        title: "Numbers",
        entry: CORE,
        runsIn: ANYWHERE,
        budget: "clamp ≤ 150 B",
        examples: "run",
      },
      {
        link: "/guide/strings",
        title: "Strings",
        entry: CORE,
        runsIn: ANYWHERE,
        budget: "StringBuilder ≤ 400 B",
        examples: "run",
      },
      {
        link: "/guide/random",
        title: "Random",
        entry: CORE,
        runsIn: ANYWHERE,
        budget: "Random ≤ 4 kB",
        examples: "run",
      },
      {
        link: "/guide/functions",
        title: "Everyday helpers",
        entry: CORE,
        runsIn: ANYWHERE,
        budget: "Whole core ≤ 6 kB",
        examples: "run",
      },
      {
        link: "/guide/suspend",
        title: "Suspend",
        entry: CORE,
        runsIn: ANYWHERE,
        budget: "Suspend ≤ 700 B",
        examples: "run",
      },
    ],
  },
  {
    text: "Browser",
    entry: `${CORE}/dom`,
    items: [
      {
        link: "/guide/dom",
        title: "DOM utilities",
        entry: `${CORE}/dom`,
        runsIn: "Browsers; inert on the server",
        budget: "Whole /dom ≤ 1.5 kB",
        examples: "types",
      },
    ],
  },
  {
    text: "React",
    entry: `${CORE}/react`,
    items: [
      {
        link: "/guide/react",
        title: "React",
        entry: `${CORE}/react`,
        runsIn: "React 18 and 19, server and client",
        budget: "Whole /react ≤ 2 kB",
        examples: "types",
      },
    ],
  },
  {
    text: "Background",
    items: [
      { link: "/notes/design", title: "Design notes" },
      { link: "/migration", title: "Migrating from 0.x" },
    ],
  },
];

export const sheets: Sheet[] = sheetGroups.flatMap((group) => group.items);

/** The sheet for a route such as `guide/numbers.md`, with its position in the reading order. */
export function sheetFor(relativePath: string) {
  const link = "/" + relativePath.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, "");
  const index = sheets.findIndex((sheet) => sheet.link === link);
  if (index < 0) return null;
  const group = sheetGroups.find((g) => g.items.includes(sheets[index]!))!;
  return { sheet: sheets[index]!, group, number: index + 1, total: sheets.length };
}

/** How the example checker treats the ```ts fences of a page, or null for pages it does not read. */
export function examplesFor(relativePath: string): CheckState | null {
  if (relativePath.startsWith("guide/")) {
    return /^guide\/(dom|react)\.md$/.test(relativePath) ? "types" : "run";
  }
  if (relativePath.startsWith("api/hyrax/")) {
    return /^api\/hyrax\/(dom|react)\//.test(relativePath) ? "types" : "run";
  }
  return null;
}

// The size budgets of package.json ("size-limit"): the build fails when an import grows past them.
const API_BUDGETS: Record<string, string> = {
  clamp: "≤ 150 B",
  StringBuilder: "≤ 400 B",
  Suspend: "≤ 700 B",
  Random: "≤ 4 kB",
  listen: "≤ 150 B",
  toPixels: "≤ 900 B",
  useForceUpdate: "≤ 150 B",
  useEventListener: "≤ 450 B",
  useClickOutside: "≤ 650 B",
  useInterval: "≤ 400 B",
  Portal: "≤ 450 B",
  hx: "≤ 850 B",
};

/** The size budget of an API page's export, or null when it has none of its own. */
export function apiBudgetFor(relativePath: string): string | null {
  const name =
    /^api\/hyrax\/(?:(?:dom|react)\/)?(?:classes|functions|variables)\/([^/]+)\.md$/.exec(
      relativePath,
    )?.[1];
  return (name && API_BUDGETS[name]) || null;
}
