<script setup lang="ts">
withDefaults(
  defineProps<{
    /** `primary` untuk aksi utama, `secondary` untuk pendamping, `danger` untuk merusak. */
    variant?: "primary" | "secondary" | "danger";
    type?: "button" | "submit";
    loading?: boolean;
    disabled?: boolean;
  }>(),
  {
    variant: "primary",
    type: "button",
    loading: false,
    disabled: false,
  },
);
</script>

<template>
  <button
    :type="type"
    class="btn"
    :class="`btn--${variant}`"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <span v-if="loading" class="spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0 var(--space-4);
  min-height: 38px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--text-button);
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    color 120ms ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn--primary {
  background: var(--button-primary-bg);
  color: var(--button-primary-fg);
}

.btn--primary:hover:not(:disabled) {
  background: var(--button-primary-bg-hov);
}

.btn--secondary {
  background: var(--color-surface);
  border-color: var(--color-border);
  color: var(--color-text);
}

.btn--secondary:hover:not(:disabled) {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}

.btn--danger {
  background: var(--button-danger-bg);
  color: var(--color-text-inverse);
}

.btn--danger:hover:not(:disabled) {
  background: #d92d20;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 600ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Hormati preferensi pengguna yang meminta animasi dikurangi. */
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 2s;
  }
}
</style>
