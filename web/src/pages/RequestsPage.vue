<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { listRequests, deleteRequest } from "@/api/requests";
import type {
  MaintenanceRequest,
  Page,
  Priority,
  RequestStatus,
} from "@/api/types";
import { ApiError } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import { canEdit, canDelete } from "@/policies/permissions";
import { formatDateTime } from "@/utils/format";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import Pagination from "@/components/common/Pagination.vue";
import SearchInput from "@/components/common/SearchInput.vue";
import FilterSelect from "@/components/common/FilterSelect.vue";
import StatusBadge from "@/components/common/StatusBadge.vue";
import PriorityBadge from "@/components/common/PriorityBadge.vue";
import AppButton from "@/components/common/AppButton.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import ErrorState from "@/components/common/ErrorState.vue";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";
import { useToast } from "@/composables/useToast";

const auth = useAuthStore();
const router = useRouter();
const toast = useToast();

const isOperator = computed(() => auth.hasRole("operator"));
const title = computed(() =>
  isOperator.value ? "My Requests" : "All Requests",
);
const description = computed(() =>
  isOperator.value
    ? "Request yang Anda buat. Anda dapat mengubah selama statusnya masih submitted."
    : "Semua request di sistem. Tinjau, setujui, atau tolak sesuai kewenangan Anda.",
);

/** Kolom `actions` diisi slot; `key` tetap dipakai sebagai nama slot. */
const columns: Column[] = [
  { key: "code", label: "ID" },
  { key: "machineId", label: "Machine / Asset" },
  { key: "description", label: "Problem Description" },
  { key: "priority", label: "Priority", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "createdBy", label: "Created By" },
  { key: "createdAt", label: "Created At", sortable: true },
  { key: "actions", label: "Actions", sticky: true, align: "right" },
];

/** Hanya kolom yang benar-benar bisa diurutkan di SQL yang boleh diklik. */
const SORTABLE_API_KEYS = new Set(["created_at", "priority", "status"]);

/**
 * Pemetaan nama kolom ke kolom SQL yang benar-benar didukung listQuerySchema
 * (`created_at` | `priority` | `status`). Kolom `code` sengaja tidak ada di sini:
 * API belum mengurutkan berdasarkan kode, jadi header ID tidak boleh tampak
 * bisa diklik sambil diam-diam mengurutkan kolom lain.
 */
const sortMap: Record<string, "created_at" | "priority" | "status"> = {
  createdAt: "created_at",
  priority: "priority",
  status: "status",
};

const loading = ref(true);
const error = ref("");
const page = ref<Page<MaintenanceRequest>>({
  items: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
});

const search = ref("");
const status = ref("");
const priority = ref("");
const sortKey = ref("createdAt");
const sortOrder = ref<"asc" | "desc">("desc");
const currentPage = ref(1);

const pendingDelete = ref<MaintenanceRequest | null>(null);
const deleting = ref(false);

let controller: AbortController | undefined;

async function load() {
  controller?.abort();
  controller = new AbortController();

  loading.value = true;
  error.value = "";

  try {
    page.value = await listRequests(
      {
        search: search.value || undefined,
        status: (status.value || undefined) as RequestStatus | undefined,
        priority: (priority.value || undefined) as Priority | undefined,
        sort: sortMap[sortKey.value] ?? "created_at",
        order: sortOrder.value,
        page: currentPage.value,
        limit: 20,
      },
      controller.signal,
    );
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError") return;
    error.value =
      caught instanceof ApiError
        ? caught.message
        : "Tidak dapat memuat daftar request";
  } finally {
    loading.value = false;
  }
}

onMounted(load);

/**
 * Perubahan filter selalu mengembalikan ke halaman 1. Tanpa ini, mempersempit
 * filter saat berada di halaman 5 akan menampilkan tabel kosong, bukan hasil.
 */
watch([search, status, priority], () => {
  currentPage.value = 1;
  load();
});

watch([sortKey, sortOrder], () => {
  currentPage.value = 1;
  load();
});

watch(currentPage, load);

function onSort(key: string) {
  if (!SORTABLE_API_KEYS.has(sortMap[key] ?? "")) return;

  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
    return;
  }

  sortKey.value = key;
  sortOrder.value = "desc";
}

const statusOptions = [
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const hasFilter = computed(() =>
  Boolean(search.value || status.value || priority.value),
);

function resetFilters() {
  search.value = "";
  status.value = "";
  priority.value = "";
}

function canEditRow(row: MaintenanceRequest): boolean {
  return canEdit(auth.user, row);
}

function canDeleteRow(row: MaintenanceRequest): boolean {
  return canDelete(auth.user, row);
}

async function confirmDelete() {
  const target = pendingDelete.value;
  if (!target) return;

  deleting.value = true;

  try {
    await deleteRequest(target.id);
    toast.success(`Request ${target.code} dihapus.`);
    pendingDelete.value = null;

    /**
     * Menghapus baris terakhir di halaman terakhir membuat halaman itu kosong.
     * Mundur satu halaman supaya hasil tetap terlihat.
     */
    if (page.value.items.length === 1 && currentPage.value > 1) {
      currentPage.value -= 1;
    } else {
      await load();
    }
  } catch (caught) {
    toast.error(
      caught instanceof ApiError ? caught.message : "Gagal menghapus request",
    );
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <section class="page">
    <div class="page-head">
      <div class="page-head__text">
        <h1 class="page-title">{{ title }}</h1>
        <p class="page-desc">{{ description }}</p>
      </div>
      <RouterLink :to="{ name: 'request-new' }" class="page-head__action">
        <AppButton>+ New Request</AppButton>
      </RouterLink>
    </div>

    <div class="filters">
      <SearchInput
        v-model="search"
        label="Cari request"
        placeholder="Cari machine ID atau deskripsi…"
      />
      <FilterSelect
        v-model="status"
        label="Filter status"
        all-label="Semua status"
        :options="statusOptions"
      />
      <FilterSelect
        v-model="priority"
        label="Filter priority"
        all-label="Semua priority"
        :options="priorityOptions"
      />
      <AppButton v-if="hasFilter" variant="secondary" @click="resetFilters">
        Reset filter
      </AppButton>
    </div>

    <article class="card">
      <ErrorState
        v-if="error"
        title="Daftar request tidak dapat dimuat"
        :message="error"
        @retry="load"
      />

      <template v-else>
        <DataTable
          :columns="columns"
          :rows="page.items"
          :loading="loading"
          empty-text="Belum ada request yang cocok dengan filter ini"
          :sort-key="sortKey"
          :sort-order="sortOrder"
          @sort="onSort"
        >
          <template #code="{ row }">
            <RouterLink
              :to="{ name: 'request-detail', params: { id: row.id } }"
              class="code-link"
            >
              {{ row.code }}
            </RouterLink>
          </template>

          <template #machineId="{ row }">
            {{ row.machineId }}
          </template>

          <template #description="{ row }">
            <!-- Dipotong satu baris; teks penuh tetap terbaca lewat title. -->
            <span class="truncate" :title="row.description">
              {{ row.description }}
            </span>
          </template>

          <template #priority="{ row }">
            <PriorityBadge :priority="row.priority" />
          </template>

          <template #status="{ row }">
            <StatusBadge :status="row.status" />
          </template>

          <template #createdBy="{ row }">
            {{ row.createdBy.name }}
          </template>

          <template #createdAt="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>

          <template #actions="{ row }">
            <div class="actions">
              <RouterLink
                :to="{ name: 'request-detail', params: { id: row.id } }"
                class="actions__link"
              >
                Detail
              </RouterLink>
              <button
                v-if="canEditRow(row)"
                type="button"
                class="actions__link"
                @click="
                  router.push({ name: 'request-edit', params: { id: row.id } })
                "
              >
                Edit
              </button>
              <button
                v-if="canDeleteRow(row)"
                type="button"
                class="actions__link actions__link--danger"
                @click="pendingDelete = row"
              >
                Hapus
              </button>
            </div>
          </template>
        </DataTable>

        <EmptyState
          v-if="!loading && page.items.length === 0 && hasFilter"
          title="Tidak ada hasil"
          message="Coba ubah kata kunci atau reset filter untuk melihat semua request."
        >
          <template #action>
            <AppButton variant="secondary" @click="resetFilters">
              Reset filter
            </AppButton>
          </template>
        </EmptyState>

        <Pagination
          v-if="!loading && page.meta.total > 0"
          :meta="page.meta"
          @change="(next) => (currentPage = next)"
        />
      </template>
    </article>

    <ConfirmDialog
      :open="Boolean(pendingDelete)"
      title="Hapus request?"
      :message="`Request ${pendingDelete?.code ?? ''} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`"
      confirm-label="Hapus"
      tone="danger"
      :loading="deleting"
      @cancel="pendingDelete = null"
      @confirm="confirmDelete"
    />
  </section>
</template>

<style scoped>
.page-head__action {
  display: inline-flex;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.code-link {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.truncate {
  display: inline-block;
  max-width: 32ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  white-space: nowrap;
}

.actions__link {
  border: none;
  background: transparent;
  padding: 0;
  color: var(--color-primary);
  font: inherit;
  font-size: var(--text-small);
  font-weight: 600;
}

.actions__link:hover {
  text-decoration: underline;
}

.actions__link--danger {
  color: var(--color-danger);
}
</style>
