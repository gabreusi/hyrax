<script setup lang="ts">
// Type any identifier and see how the case functions read it. The answers come from the source.
import { computed, ref } from "vue";
import { splitWords, toCamelCase, toKebabCase, toPascalCase, toSnakeCase } from "@hyrax-source";
import { literal } from "../highlight";
import LabCode from "./LabCode.vue";
import LabShell from "./LabShell.vue";

defineProps<{ bare?: boolean }>();

const PRESETS = ["XMLHttpRequest", "hello world_foo-bar", "Ação rápida", "foo2bar"];
const input = ref(PRESETS[0]!);

const words = computed(() => splitWords(input.value));
const rows = computed(() => {
  const text = input.value;
  const quoted = literal(text);
  return [
    { code: `toCamelCase(${quoted})`, result: literal(toCamelCase(text)) },
    { code: `toPascalCase(${quoted})`, result: literal(toPascalCase(text)) },
    { code: `toSnakeCase(${quoted})`, result: literal(toSnakeCase(text)) },
    { code: `toKebabCase(${quoted})`, result: literal(toKebabCase(text)) },
    { code: `splitWords(${quoted})`, result: literal(splitWords(text)) },
  ];
});
</script>

<template>
  <LabShell label="Strings lab" :bare="bare">
    <template #stage>
      <div class="hx-lab__field">
        <label for="hx-str-input">input</label>
      </div>
      <input
        id="hx-str-input"
        v-model="input"
        class="hx-text"
        type="text"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
      />
      <div class="hx-chips" role="group" aria-label="Examples to try">
        <button
          v-for="preset in PRESETS"
          :key="preset"
          type="button"
          class="hx-chip"
          :aria-pressed="input === preset"
          @click="input = preset"
        >
          {{ preset }}
        </button>
      </div>
      <div class="hx-words" aria-label="The words splitWords finds">
        <span v-for="(word, i) in words" :key="i" class="hx-words__word">{{ word }}</span>
        <span v-if="words.length === 0" class="hx-words__none">no words</span>
      </div>
      <p class="hx-lab__hint">
        One tokenizer, so every case function agrees on where the words are.
      </p>
    </template>
    <template #code><LabCode :rows="rows" /></template>
  </LabShell>
</template>
