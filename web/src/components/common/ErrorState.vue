<script setup lang="ts">
import AppButton from "./AppButton.vue";

withDefaults(
  defineProps<{
    title?: string;
    message: string;
    retryLabel?: string;
  }>(),
  {
    title: "Terjadi kesalahan",
    retryLabel: "Coba lagi",
  },
);

defineEmits<{ retry: [] }>();
</script>

<template>
  <!-- role="alert" supaya kegagalan termuat tidak lewat begitu saja tanpa diumumkan. -->
  <div class="error-state" role="alert">
    <h2 class="error-state__title">{{ title }}</h2>
    <p class="error-state__message">{{ message }}</p>
    <AppButton variant="secondary" @click="$emit('retry')">
      {{ retryLabel }}
    </AppButton>
  </div>
</template>

<style scoped>
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-4);
  text-align: center;
}

.error-state__title {
  font-size: var(--text-card);
  font-weight: 600;
  color: var(--color-danger);
}

.error-state__message {
  max-width: 48ch;
  color: var(--color-text-muted);
  font-size: var(--text-body);
}
</style>
