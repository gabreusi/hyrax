<script setup lang="ts">
// The frame of every lab: an inset stage with real controls on one side, code whose results the
// library computes on the other. `bare` drops the outer border when a lab sits inside another panel.
defineProps<{ label: string; bare?: boolean }>();
</script>

<template>
  <div class="hx-lab-wrap" :class="{ 'hx-lab-wrap--bare': bare }">
    <section class="hx-lab" :class="{ 'hx-lab--bare': bare }" :aria-label="label">
      <div class="hx-lab__stage"><slot name="stage" /></div>
      <div class="hx-lab__code"><slot name="code" /></div>
    </section>
  </div>
</template>
