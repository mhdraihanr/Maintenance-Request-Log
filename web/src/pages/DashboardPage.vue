<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { listRequests } from "@/api/requests";
import type { MaintenanceRequest, RequestStatus } from "@/api/types";
import { ApiError } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import { formatDateTime } from "@/utils/format";
import StatCard from "@/components/common/StatCard.vue";
import DonutChart from "@/components/common/DonutChart.vue";
import StatusBadge from "@/components/common/StatusBadge.vue";
import PriorityBadge from "@/components/common/PriorityBadge.vue";
import AppButton from "@/components/common/AppButton.vue";
import ErrorState from "@/components/common/ErrorState.vue";
import LoadingState from "@/components/common/LoadingState.vue";

const auth = useAuthStore();

const greeting = computed(() => `Welcome back, ${auth.user?.name ?? ""}`);

const loading = ref(true);
const error = ref("");
const requests = ref<MaintenanceRequest[]>([]);

/**
 * Dashboard menarik satu halaman besar lalu menghitung ringkasan di klien.
 * API belum punya endpoint agregat, dan menambahkannya tidak diwajibkan.
 * `limit: 100` adalah batas maksimum yang diterima listQuerySchema.
 */
const RECENT_LIMIT = 5;

async function load() {
  loading.value = true;
  error.value = "";

  try {
    const page = await listRequests({
      limit: 100,
      sort: "created_at",
      order: "desc",
    });
    requests.value = page.items;
  } catch (caught) {
    error.value =
      caught instanceof ApiError
        ? caught.message
        : "Tidak dapat memuat dashboard";
  } finally {
    loading.value = false;
  }
}

onMounted(load);

const counts = computed<Record<RequestStatus, number>>(() => {
  const base: Record<RequestStatus, number> = {
    submitted: 0,
    approved: 0,
    rejected: 0,
  };

  for (const request of requests.value) {
    base[request.status] += 1;
  }

  return base;
});

const total = computed(() => requests.value.length);

const recent = computed(() => requests.value.slice(0, RECENT_LIMIT));

/**
 * Operator hanya melihat request miliknya sendiri, jadi cakupan angkanya
 * diberi label eksplisit — supaya tidak terbaca sebagai statistik seluruh sistem.
 */
const scopeLabel = computed(() =>
  auth.hasRole("operator") ? "Request saya" : "Seluruh sistem",
);

const slices = computed(() => [
  { label: "Submitted", value: counts.value.submitted, color: "#f79009" },
  { label: "Approved", value: counts.value.approved, color: "#12b76a" },
  { label: "Rejected", value: counts.value.rejected, color: "#f04438" },
]);
</script>

<template>
  <section class="page">
    <div class="page-head">
      <div class="page-head__text">
        <h1 class="page-title">Dashboard</h1>
        <p class="page-desc">{{ greeting }}</p>
      </div>
      <RouterLink :to="{ name: 'request-new' }" class="page-head__action">
        <AppButton>+ New Request</AppButton>
      </RouterLink>
    </div>

    <ErrorState
      v-if="error"
      title="Dashboard tidak dapat dimuat"
      :message="error"
      @retry="load"
    />

    <LoadingState v-else-if="loading" :rows="4" />

    <template v-else>
      <p class="scope">
        Cakupan data: <strong>{{ scopeLabel }}</strong>
      </p>

      <div class="stats">
        <StatCard label="Total Requests" :value="total" tone="info" />
        <StatCard label="Approved" :value="counts.approved" tone="success" />
        <StatCard label="Rejected" :value="counts.rejected" tone="danger" />
        <StatCard label="Submitted" :value="counts.submitted" tone="warning" />
      </div>

      <div class="grid">
        <article class="card">
          <div class="card__head">
            <h2 class="card__title">Request Status Overview</h2>
          </div>
          <div class="card__body">
            <DonutChart v-if="total > 0" :slices="slices" total-label="Total" />
            <p v-else class="muted">
              Belum ada request. Grafik akan muncul setelah data pertama dibuat.
            </p>
          </div>
        </article>

        <article class="card">
          <div class="card__head card__head--split">
            <h2 class="card__title">Recent Requests</h2>
            <RouterLink :to="{ name: 'requests' }" class="link">
              View all
            </RouterLink>
          </div>
          <div class="card__body card__body--flush">
            <p v-if="recent.length === 0" class="muted muted--pad">
              Belum ada request.
            </p>
            <ul v-else class="recent">
              <li v-for="item in recent" :key="item.id" class="recent__item">
                <RouterLink
                  :to="{ name: 'request-detail', params: { id: item.id } }"
                  class="recent__link"
                >
                  <span class="recent__code">{{ item.code }}</span>
                  <span class="recent__machine">{{ item.machineId }}</span>
                  <PriorityBadge :priority="item.priority" />
                  <StatusBadge :status="item.status" />
                  <span class="recent__date">
                    {{ formatDateTime(item.createdAt) }}
                  </span>
                </RouterLink>
              </li>
            </ul>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
.page-head__action {
  display: inline-flex;
}

.scope {
  font-size: var(--text-small);
  color: var(--color-text-muted);
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: var(--space-5);
}

.card__head--split {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.card__body--flush {
  padding: 0;
}

.link {
  font-size: var(--text-small);
  font-weight: 600;
}

.muted {
  color: var(--color-text-muted);
}

.muted--pad {
  padding: var(--space-5);
}

.recent {
  list-style: none;
}

.recent__item + .recent__item {
  border-top: 1px solid var(--color-border);
}

.recent__link {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr) auto auto 150px;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  color: inherit;
  font-size: var(--text-body);
}

.recent__link:hover {
  background: var(--table-row-hover-bg);
}

.recent__code {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.recent__machine {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent__date {
  text-align: right;
  font-size: var(--text-small);
  color: var(--color-text-muted);
}

@media (max-width: 1023px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
