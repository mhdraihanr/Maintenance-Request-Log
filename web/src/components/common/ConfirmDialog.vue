<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import AppButton from "./AppButton.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: "primary" | "danger";
    loading?: boolean;
  }>(),
  {
    confirmLabel: "Konfirmasi",
    cancelLabel: "Batal",
    tone: "primary",
    loading: false,
  },
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();

const panel = ref<HTMLElement | null>(null);

/**
 * Dialog tanpa library: `role="dialog"` + `aria-modal`, fokus dipindah ke panel
 * saat dibuka, dan Escape menutup. Pemulihan fokus ditangani pemanggil.
 */
function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.stopPropagation();
    emit("cancel");
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

onMounted(() => {
  if (props.open) document.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('cancel')">
    <div
      ref="panel"
      class="dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      tabindex="-1"
    >
      <h2 class="dialog__title">{{ title }}</h2>
      <p class="dialog__message">{{ message }}</p>
      <div class="dialog__actions">
        <AppButton
          variant="secondary"
          :disabled="loading"
          @click="emit('cancel')"
        >
          {{ cancelLabel }}
        </AppButton>
        <AppButton :variant="tone" :loading="loading" @click="emit('confirm')">
          {{ confirmLabel }}
        </AppButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: rgba(23, 43, 77, 0.4);
}

.dialog {
  width: 100%;
  max-width: 440px;
  padding: var(--space-6);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-pop);
}

.dialog:focus {
  outline: none;
}

.dialog__title {
  margin-bottom: var(--space-3);
  font-size: var(--text-section);
  font-weight: 700;
}

.dialog__message {
  color: var(--color-text-muted);
  font-size: var(--text-body);
  line-height: 1.6;
}

.dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-6);
}
</style>
