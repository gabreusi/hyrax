<script setup lang="ts">
// Drag a value and watch what each number function does to it. The answers come from the source.
import { computed, ref } from "vue";
import { clamp, lerp, ratio, remap } from "@hyrax-source";
import { literal } from "../highlight";
import LabCode from "./LabCode.vue";
import LabShell from "./LabShell.vue";

defineProps<{ bare?: boolean }>();

const FROM = -40;
const TO = 140;
const LOW = 0;
const HIGH = 100;
const value = ref(130);

const at = (n: number) => `${((n - FROM) / (TO - FROM)) * 100}%`;
// Floating-point noise past the sixth decimal is not what this lab is about.
const show = (n: number) => literal(Number(n.toFixed(6)));

const clamped = computed(() => clamp(value.value, LOW, HIGH));
const rows = computed(() => {
  const v = value.value;
  return [
    { code: `clamp(${v}, 0, 100)`, result: show(clamp(v, 0, 100)) },
    { code: `ratio(${v}, 100)`, result: show(ratio(v, 100)) },
    { code: `remap(${v}, [0, 100], [0, 360])`, result: show(remap(v, [0, 100], [0, 360])) },
    { code: `lerp(0, 100, ratio(${v}, 100))`, result: show(lerp(0, 100, ratio(v, 100))) },
  ];
});
</script>

<template>
  <LabShell label="Numbers lab" :bare="bare">
    <template #stage>
      <div class="hx-lab__field">
        <label for="hx-num-value">value</label>
        <output for="hx-num-value" class="hx-lab__readout">{{ value }}</output>
      </div>
      <div class="hx-track" aria-hidden="true">
        <span
          class="hx-track__zone"
          :style="{ left: at(LOW), width: `calc(${at(HIGH)} - ${at(LOW)})` }"
        />
        <span
          v-if="clamped !== value"
          class="hx-track__link"
          :style="{
            left: `min(${at(value)}, ${at(clamped)})`,
            width: `calc(max(${at(value)}, ${at(clamped)}) - min(${at(value)}, ${at(clamped)}))`,
          }"
        />
        <span class="hx-track__dot hx-track__dot--raw" :style="{ left: at(value) }" />
        <span class="hx-track__dot hx-track__dot--clamped" :style="{ left: at(clamped) }" />
        <span class="hx-track__tick" :style="{ left: at(LOW) }">0</span>
        <span class="hx-track__tick" :style="{ left: at(HIGH) }">100</span>
      </div>
      <input
        id="hx-num-value"
        v-model.number="value"
        class="hx-range"
        type="range"
        :min="FROM"
        :max="TO"
        step="1"
      />
      <p class="hx-lab__hint">
        The hollow dot is <code>value</code>. The filled dot is what <code>clamp</code> keeps of it.
      </p>
    </template>
    <template #code><LabCode :rows="rows" /></template>
  </LabShell>
</template>
