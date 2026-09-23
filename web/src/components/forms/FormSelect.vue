<script setup lang="ts">
import { computed, useId } from "vue";

export interface SelectOption {
  value: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    options: SelectOption[];
    required?: boolean;
    error?: string;
    hint?: string;
  }>(),
  { required: false, error: "", hint: "" },
);

defineEmits<{ "update:modelValue": [value: string] }>();

const uid = useId();
const selectId = `field-${uid}`;
const hintId = `${selectId}-hint`;
const errorId = `${selectId}-error`;

const describedBy = computed(() => {
  const ids: string[] = [];
  if (props.hint) ids.push(hintId);
  if (props.error) ids.push(errorId);
  return ids.length > 0 ? ids.join(" ") : undefined;
});
</script>

<template>
  <div class="field">
    <label :for="selectId" class="field__label">
      {{ label }}
      <span v-if="required" class="field__required" aria-hidden="true">*</span>
    </label>

    <select
      :id="selectId"
      class="field__select"
      :class="{ 'field__select--invalid': Boolean(error) }"
      :value="modelValue"
      :required="required"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      @change="
        $emit('update:modelValue', ($event.target as HTMLSelectElement).value)
      "
    >
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>

    <p v-if="hint" :id="hintId" class="field__hint">{{ hint }}</p>
    <p v-if="error" :id="errorId" class="field__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field__label {
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--color-text);
}

.field__required {
  color: var(--color-danger);
  margin-left: 2px;
}

.field__select {
  width: 100%;
  min-height: 40px;
  padding: 0 var(--space-3);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  background: var(--color-input-bg);
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--text-body);
}

.field__select:focus {
  outline: none;
  border-color: var(--input-border-focus);
  box-shadow: var(--input-ring);
}

.field__select--invalid {
  border-color: var(--color-danger);
}

.field__hint {
  font-size: var(--text-small);
  color: var(--color-text-muted);
}

.field__error {
  font-size: var(--text-small);
  font-weight: 500;
  color: var(--color-danger);
}
</style>
