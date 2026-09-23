<script setup lang="ts">
withDefaults(defineProps<{ rows?: number }>(), { rows: 5 });
</script>

<template>
  <!--
    Skeleton dekoratif: dibaca sebagai satu status tunggal, bukan puluhan
    garis tak bermakna. Teksnya diumumkan sekali lewat role="status".
  -->
  <div class="skeleton" role="status">
    <span class="sr-only">{{ "Memuat data" }}</span>
    <div
      v-for="row in rows"
      :key="row"
      class="skeleton__row"
      aria-hidden="true"
    >
      <span class="skeleton__cell" />
      <span class="skeleton__cell skeleton__cell--wide" />
      <span class="skeleton__cell skeleton__cell--short" />
    </div>
  </div>
</template>

<style scoped>
.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
}

.skeleton__row {
  display: grid;
  grid-template-columns: 80px 1fr 100px;
  gap: var(--space-4);
}

.skeleton__cell {
  height: 16px;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--color-border) 25%,
    #eef2f7 50%,
    var(--color-border) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.skeleton__cell--short {
  width: 70%;
}

@keyframes shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton__cell {
    animation: none;
  }
}
</style>
