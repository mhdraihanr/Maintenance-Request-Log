<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    value: number;
    /** Warna aksen kiri card: blue / green / red / orange. */
    tone?: "info" | "success" | "danger" | "warning";
    hint?: string;
  }>(),
  { tone: "info", hint: "" },
);
</script>

<template>
  <article class="stat" :class="`stat--${tone}`">
    <span class="stat__accent" aria-hidden="true" />
    <div class="stat__body">
      <p class="stat__label">{{ label }}</p>
      <p class="stat__value">{{ value.toLocaleString("id-ID") }}</p>
      <p v-if="hint" class="stat__hint">{{ hint }}</p>
    </div>
  </article>
</template>

<style scoped>
.stat {
  position: relative;
  display: flex;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.stat__accent {
  width: 4px;
  flex: none;
  background: var(--color-info);
}

.stat--success .stat__accent {
  background: var(--color-success);
}

.stat--danger .stat__accent {
  background: var(--color-danger);
}

.stat--warning .stat__accent {
  background: var(--color-warning);
}

.stat__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4) var(--space-5);
}

.stat__label {
  font-size: var(--text-small);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-muted);
}

.stat__value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-text);
}

.stat__hint {
  font-size: var(--text-small);
  color: var(--color-text-muted);
}
</style>
