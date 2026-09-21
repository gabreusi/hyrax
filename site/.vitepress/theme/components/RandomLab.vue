<script setup lang="ts">
// A seed is a whole sequence. Change it and every draw changes; put it back and they come back.
// The generator is the real one, and the second run proves that the same seed replays.
import { computed, ref } from "vue";
import { Random } from "@hyrax-source";
import { literal } from "../highlight";
import LabCode from "./LabCode.vue";
import LabShell from "./LabShell.vue";

defineProps<{ bare?: boolean }>();

const DRAWS = 4;
const METHODS = [
  { id: "int", call: "int(1, 100)", draw: (rng: Random) => rng.int(1, 100) },
  { id: "roll", call: 'roll("2d6+3")', draw: (rng: Random) => rng.roll("2d6+3") },
  { id: "id", call: "id(8)", draw: (rng: Random) => rng.id(8) },
  {
    id: "shuffle",
    call: "shuffle([1, 2, 3, 4, 5])",
    draw: (rng: Random) => rng.shuffle([1, 2, 3, 4, 5]),
  },
];

const seed = ref("level-1");
const method = ref(METHODS[0]!.id);
const active = computed(() => METHODS.find((m) => m.id === method.value)!);

const run = (text: string) => {
  const rng = new Random(text);
  return Array.from({ length: DRAWS }, () => active.value.draw(rng));
};
const first = computed(() => run(seed.value));
const replayed = computed(() => literal(run(seed.value)) === literal(first.value));

const rows = computed(() => [
  { code: `const rng = new Random(${literal(seed.value)});` },
  ...first.value.map((value) => ({ code: `rng.${active.value.call};`, result: literal(value) })),
]);

const rollSeed = () => (seed.value = Math.random().toString(36).slice(2, 8));
</script>

<template>
  <LabShell label="Random lab" :bare="bare">
    <template #stage>
      <div class="hx-lab__field">
        <label for="hx-rnd-seed">seed</label>
      </div>
      <div class="hx-input-row">
        <input
          id="hx-rnd-seed"
          v-model="seed"
          class="hx-text"
          type="text"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
        />
        <button
          type="button"
          class="hx-icon-button"
          aria-label="Try another seed"
          @click="rollSeed"
        >
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
            <rect
              x="3"
              y="3"
              width="14"
              height="14"
              rx="3.5"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <circle cx="7.2" cy="7.2" r="1.15" fill="currentColor" />
            <circle cx="12.8" cy="12.8" r="1.15" fill="currentColor" />
            <circle cx="10" cy="10" r="1.15" fill="currentColor" />
          </svg>
        </button>
      </div>
      <div class="hx-chips" role="group" aria-label="What to draw">
        <button
          v-for="m in METHODS"
          :key="m.id"
          type="button"
          class="hx-chip hx-chip--code"
          :aria-pressed="method === m.id"
          @click="method = m.id"
        >
          {{ m.call }}
        </button>
      </div>
      <ol class="hx-draws" aria-label="The draws">
        <li v-for="(value, i) in first" :key="i" class="hx-draws__item">{{ literal(value) }}</li>
      </ol>
      <p class="hx-lab__hint hx-lab__hint--check" :class="{ 'is-ok': replayed }">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
          <path
            d="M3 8.5 6.6 12 13 4.5"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>
          A second <code>new Random({{ literal(seed) }})</code> drew the same {{ DRAWS }}, in the
          same order.
        </span>
      </p>
    </template>
    <template #code><LabCode :rows="rows" /></template>
  </LabShell>
</template>
