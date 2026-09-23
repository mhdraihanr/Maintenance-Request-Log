<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { deactivateUser, listUsers } from "@/api/users";
import type { Page, PublicUser } from "@/api/types";
import { ApiError } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import { canDeactivate } from "@/policies/permissions";
import { ROLE_LABEL, formatDateTime } from "@/utils/format";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import Pagination from "@/components/common/Pagination.vue";
import SearchInput from "@/components/common/SearchInput.vue";
import FilterSelect from "@/components/common/FilterSelect.vue";
import AppButton from "@/components/common/AppButton.vue";
import ErrorState from "@/components/common/ErrorState.vue";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";
import Modal from "@/components/common/Modal.vue";
import UserForm from "@/components/forms/UserForm.vue";
import { useToast } from "@/composables/useToast";

const auth = useAuthStore();
const toast = useToast();

const columns: Column[] = [
  { key: "username", label: "Username" },
  { key: "name", label: "Name" },
  { key: "role", label: "Role" },
  { key: "isActive", label: "Status" },
  { key: "createdAt", label: "Created At" },
  { key: "lastLoginAt", label: "Last Login" },
  { key: "actions", label: "Actions", sticky: true, align: "right" },
];

const loading = ref(true);
const error = ref("");
const page = ref<Page<PublicUser>>({
  items: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
});

const search = ref("");
const role = ref("");
const isActive = ref("");
const currentPage = ref(1);

const formOpen = ref(false);
const editing = ref<PublicUser | null>(null);
const pendingDeactivate = ref<PublicUser | null>(null);
const deactivating = ref(false);

let controller: AbortController | undefined;

async function load() {
  controller?.abort();
  controller = new AbortController();

  loading.value = true;
  error.value = "";

  try {
    page.value = await listUsers(
      {
        search: search.value || undefined,
        role: (role.value || undefined) as PublicUser["role"] | undefined,
        is_active:
          isActive.value === "" ? undefined : isActive.value === "true",
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
        : "Tidak dapat memuat daftar user";
  } finally {
    loading.value = false;
  }
}

onMounted(load);

watch([search, role, isActive], () => {
  currentPage.value = 1;
  load();
});

watch(currentPage, load);

const roleOptions = [
  { value: "operator", label: ROLE_LABEL.operator },
  { value: "supervisor", label: ROLE_LABEL.supervisor },
  { value: "admin", label: ROLE_LABEL.admin },
];

const activeOptions = [
  { value: "true", label: "Aktif" },
  { value: "false", label: "Nonaktif" },
];

const hasFilter = computed(() =>
  Boolean(search.value || role.value || isActive.value),
);

function resetFilters() {
  search.value = "";
  role.value = "";
  isActive.value = "";
}

function openCreate() {
  editing.value = null;
  formOpen.value = true;
}

function openEdit(user: PublicUser) {
  editing.value = user;
  formOpen.value = true;
}

function closeForm() {
  formOpen.value = false;
  editing.value = null;
}

async function onSaved() {
  const wasEdit = Boolean(editing.value);
  closeForm();
  toast.success(wasEdit ? "User diperbarui." : "User ditambahkan.");
  await load();
}

function canDeactivateRow(user: PublicUser): boolean {
  return canDeactivate(auth.user, user);
}

/** Tombol nonaktif untuk akun sendiri — mencegah admin mengunci dirinya keluar. */
function isSelf(user: PublicUser): boolean {
  return auth.user?.id === user.id;
}

async function confirmDeactivate() {
  const target = pendingDeactivate.value;
  if (!target) return;

  deactivating.value = true;

  try {
    await deactivateUser(target.id);
    toast.success(`User ${target.username} dinonaktifkan.`);
    pendingDeactivate.value = null;
    await load();
  } catch (caught) {
    toast.error(
      caught instanceof ApiError ? caught.message : "Gagal menonaktifkan user",
    );
  } finally {
    deactivating.value = false;
  }
}
</script>

<template>
  <section class="page">
    <div class="page-head">
      <div class="page-head__text">
        <h1 class="page-title">Users</h1>
        <p class="page-desc">
          Kelola akun dan peran. Menonaktifkan user bersifat soft delete: akun
          tetap ada di daftar, statusnya berubah menjadi Nonaktif.
        </p>
      </div>
      <AppButton @click="openCreate">+ Add User</AppButton>
    </div>

    <div class="filters">
      <SearchInput
        v-model="search"
        label="Cari user"
        placeholder="Cari nama atau username…"
      />
      <FilterSelect
        v-model="role"
        label="Filter role"
        all-label="Semua role"
        :options="roleOptions"
      />
      <FilterSelect
        v-model="isActive"
        label="Filter status"
        all-label="Semua status"
        :options="activeOptions"
      />
      <AppButton v-if="hasFilter" variant="secondary" @click="resetFilters">
        Reset filter
      </AppButton>
    </div>

    <article class="card">
      <ErrorState
        v-if="error"
        title="Daftar user tidak dapat dimuat"
        :message="error"
        @retry="load"
      />

      <template v-else>
        <DataTable
          :columns="columns"
          :rows="page.items"
          :loading="loading"
          empty-text="Belum ada user yang cocok dengan filter ini"
        >
          <template #username="{ row }">
            <span class="mono">{{ row.username }}</span>
          </template>

          <template #name="{ row }">
            {{ row.name }}
          </template>

          <template #role="{ row }">
            {{ ROLE_LABEL[row.role] }}
          </template>

          <template #isActive="{ row }">
            <!-- Label teks, bukan titik warna saja. -->
            <span class="status" :class="{ 'status--off': !row.isActive }">
              {{ row.isActive ? "Active" : "Inactive" }}
            </span>
          </template>

          <template #createdAt="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>

          <template #lastLoginAt="{ row }">
            {{
              row.lastLoginAt ? formatDateTime(row.lastLoginAt) : "Belum pernah"
            }}
          </template>

          <template #actions="{ row }">
            <div class="actions">
              <button
                type="button"
                class="actions__link"
                @click="openEdit(row)"
              >
                Edit
              </button>
              <button
                v-if="canDeactivateRow(row)"
                type="button"
                class="actions__link actions__link--danger"
                @click="pendingDeactivate = row"
              >
                Deactivate
              </button>
              <span v-else-if="isSelf(row)" class="actions__note">
                Akun Anda
              </span>
            </div>
          </template>
        </DataTable>

        <Pagination
          v-if="!loading && page.meta.total > 0"
          :meta="page.meta"
          @change="(next) => (currentPage = next)"
        />
      </template>
    </article>

    <Modal
      :open="formOpen"
      :title="editing ? 'Edit User' : 'Add User'"
      @close="closeForm"
    >
      <UserForm :initial="editing" @saved="onSaved" @cancel="closeForm" />
    </Modal>

    <ConfirmDialog
      :open="Boolean(pendingDeactivate)"
      title="Nonaktifkan user?"
      :message="`User ${pendingDeactivate?.username ?? ''} tidak akan bisa login lagi. Akunnya tetap tersimpan dan dapat diaktifkan kembali.`"
      confirm-label="Nonaktifkan"
      tone="danger"
      :loading="deactivating"
      @cancel="pendingDeactivate = null"
      @confirm="confirmDeactivate"
    />
  </section>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.mono {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.status {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--space-3);
  border-radius: 999px;
  background: #e6f7ee;
  color: #05683a;
  font-size: var(--text-small);
  font-weight: 600;
  white-space: nowrap;
}

.status--off {
  background: #f2f4f7;
  color: #475467;
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

.actions__note {
  font-size: var(--text-small);
  color: var(--color-text-muted);
}
</style>
