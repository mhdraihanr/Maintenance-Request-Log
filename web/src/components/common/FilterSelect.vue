<script setup lang="ts">
import { useId } from "vue";

export interface FilterOption {
  value: string;
  label: string;
}

withDefaults(
  defineProps<{
    modelValue: string;
    options: FilterOption[];
    label: string;
    /** Label untuk pilihan kosong, mis. "Semua status". */
    allLabel: string;
  }>(),
  {},
);

defineEmits<{ "update:modelValue": [value: string] }>();

const uid = useId();
</script>

<template>
  <div class="filter">
    <label class="sr-only" :for="`filter-${uid}`">{{ label }}</label>
    <select
      :id="`filter-${uid}`"
      class="filter__select"
      :value="modelValue"
      @change="
        $emit('update:modelValue', ($event.target as HTMLSelectElement).value)
      "
    >
      <option value="">{{ allLabel }}</option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.filter {
  min-width: 150px;
}

.filter__select {
  width: 100%;
  min-height: 38px;
  padding: 0 var(--space-3);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  background: var(--color-input-bg);
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--text-body);
}

.filter__select:focus {
  outline: none;
  border-color: var(--input-border-focus);
  box-shadow: var(--input-ring);
}
</style>
