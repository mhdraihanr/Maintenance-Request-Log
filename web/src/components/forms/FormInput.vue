<script setup lang="ts">
import { computed, useId } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    type?: "text" | "password";
    required?: boolean;
    placeholder?: string;
    /** Pesan error dari server atau validasi klien. Kosong = field valid. */
    error?: string;
    hint?: string;
    autocomplete?: string;
    disabled?: boolean;
  }>(),
  {
    type: "text",
    required: false,
    placeholder: "",
    error: "",
    hint: "",
    disabled: false,
  },
);

defineEmits<{ "update:modelValue": [value: string] }>();

const uid = useId();
const inputId = `field-${uid}`;
const hintId = `${inputId}-hint`;
const errorId = `${inputId}-error`;

/**
 * Hint lebih dulu, lalu error — dibaca berurutan oleh screen reader.
 * Saat field valid, id error dilepas supaya deskripsi tidak pernah
 * bertentangan dengan keadaan field.
 */
const describedBy = computed(() => {
  const ids: string[] = [];
  if (props.hint) ids.push(hintId);
  if (props.error) ids.push(errorId);
  return ids.length > 0 ? ids.join(" ") : undefined;
});
</script>

<template>
  <div class="field">
    <label :for="inputId" class="field__label">
      {{ label }}
      <span v-if="required" class="field__required" aria-hidden="true">*</span>
    </label>

    <input
      :id="inputId"
      class="field__input"
      :class="{ 'field__input--invalid': Boolean(error) }"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      :autocomplete="autocomplete"
      :disabled="disabled"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      @input="
        $emit('update:modelValue', ($event.target as HTMLInputElement).value)
      "
    />

    <p v-if="hint" :id="hintId" class="field__hint">{{ hint }}</p>
    <!-- Teks nyata, bukan hanya warna border: memenuhi WCAG 3.3.1. -->
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

.field__input {
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

.field__input:focus {
  outline: none;
  border-color: var(--input-border-focus);
  box-shadow: var(--input-ring);
}

.field__input--invalid {
  border-color: var(--color-danger);
}

.field__input:disabled {
  background: var(--color-bg);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.field__input--invalid:focus {
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
