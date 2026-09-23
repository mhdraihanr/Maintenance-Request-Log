<script setup lang="ts" generic="T extends { id: string }">
import LoadingState from "./LoadingState.vue";

export interface Column {
  key: string;
  label: string;
  /** Kolom bisa diurutkan lewat tombol di header. */
  sortable?: boolean;
  align?: "left" | "right";
  /** Menahan kolom di kanan saat tabel di-scroll horizontal di layar kecil. */
  sticky?: boolean;
}

const props = withDefaults(
  defineProps<{
    columns: Column[];
    rows: T[];
    loading?: boolean;
    emptyText?: string;
    /** Kolom yang sedang aktif, harus cocok dengan salah satu `key`. */
    sortKey?: string;
    sortOrder?: "asc" | "desc";
  }>(),
  {
    loading: false,
    emptyText: "Belum ada data",
    sortKey: "",
    sortOrder: "desc",
  },
);

const emit = defineEmits<{ sort: [key: string] }>();

function ariaSortFor(
  column: Column,
): "ascending" | "descending" | "none" | undefined {
  if (!column.sortable) return undefined;
  if (props.sortKey !== column.key) return "none";
  return props.sortOrder === "asc" ? "ascending" : "descending";
}

function isSorted(column: Column): boolean {
  return props.sortKey === column.key;
}
</script>

<template>
  <div class="table-wrap">
    <table class="table">
      <caption class="sr-only">
        {{
          "Daftar data dalam tabel"
        }}
      </caption>

      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            class="table__th"
            :class="{
              'table__th--right': column.align === 'right',
              'table__th--sticky': column.sticky,
            }"
            :aria-sort="ariaSortFor(column)"
          >
            <!--
              aria-sort ada di <th>, tombol di dalamnya. Menaruhnya di tombol
              membuat screen reader tidak mengumumkan perubahan urutan.
            -->
            <button
              v-if="column.sortable"
              type="button"
              class="table__sort"
              @click="emit('sort', column.key)"
            >
              {{ column.label }}
              <span class="table__sort-icon" aria-hidden="true">
                {{ isSorted(column) ? (sortOrder === "asc" ? "▲" : "▼") : "↕" }}
              </span>
            </button>
            <template v-else>{{ column.label }}</template>
          </th>
        </tr>
      </thead>

      <tbody v-if="loading">
        <tr>
          <td :colspan="columns.length" class="table__state">
            <LoadingState :rows="4" />
          </td>
        </tr>
      </tbody>

      <tbody v-else-if="rows.length === 0">
        <tr>
          <td :colspan="columns.length" class="table__state">
            <p class="table__empty">{{ emptyText }}</p>
          </td>
        </tr>
      </tbody>

      <tbody v-else>
        <tr v-for="row in rows" :key="row.id" class="table__row">
          <td
            v-for="column in columns"
            :key="column.key"
            class="table__td"
            :class="{
              'table__td--right': column.align === 'right',
              'table__td--sticky': column.sticky,
            }"
          >
            <slot :name="column.key" :row="row" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
/* Tabel lebar di-scroll, bukan dipaksa menyusut. */
.table-wrap {
  overflow-x: auto;
  scroll-padding-block-start: 44px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-body);
  min-width: 720px;
}

.table__th {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  font-size: var(--text-small);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.table__th--right {
  text-align: right;
}

.table__sort {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  border: none;
  background: transparent;
  padding: 0;
  font: inherit;
  color: inherit;
  text-transform: inherit;
  letter-spacing: inherit;
  cursor: pointer;
}

.table__sort:hover {
  color: var(--color-primary);
}

.table__sort-icon {
  font-size: 10px;
}

.table__row:hover {
  background: var(--table-row-hover-bg);
}

.table__td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}

.table__td--right {
  text-align: right;
}

.table__state {
  padding: 0;
}

.table__empty {
  padding: var(--space-8) var(--space-4);
  text-align: center;
  color: var(--color-text-muted);
}

/* Sticky kanan: aksi tetap terlihat saat tabel di-scroll horizontal. */
.table__th--sticky,
.table__td--sticky {
  position: sticky;
  right: 0;
  background: var(--color-surface);
  box-shadow: -8px 0 8px -8px rgba(23, 43, 77, 0.12);
}

.table__row:hover .table__td--sticky {
  background: var(--table-row-hover-bg);
}

@media (prefers-reduced-motion: reduce) {
  .table__row {
    transition: none;
  }
}
</style>
