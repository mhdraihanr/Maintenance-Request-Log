<script setup lang="ts">
import { useToast } from "@/composables/useToast";

const { items, dismiss } = useToast();
</script>

<template>
  <!-- aria-live="polite": notifikasi masuk tanpa merebut fokus pengguna. -->
  <div class="toasts" aria-live="polite" aria-atomic="false">
    <div
      v-for="item in items"
      :key="item.id"
      class="toast"
      :class="`toast--${item.type}`"
    >
      <span class="toast__message">{{ item.message }}</span>
      <button
        type="button"
        class="toast__close"
        aria-label="Tutup notifikasi"
        @click="dismiss(item.id)"
      >
        &times;
      </button>
    </div>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  right: var(--space-6);
  bottom: var(--space-6);
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: min(380px, calc(100vw - 2 * var(--space-4)));
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-left: 4px solid var(--color-info);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  box-shadow: var(--shadow-pop);
  font-size: var(--text-body);
}

.toast--success {
  border-left-color: var(--color-success);
}

.toast--error {
  border-left-color: var(--color-danger);
}

.toast--warning {
  border-left-color: var(--color-warning);
}

.toast__message {
  flex: 1;
  line-height: 1.5;
}

.toast__close {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.toast__close:hover {
  color: var(--color-text);
}
</style>
