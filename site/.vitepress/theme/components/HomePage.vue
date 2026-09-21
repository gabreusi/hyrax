<script setup lang="ts">
// The home page. It leads with a working lab, then says why the answers can be trusted. Every answer
// in the ledger is computed by the source when the page renders and compared with the value written
// here; the tick only appears when they agree.
import { computed, onMounted, ref } from "vue";
import { withBase } from "vitepress";
import {
  clamp,
  coalesce,
  lerp,
  Random,
  ratio,
  remap,
  toCamelCase,
  toKebabCase,
} from "@hyrax-source";
import { highlight, literal } from "../highlight";
import CheckMark from "./CheckMark.vue";
import LabCode from "./LabCode.vue";
import Playground from "./Playground.vue";

const INSTALL = "npm install @gabreusi/hyrax";
const api = (path: string) => withBase(`/api/hyrax/${path}`);

const worked = [
  { code: "clamp(15, 0, 10)", expected: 10, actual: () => clamp(15, 0, 10) },
  { code: "ratio(30, 60)", expected: 0.5, actual: () => ratio(30, 60) },
  { code: "remap(5, [0, 10], [0, 100])", expected: 50, actual: () => remap(5, [0, 10], [0, 100]) },
  { code: "lerp(0, 10, 0.5)", expected: 5, actual: () => lerp(0, 10, 0.5) },
  {
    code: 'toCamelCase("XMLHttpRequest")',
    expected: "xmlHttpRequest",
    actual: () => toCamelCase("XMLHttpRequest"),
  },
  {
    code: 'toKebabCase("Ação rápida")',
    expected: "ação-rápida",
    actual: () => toKebabCase("Ação rápida"),
  },
  {
    code: 'coalesce(null, undefined, 0, "x")',
    expected: 0,
    actual: () => coalesce(null, undefined, 0, "x"),
  },
  {
    code: 'new Random("level-1").int(1, 100)',
    expected: 25,
    actual: () => new Random("level-1").int(1, 100),
  },
];
const ledger = computed(() =>
  worked.map((row) => ({
    code: row.code,
    result: literal(row.expected),
    ok: literal(row.actual()) === literal(row.expected),
  })),
);
const allOk = computed(() => ledger.value.every((row) => row.ok));

const entrypoints = [
  {
    id: "core",
    name: "Core",
    entry: "@gabreusi/hyrax",
    sample: 'import { clamp, Random } from "@gabreusi/hyrax";',
    runsIn: "Anywhere: Node 20+, browsers, Deno, Bun",
    about:
      "Pure functions and three small classes. No DOM and no React in its types; the compiler enforces it.",
    groups: [
      { label: "Numbers", names: ["clamp", "lerp", "ratio", "remap"], kind: "functions" },
      { label: "Strings", names: ["toCamelCase", "toKebabCase", "splitWords"], kind: "functions" },
      { label: "Classes", names: ["Random", "StringBuilder", "Suspend"], kind: "classes" },
      {
        label: "Helpers",
        names: ["coalesce", "fabricate", "toNumber", "alias"],
        kind: "functions",
      },
    ],
    prefix: "",
    guide: "/guide/numbers",
    cost: "4.6 kB",
    costNote: "for all of it; clamp alone is 76 B",
  },
  {
    id: "dom",
    name: "Browser",
    entry: "@gabreusi/hyrax/dom",
    sample: 'import { listen } from "@gabreusi/hyrax/dom";',
    runsIn: "Browsers, and inert on a server",
    about:
      "Framework-free DOM helpers. Importing or calling them without a document returns the fallback.",
    groups: [
      {
        label: "Functions",
        names: ["listen", "onClickOutside", "toPixels", "getCSSVar"],
        kind: "functions",
      },
    ],
    prefix: "dom/",
    guide: "/guide/dom",
    cost: "1.1 kB",
    costNote: "for all of it; listen alone is 85 B",
  },
  {
    id: "react",
    name: "React",
    entry: "@gabreusi/hyrax/react",
    sample: 'import { useClickOutside } from "@gabreusi/hyrax/react";',
    runsIn: "React 18 and 19, on the server too",
    about: 'A thin layer over /dom, marked "use client". Not a React library.',
    groups: [
      {
        label: "Hooks",
        names: ["useEventListener", "useClickOutside", "useInterval", "useForceUpdate"],
        kind: "functions",
      },
      { label: "Components", names: ["Portal"], kind: "functions" },
      { label: "Elements", names: ["hx"], kind: "variables" },
    ],
    prefix: "react/",
    guide: "/guide/react",
    cost: "1.5 kB",
    costNote: "for all of it; useForceUpdate is 96 B",
  },
];
const currentEntry = ref(entrypoints[0]!.id);

const sizes = [
  { name: "clamp", bytes: 76 },
  { name: "listen from /dom", bytes: 85 },
  { name: "useForceUpdate from /react", bytes: 96 },
  { name: "hx from /react", bytes: 630 },
  { name: "the whole of /dom", bytes: 1100 },
  { name: "the whole of /react", bytes: 1500 },
  { name: "Random", bytes: 3200 },
  { name: "the whole core", bytes: 4600 },
];
const maxBytes = Math.max(...sizes.map((s) => s.bytes));
const formatBytes = (bytes: number) =>
  bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(1)} kB`;

const copied = ref(false);
async function copyInstall() {
  try {
    await navigator.clipboard.writeText(INSTALL);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1800);
  } catch {
    copied.value = false;
  }
}

// The size bars grow once, when the table scrolls into view. Without script they are simply drawn.
const sizesEl = ref<HTMLElement | null>(null);
const armed = ref(false);
const seen = ref(false);
onMounted(() => {
  const el = sizesEl.value;
  if (!el || !("IntersectionObserver" in window)) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  armed.value = true;
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry?.isIntersecting) return;
      seen.value = true;
      observer.disconnect();
    },
    { threshold: 0.35 },
  );
  observer.observe(el);
});

const next = [
  {
    name: "Getting started",
    text: "Install, the three entrypoints, and the one TypeScript setting that matters.",
    link: "/guide/getting-started",
  },
  {
    name: "API reference",
    text: "Every export, generated from the source, with signatures, options and errors.",
    link: "/api/",
  },
  {
    name: "Design notes",
    text: "What a seed freezes, what each import costs, and how the examples are checked.",
    link: "/notes/design",
  },
  {
    name: "Migrating from 0.x",
    text: "What was renamed, what was removed, and which bugs were fixed on purpose.",
    link: "/migration",
  },
];
</script>

<template>
  <div class="hx-home">
    <section class="hx-hero" aria-labelledby="hx-title">
      <h1 id="hx-title" class="hx-display">
        Small functions. <span class="hx-display__accent">Checked answers.</span>
      </h1>
      <p class="hx-lede">
        Hyrax is a TypeScript toolkit for the helpers every project ends up writing: range math,
        case conversion, a seeded random generator you can replay, and the DOM and React plumbing
        for listeners and clicks outside. No runtime dependencies.
      </p>
      <div class="hx-hero__actions">
        <div class="hx-install">
          <code class="hx-install__cmd"
            ><span class="hx-install__prompt" aria-hidden="true">$</span> {{ INSTALL }}</code
          >
          <button
            type="button"
            class="hx-install__copy"
            :aria-label="copied ? 'Copied' : 'Copy the install command'"
            @click="copyInstall"
          >
            <svg
              v-if="!copied"
              viewBox="0 0 20 20"
              width="16"
              height="16"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="7"
                y="7"
                width="9"
                height="9"
                rx="2"
                stroke="currentColor"
                stroke-width="1.5"
              />
              <path
                d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7"
                stroke="currentColor"
                stroke-width="1.5"
              />
            </svg>
            <svg v-else viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
              <path
                d="m4.5 10.5 3.6 3.6 7.4-8.2"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
        <a class="hx-button hx-button--primary" :href="withBase('/guide/getting-started')">
          Get started
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
            <path
              d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </a>
        <a class="hx-button" :href="withBase('/api/')">API reference</a>
      </div>
      <p class="hx-hero__note">1.0.0-rc.0 is a release candidate: not on npm yet.</p>
    </section>

    <section class="hx-playground-section" aria-label="Try Hyrax in the page">
      <Playground />
      <p class="hx-caption">
        Nothing here is mocked. The answers are computed in your browser by the code these docs
        document.
      </p>
    </section>

    <section class="hx-block hx-split" aria-labelledby="hx-checked">
      <div class="hx-block__text">
        <h2 id="hx-checked">Examples are tests</h2>
        <p>
          A stale example is worse than none. <code>npm run docs:examples</code> type-checks every
          example in the guides and in the TSDoc against the built package, resolved through its
          <code>exports</code> map, and runs the core ones. A trailing <code>// =&gt; 10</code> is
          an assertion: the build fails the day <code>clamp</code> stops returning 10.
        </p>
        <ul class="hx-legend">
          <li>
            <CheckMark state="run" :size="18" />
            <p>
              <strong>Run, answers asserted.</strong> The core guides and API pages. Each
              <code>// =&gt; literal</code> must equal what the code returns.
            </p>
          </li>
          <li>
            <CheckMark state="types" :size="18" />
            <p>
              <strong>Type-checked, not run.</strong> <code>/dom</code> and <code>/react</code>,
              which need a browser or a component to mean anything.
            </p>
          </li>
          <li>
            <CheckMark state="untested" :size="18" />
            <p>
              <strong>Not checked.</strong> Skipped by hand, such as an example that is meant to
              throw.
            </p>
          </li>
        </ul>
        <p class="hx-block__links">
          <a :href="withBase('/notes/design#tested-examples')">How the examples are checked</a>
          <a :href="withBase('/notes/design#determinism')">What a seed freezes</a>
        </p>
      </div>
      <div class="hx-ledger">
        <div class="hx-lab__code hx-lab__code--solo">
          <LabCode
            :rows="ledger"
            :badge="
              allOk ? 'Answers computed by the source at load' : 'An answer no longer matches'
            "
          />
        </div>
      </div>
    </section>

    <section class="hx-block" aria-labelledby="hx-entrypoints">
      <div class="hx-block__text hx-block__text--wide">
        <h2 id="hx-entrypoints">Three entrypoints, split by where the code can run</h2>
        <p>
          Import only what your runtime has. The core never touches the DOM, <code>/dom</code> never
          touches React, and <code>/react</code> is a thin layer over <code>/dom</code>. Named
          exports only, no side effects on import: a bundler keeps exactly what you use.
        </p>
      </div>
      <div class="hx-entry">
        <div class="hx-entry__tabs" role="tablist" aria-label="Entrypoints">
          <button
            v-for="ep in entrypoints"
            :key="ep.id"
            :id="`hx-ep-${ep.id}`"
            type="button"
            role="tab"
            class="hx-tab"
            :aria-selected="currentEntry === ep.id"
            :aria-controls="`hx-ep-panel-${ep.id}`"
            :tabindex="currentEntry === ep.id ? 0 : -1"
            @click="currentEntry = ep.id"
          >
            <span class="hx-tab__name">{{ ep.name }}</span>
            <span class="hx-tab__about hx-tab__about--mono">{{ ep.entry }}</span>
          </button>
        </div>
        <div
          v-for="ep in entrypoints"
          v-show="currentEntry === ep.id"
          :id="`hx-ep-panel-${ep.id}`"
          :key="ep.id"
          class="hx-entry__panel"
          role="tabpanel"
          :aria-labelledby="`hx-ep-${ep.id}`"
        >
          <div class="hx-entry__main">
            <pre class="hx-entry__sample"><code v-html="highlight(ep.sample)" /></pre>
            <p class="hx-entry__about">{{ ep.about }}</p>
            <dl class="hx-entry__facts">
              <div>
                <dt>Runs in</dt>
                <dd>{{ ep.runsIn }}</dd>
              </div>
              <div>
                <dt>Costs about</dt>
                <dd>
                  <strong>{{ ep.cost }}</strong> {{ ep.costNote }}
                </dd>
              </div>
            </dl>
            <a class="hx-arrow-link" :href="withBase(ep.guide)"
              >Read the {{ ep.name.toLowerCase() }} guide</a
            >
          </div>
          <dl class="hx-entry__exports">
            <div v-for="group in ep.groups" :key="group.label">
              <dt>{{ group.label }}</dt>
              <dd>
                <a
                  v-for="name in group.names"
                  :key="name"
                  class="hx-export"
                  :href="api(`${ep.prefix}${group.kind}/${name}`)"
                  >{{ name }}</a
                >
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>

    <section class="hx-block hx-split" aria-labelledby="hx-cost">
      <div class="hx-block__text">
        <h2 id="hx-cost">Pay for what you import</h2>
        <p>
          Every function is its own export and nothing runs on import, so one function costs what it
          weighs. Each import also has a size budget that fails the build when it grows.
        </p>
        <p class="hx-block__links">
          <a :href="withBase('/notes/design#size')">Sizes and budgets in the design notes</a>
        </p>
      </div>
      <table ref="sizesEl" class="hx-sizes" :class="{ 'is-armed': armed, 'is-seen': seen }">
        <caption>
          Minified and Brotli-compressed, measured for 1.0.0-rc.0. React is a peer and is not
          counted.
        </caption>
        <thead>
          <tr>
            <th scope="col">You import</th>
            <th scope="col" class="hx-sizes__scale"><span class="visually-hidden">Scale</span></th>
            <th scope="col" class="hx-num">Costs about</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(size, i) in sizes" :key="size.name">
            <th scope="row">
              <code>{{ size.name }}</code>
            </th>
            <td class="hx-sizes__scale">
              <span
                class="hx-sizes__bar"
                :style="{ '--w': `${(size.bytes / maxBytes) * 100}%`, '--i': i }"
              ></span>
            </td>
            <td class="hx-num">{{ formatBytes(size.bytes) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <nav class="hx-next" aria-labelledby="hx-next-title">
      <h2 id="hx-next-title">Where to next</h2>
      <ul class="hx-next__list">
        <li v-for="item in next" :key="item.link">
          <a :href="withBase(item.link)">
            <span class="hx-next__name">{{ item.name }}</span>
            <span class="hx-next__text">{{ item.text }}</span>
            <svg
              class="hx-next__arrow"
              viewBox="0 0 20 20"
              width="18"
              height="18"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </a>
        </li>
      </ul>
    </nav>
  </div>
</template>
