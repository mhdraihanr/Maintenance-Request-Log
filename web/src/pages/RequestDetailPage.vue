<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { deleteRequest, reviewRequest } from "@/api/requests";
import { ApiError } from "@/api/client";
import { useRequestDetail } from "@/composables/useRequestDetail";
import { useToast } from "@/composables/useToast";
import { STATUS_LABEL, formatDateTime } from "@/utils/format";
import StatusBadge from "@/components/common/StatusBadge.vue";
import PriorityBadge from "@/components/common/PriorityBadge.vue";
import AppButton from "@/components/common/AppButton.vue";
import ErrorState from "@/components/common/ErrorState.vue";
import LoadingState from "@/components/common/LoadingState.vue";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";

const router = useRouter();
const toast = useToast();

const {
  request,
  loading,
  error,
  forbidden,
  reload,
  canEditRequest,
  canDeleteRequest,
  canReviewRequest,
} = useRequestDetail();

const reviewing = ref<"approve" | "reject" | null>(null);
const confirmDelete = ref(false);
const deleting = ref(false);

async function decide(decision: "approve" | "reject") {
  if (!request.value) return;

  reviewing.value = decision;

  try {
    await reviewRequest(request.value.id, decision);
    toast.success(
      decision === "approve"
        ? `Request ${request.value.code} disetujui.`
        : `Request ${request.value.code} ditolak.`,
    );
    await reload();
  } catch (caught) {
    toast.error(
      caught instanceof ApiError ? caught.message : "Gagal memproses keputusan",
    );
  } finally {
    reviewing.value = null;
  }
}

async function removeRequest() {
  if (!request.value) return;

  deleting.value = true;
  const code = request.value.code;

  try {
    await deleteRequest(request.value.id);
    toast.success(`Request ${code} dihapus.`);
    router.push({ name: "requests" });
  } catch (caught) {
    toast.error(
      caught instanceof ApiError ? caught.message : "Gagal menghapus request",
    );
    deleting.value = false;
    confirmDelete.value = false;
  }
}

const hasActions = computed(
  () =>
    canEditRequest.value || canReviewRequest.value || canDeleteRequest.value,
);

/**
 * API kini mengirim `reviewedBy` sebagai `{ id, name }` (lihat
 * api/src/services/request.service.ts), sama seperti `createdBy`.
 */
const reviewedByName = computed(() => request.value?.reviewedBy?.name ?? "—");

/**
 * Timeline direkonstruksi dari data yang ada. Audit trail belum dikerjakan
 * (Step 27), jadi minimal dua titik: pembuatan dan peninjauan.
 */
const timeline = computed(() => {
  const item = request.value;
  if (!item) return [];

  const events: { title: string; at: string | null }[] = [
    {
      title: `Request ${item.code} dibuat oleh ${item.createdBy.name}`,
      at: item.createdAt,
    },
  ];

  if (item.status !== "submitted" && item.reviewedAt) {
    events.push({
      title: `${STATUS_LABEL[item.status]} oleh ${item.reviewedBy?.name ?? "peninjau"}`,
      at: item.reviewedAt,
    });
  }

  return events;
});
</script>

<template>
  <section class="page">
    <LoadingState v-if="loading" :rows="5" />

    <ErrorState
      v-else-if="error"
      title="Request tidak dapat dimuat"
      :message="error"
      @retry="reload"
    />

    <div v-else-if="forbidden" class="notice">
      <h1 class="notice__title">Request tidak tersedia</h1>
      <p class="notice__message">
        Request ini tidak ada, atau Anda tidak berwenang melihatnya.
      </p>
      <RouterLink :to="{ name: 'requests' }">
        <AppButton variant="secondary">Kembali ke daftar</AppButton>
      </RouterLink>
    </div>

    <template v-else-if="request">
      <nav class="crumbs">
        <RouterLink :to="{ name: 'requests' }" class="crumbs__back">
          ← Back to list
        </RouterLink>
      </nav>

      <header class="head">
        <div class="head__meta">
          <span class="head__code">{{ request.code }}</span>
          <StatusBadge :status="request.status" />
          <PriorityBadge :priority="request.priority" />
        </div>
        <h1 class="page-title">{{ request.machineId }}</h1>
        <p class="head__sub">
          Created by {{ request.createdBy.name }} ·
          {{ formatDateTime(request.createdAt) }}
        </p>
      </header>

      <div class="layout">
        <div class="layout__main">
          <article class="card">
            <div class="card__head">
              <h2 class="card__title">Request Information</h2>
            </div>
            <div class="card__body">
              <dl class="dl">
                <div class="dl__row">
                  <dt>Machine / Asset</dt>
                  <dd>{{ request.machineId }}</dd>
                </div>
                <div class="dl__row">
                  <dt>Problem Description</dt>
                  <dd class="dl__prose">{{ request.description }}</dd>
                </div>
                <div class="dl__row">
                  <dt>Priority</dt>
                  <dd><PriorityBadge :priority="request.priority" /></dd>
                </div>
                <div class="dl__row">
                  <dt>Status</dt>
                  <dd><StatusBadge :status="request.status" /></dd>
                </div>
                <div class="dl__row">
                  <dt>Created By</dt>
                  <dd>{{ request.createdBy.name }}</dd>
                </div>
                <div class="dl__row">
                  <dt>Created At</dt>
                  <dd>{{ formatDateTime(request.createdAt) }}</dd>
                </div>
                <div class="dl__row">
                  <dt>Last Reviewed By</dt>
                  <dd>{{ reviewedByName }}</dd>
                </div>
                <div class="dl__row">
                  <dt>Last Reviewed At</dt>
                  <dd>{{ formatDateTime(request.reviewedAt) }}</dd>
                </div>
              </dl>
            </div>
          </article>
        </div>

        <aside class="layout__side">
          <article class="card">
            <div class="card__head">
              <h2 class="card__title">Actions</h2>
            </div>
            <div class="card__body">
              <div v-if="hasActions" class="actions">
                <RouterLink
                  v-if="canEditRequest"
                  :to="{ name: 'request-edit', params: { id: request.id } }"
                  class="actions__full"
                >
                  <AppButton variant="secondary">Edit Request</AppButton>
                </RouterLink>

                <AppButton
                  v-if="canReviewRequest"
                  :loading="reviewing === 'approve'"
                  :disabled="reviewing === 'reject'"
                  @click="decide('approve')"
                >
                  Approve
                </AppButton>

                <AppButton
                  v-if="canReviewRequest"
                  variant="danger"
                  :loading="reviewing === 'reject'"
                  :disabled="reviewing === 'approve'"
                  @click="decide('reject')"
                >
                  Reject
                </AppButton>

                <AppButton
                  v-if="canDeleteRequest"
                  variant="danger"
                  @click="confirmDelete = true"
                >
                  Delete Request
                </AppButton>
              </div>

              <p v-else class="muted">
                Tidak ada aksi yang tersedia untuk Anda pada request ini.
              </p>
            </div>
          </article>

          <article class="card">
            <div class="card__head">
              <h2 class="card__title">History</h2>
            </div>
            <div class="card__body">
              <ol class="timeline">
                <li
                  v-for="(event, index) in timeline"
                  :key="`${event.title}-${index}`"
                  class="timeline__item"
                >
                  <span class="timeline__dot" aria-hidden="true" />
                  <div>
                    <p class="timeline__title">{{ event.title }}</p>
                    <p class="timeline__time">{{ formatDateTime(event.at) }}</p>
                  </div>
                </li>
              </ol>
            </div>
          </article>
        </aside>
      </div>
    </template>

    <ConfirmDialog
      :open="confirmDelete"
      title="Hapus request?"
      :message="`Request ${request?.code ?? ''} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`"
      confirm-label="Hapus"
      tone="danger"
      :loading="deleting"
      @cancel="confirmDelete = false"
      @confirm="removeRequest"
    />
  </section>
</template>

<style scoped>
.crumbs__back {
  font-size: var(--text-small);
  font-weight: 600;
}

.head {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.head__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.head__code {
  font-size: var(--text-small);
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.head__sub {
  font-size: var(--text-small);
  color: var(--color-text-muted);
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
  gap: var(--space-5);
  align-items: start;
}

.layout__side {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  position: sticky;
  top: var(--space-5);
}

@media (max-width: 1023px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .layout__side {
    position: static;
  }
}

.dl {
  display: flex;
  flex-direction: column;
}

.dl__row {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: var(--space-4);
  padding: var(--space-3) 0;
}

.dl__row + .dl__row {
  border-top: 1px solid var(--color-border);
}

.dl__row dt {
  font-size: var(--text-small);
  font-weight: 600;
  color: var(--color-text-muted);
}

.dl__row dd {
  margin: 0;
}

.dl__prose {
  white-space: pre-wrap;
  line-height: 1.6;
}

@media (max-width: 767px) {
  .dl__row {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-2);
  }
}

.actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.actions__full {
  display: block;
}

.actions__full :deep(.btn) {
  width: 100%;
}

.muted {
  color: var(--color-text-muted);
  font-size: var(--text-body);
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  list-style: none;
}

.timeline__item {
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr);
  gap: var(--space-3);
}

.timeline__dot {
  width: 10px;
  height: 10px;
  margin-top: 5px;
  border: 2px solid var(--color-primary);
  border-radius: 50%;
  background: var(--color-surface);
}

.timeline__title {
  font-size: var(--text-body);
  font-weight: 600;
}

.timeline__time {
  font-size: var(--text-small);
  color: var(--color-text-muted);
}

.notice {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-8);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.notice__title {
  font-size: var(--text-section);
  font-weight: 700;
}

.notice__message {
  color: var(--color-text-muted);
}
</style>
