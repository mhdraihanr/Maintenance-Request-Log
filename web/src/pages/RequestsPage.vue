<script setup lang="ts">
import { computed } from "vue";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const title = computed(() =>
  auth.hasRole("operator") ? "My Requests" : "All Requests",
);
</script>

<template>
  <section class="page">
    <h1 class="page-title">{{ title }}</h1>
    <p class="page-desc">Daftar request akan diisi di Step 22–26.</p>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.page-title {
  font-size: var(--text-page-title);
  font-weight: 700;
}

.page-desc {
  color: var(--color-text-muted);
}
</style>
