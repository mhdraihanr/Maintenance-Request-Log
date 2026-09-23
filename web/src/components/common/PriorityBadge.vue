<script setup lang="ts">
import { computed } from "vue";
import type { Priority } from "@/api/types";
import { PRIORITY_LABEL } from "@/utils/format";

const props = defineProps<{ priority: Priority }>();

const label = computed(() => PRIORITY_LABEL[props.priority]);
</script>

<template>
  <span class="badge" :class="`badge--${priority}`">
    <span class="dot" aria-hidden="true" />
    {{ label }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 2px var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--text-small);
  font-weight: 600;
  white-space: nowrap;
  line-height: 20px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}

.badge--low .dot {
  background: var(--color-text-muted);
}

.badge--medium .dot {
  background: var(--color-warning);
}

.badge--high .dot {
  background: var(--color-danger);
}
</style>
