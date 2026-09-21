<script setup lang="ts">
// The code side of a lab. A row with a `result` is a statement and its answer, set in the same
// answer column as the checked examples of the guides; a row without one is a plain line.
import { highlight } from "../highlight";

export interface LabRow {
  code: string;
  result?: string;
  /** False when the answer written in the docs no longer matches what the code returns. */
  ok?: boolean;
}
withDefaults(defineProps<{ rows: LabRow[]; badge?: string }>(), {
  badge: "Computed live by the library",
});
</script>

<template>
  <div class="hx-codebar">
    <span class="hx-badge" data-state="live">{{ badge }}</span>
  </div>
  <div class="hx-lab-code">
    <div v-for="(row, i) in rows" :key="i" class="hx-lab-code__row">
      <code class="hx-lab-code__stmt" v-html="highlight(row.code)" />
      <span
        v-if="row.result !== undefined"
        class="hx-answer"
        :data-asserted="row.ok === false ? undefined : ''"
        :data-wrong="row.ok === false ? '' : undefined"
      >
        <span class="hx-answer-op">// =&gt;</span>{{ " "
        }}<span class="hx-answer-value">{{ row.result }}</span>
      </span>
    </div>
  </div>
</template>
