<script setup lang="ts">
import { computed, useId } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    required?: boolean;
    rows?: number;
    placeholder?: string;
    error?: string;
    hint?: string;
  }>(),
  { required: false, rows: 5, placeholder: "", error: "", hint: "" },
);

defineEmits<{ "update:modelValue": [value: string] }>();

const uid = useId();
const textareaId = `field-${uid}`;
const hintId = `${textareaId}-hint`;
const errorId = `${textareaId}-error`;

const describedBy = computed(() => {
  const ids: string[] = [];
  if (props.hint) ids.push(hintId);
  if (props.error) ids.push(errorId);
  return ids.length > 0 ? ids.join(" ") : undefined;
});
</script>

<template>
  <div class="field">
    <label :for="textareaId" class="field__label">
      {{ label }}
      <span v-if="required" class="field__required" aria-hidden="true">*</span>
    </label>

    <textarea
      :id="textareaId"
      class="field__textarea"
      :class="{ 'field__textarea--invalid': Boolean(error) }"
      :value="modelValue"
      :rows="rows"
      :placeholder="placeholder"
      :required="required"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      @input="
        $emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)
      "
    />

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

.field__textarea {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  background: var(--color-input-bg);
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--text-body);
  resize: vertical;
  line-height: 1.5;
}

.field__textarea:focus {
  outline: none;
  border-color: var(--input-border-focus);
  box-shadow: var(--input-ring);
}

.field__textarea--invalid {
  border-color: var(--color-danger);
}

.field__textarea--invalid:focus {
  box-shadow: 0 0 0 3px rgba(240, 68, 56, 0.15);
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
