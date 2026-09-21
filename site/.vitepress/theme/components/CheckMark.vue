<script setup lang="ts">
// What the example checker did to a code example, drawn so the shape says it without the colour:
// a filled disc with a tick is "ran and asserted", a ring with a tick is "type-checked", a dashed
// ring is "skipped". The words always sit next to it.
import type { CheckState } from "../../sheets";

withDefaults(defineProps<{ state: CheckState; size?: number }>(), { size: 16 });
</script>

<template>
  <svg
    class="hx-check"
    :class="`hx-check--${state}`"
    viewBox="0 0 16 16"
    :width="size"
    :height="size"
    fill="none"
    aria-hidden="true"
  >
    <template v-if="state === 'run'">
      <circle cx="8" cy="8" r="8" class="hx-check__fill" />
      <path d="M4.6 8.3 7 10.7 11.5 5.6" class="hx-check__tick" />
    </template>
    <template v-else-if="state === 'types'">
      <circle cx="8" cy="8" r="7.1" class="hx-check__ring" />
      <path d="M4.9 8.2 7.1 10.4 11.2 5.9" class="hx-check__tick" />
    </template>
    <circle v-else cx="8" cy="8" r="7.1" class="hx-check__ring hx-check__ring--dashed" />
  </svg>
</template>
