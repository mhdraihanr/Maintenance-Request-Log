<script setup lang="ts">
import { computed } from "vue";
import type { RequestStatus } from "@/api/types";
import { STATUS_LABEL } from "@/utils/format";

const props = defineProps<{ status: RequestStatus }>();

const label = computed(() => STATUS_LABEL[props.status]);
</script>

<template>
  <!-- Label teks selalu ada, jadi status tidak pernah bergantung warna saja. -->
  <span class="badge" :class="`badge--${status}`">{{ label }}</span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--space-3);
  border-radius: 999px;
  font-size: var(--text-small);
  font-weight: 600;
  /* Label badge tidak boleh wrap ke baris kedua. */
  white-space: nowrap;
  line-height: 20px;
}

.badge--submitted {
  background: #fff3e6;
  color: #b54708;
}

.badge--approved {
  background: #e6f7ee;
  color: #05683a;
}

.badge--rejected {
  background: #fee4e2;
  color: #b42318;
}
</style>
