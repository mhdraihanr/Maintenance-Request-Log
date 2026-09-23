<script setup lang="ts">
import { computed } from "vue";
import type { PageMeta } from "@/api/types";

const props = defineProps<{ meta: PageMeta }>();

const emit = defineEmits<{ change: [page: number] }>();

const from = computed(() =>
  props.meta.total === 0 ? 0 : (props.meta.page - 1) * props.meta.limit + 1,
);

const to = computed(() =>
  Math.min(props.meta.page * props.meta.limit, props.meta.total),
);

const canPrev = computed(() => props.meta.page > 1);
const canNext = computed(() => props.meta.page < props.meta.totalPages);

function go(page: number) {
  if (page < 1 || page > props.meta.totalPages || page === props.meta.page)
    return;
  emit("change", page);
}
</script>

<template>
  <div class="pagination">
    <!--
      Satu-satunya live region di halaman ini. Perubahan jumlah hasil
      diumumkan sekali, tidak bertumpuk dengan pengumuman lain.
    -->
    <p class="pagination__summary" aria-live="polite" aria-atomic="true">
      {{
        meta.total === 0
          ? "Tidak ada hasil"
          : `Menampilkan ${from}–${to} dari ${meta.total} hasil`
      }}
    </p>

    <nav class="pagination__nav" aria-label="Navigasi halaman">
      <button
        type="button"
        class="pagination__btn"
        :disabled="!canPrev"
        @click="go(meta.page - 1)"
      >
        Sebelumnya
      </button>
      <span class="pagination__page"
        >Halaman {{ meta.page }} / {{ meta.totalPages || 1 }}</span
      >
      <button
        type="button"
        class="pagination__btn"
        :disabled="!canNext"
        @click="go(meta.page + 1)"
      >
        Berikutnya
      </button>
    </nav>
  </div>
</template>

<style scoped>
.pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.pagination__summary {
  font-size: var(--text-small);
  color: var(--color-text-muted);
}

.pagination__nav {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.pagination__btn {
  padding: 0 var(--space-3);
  min-height: 34px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--text-small);
  font-weight: 600;
  cursor: pointer;
}

.pagination__btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.pagination__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination__page {
  font-size: var(--text-small);
  color: var(--color-text-muted);
}
</style>
