<script setup lang="ts">
// The facts under the title of every page: what it documents, where that code runs, what it costs,
// and how its examples are checked. The facts come from sheets.ts (guides) or from the route
// (generated API pages), never from prose. checks.ts puts this component after each page's h1.
import { computed } from "vue";
import { useData } from "vitepress";
import { apiBudgetFor, examplesFor, sheetFor, type CheckState } from "../../sheets";
import CheckMark from "./CheckMark.vue";

const { page } = useData();

const CHECK_TEXT: Record<CheckState, string> = {
  run: "Run, answers asserted",
  types: "Type-checked, not run",
  untested: "Not checked",
};

interface Fact {
  label: string;
  value: string;
  code?: boolean;
  check?: CheckState;
}

const facts = computed<Fact[] | null>(() => {
  const path = page.value.relativePath;
  const examples = examplesFor(path);

  const api =
    /^api\/hyrax\/(?:(dom|react)\/)?(?:(classes|functions|interfaces|type-aliases|variables)\/)?/.exec(
      path,
    );
  if (api && path !== "api/index.md") {
    const entry = api[1] ? `@gabreusi/hyrax/${api[1]}` : "@gabreusi/hyrax";
    const list: Fact[] = [{ label: "Import from", value: entry, code: true }];
    const budget = apiBudgetFor(path);
    if (budget) list.push({ label: "Size budget", value: budget });
    if (examples && api[2])
      list.push({ label: "Examples", value: CHECK_TEXT[examples], check: examples });
    return list;
  }

  const found = sheetFor(path);
  if (!found) return null;
  const { sheet, group } = found;
  const list: Fact[] = [];
  if (sheet.entry)
    list.push({ label: "Import from", value: sheet.entry, code: sheet.entry.startsWith("@") });
  else list.push({ label: "Part", value: group.text });
  if (sheet.runsIn) list.push({ label: "Runs in", value: sheet.runsIn });
  if (sheet.budget) list.push({ label: "Size budget", value: sheet.budget });
  if (sheet.examples)
    list.push({ label: "Examples", value: CHECK_TEXT[sheet.examples], check: sheet.examples });
  return list;
});
</script>

<template>
  <dl v-if="facts" class="hx-facts">
    <div v-for="fact in facts" :key="fact.label" class="hx-facts__item">
      <dt>{{ fact.label }}</dt>
      <dd>
        <CheckMark v-if="fact.check" :state="fact.check" :size="14" />
        <code v-if="fact.code">{{ fact.value }}</code>
        <template v-else>{{ fact.value }}</template>
      </dd>
    </div>
  </dl>
</template>
