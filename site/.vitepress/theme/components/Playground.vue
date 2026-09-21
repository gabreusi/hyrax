<script setup lang="ts">
// The home page's lab: the three labs behind one row of tabs.
import { ref } from "vue";
import NumberLab from "./NumberLab.vue";
import RandomLab from "./RandomLab.vue";
import StringLab from "./StringLab.vue";

const TABS = [
  { id: "numbers", name: "Numbers", about: "clamp, ratio, remap, lerp" },
  { id: "strings", name: "Strings", about: "case conversion" },
  { id: "random", name: "Random", about: "a seed replays" },
] as const;
const current = ref<(typeof TABS)[number]["id"]>("numbers");

function move(event: KeyboardEvent, index: number) {
  const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
  if (!step) return;
  event.preventDefault();
  const next = TABS[(index + step + TABS.length) % TABS.length]!;
  current.value = next.id;
  document.getElementById(`hx-tab-${next.id}`)?.focus();
}
</script>

<template>
  <div class="hx-playground">
    <div class="hx-tabs" role="tablist" aria-label="Try Hyrax">
      <button
        v-for="(tab, i) in TABS"
        :id="`hx-tab-${tab.id}`"
        :key="tab.id"
        type="button"
        role="tab"
        class="hx-tab"
        :aria-selected="current === tab.id"
        :aria-controls="`hx-panel-${tab.id}`"
        :tabindex="current === tab.id ? 0 : -1"
        @click="current = tab.id"
        @keydown="move($event, i)"
      >
        <span class="hx-tab__name">{{ tab.name }}</span>
        <span class="hx-tab__about">{{ tab.about }}</span>
      </button>
    </div>
    <div
      v-for="tab in TABS"
      v-show="current === tab.id"
      :id="`hx-panel-${tab.id}`"
      :key="tab.id"
      role="tabpanel"
      :aria-labelledby="`hx-tab-${tab.id}`"
    >
      <NumberLab v-if="tab.id === 'numbers'" bare />
      <StringLab v-else-if="tab.id === 'strings'" bare />
      <RandomLab v-else bare />
    </div>
  </div>
</template>
