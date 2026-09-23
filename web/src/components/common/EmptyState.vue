<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    message?: string;
  }>(),
  { message: "" },
);
</script>

<template>
  <div class="empty-state">
    <h2 class="empty-state__title">{{ title }}</h2>
    <p v-if="message" class="empty-state__message">{{ message }}</p>
    <div v-if="$slots.action" class="empty-state__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-4);
  text-align: center;
}

.empty-state__title {
  font-size: var(--text-card);
  font-weight: 600;
}

.empty-state__message {
  max-width: 48ch;
  color: var(--color-text-muted);
  font-size: var(--text-body);
}

.empty-state__action {
  margin-top: var(--space-2);
}
</style>
