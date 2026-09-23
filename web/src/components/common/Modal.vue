<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";

const props = defineProps<{ open: boolean; title: string }>();

const emit = defineEmits<{ close: [] }>();

const panel = ref<HTMLElement | null>(null);

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.stopPropagation();
    emit("close");
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      document.addEventListener("keydown", onKeydown);
      requestAnimationFrame(() => panel.value?.focus());
    } else {
      document.removeEventListener("keydown", onKeydown);
    }
  },
);

onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <div
      ref="panel"
      class="modal"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      tabindex="-1"
    >
      <header class="modal__head">
        <h2 class="modal__title">{{ title }}</h2>
        <button
          type="button"
          class="modal__close"
          aria-label="Tutup"
          @click="emit('close')"
        >
          &times;
        </button>
      </header>
      <div class="modal__body">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 55;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: rgba(23, 43, 77, 0.4);
}

.modal {
  width: 100%;
  max-width: 520px;
  max-height: calc(100vh - 2 * var(--space-4));
  overflow-y: auto;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-pop);
}

.modal:focus {
  outline: none;
}

.modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.modal__title {
  font-size: var(--text-section);
  font-weight: 700;
}

.modal__close {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.modal__close:hover {
  color: var(--color-text);
}

.modal__body {
  padding: var(--space-5);
}
</style>
