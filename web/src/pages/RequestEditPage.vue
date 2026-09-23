<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { getRequest } from "@/api/requests";
import type { MaintenanceRequest } from "@/api/types";
import { ApiError } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import { canEdit } from "@/policies/permissions";
import RequestFormPage from "./RequestFormPage.vue";
import ErrorState from "@/components/common/ErrorState.vue";
import LoadingState from "@/components/common/LoadingState.vue";
import AppButton from "@/components/common/AppButton.vue";
import { RouterLink } from "vue-router";

const route = useRoute();
const auth = useAuthStore();

const request = ref<MaintenanceRequest | null>(null);
const loading = ref(true);
const error = ref("");
const forbidden = ref(false);

const id = computed(() => String(route.params.id ?? ""));

async function load() {
  loading.value = true;
  error.value = "";
  forbidden.value = false;

  try {
    const fetched = await getRequest(id.value);

    /**
     * Gerbang tambahan sebelum form tampil. Server tetap menolak PATCH
     * kalau aturan ini tidak terpenuhi — ini hanya mencegah form sia-sia.
     */
    if (!canEdit(auth.user, fetched)) {
      forbidden.value = true;
      request.value = null;
      return;
    }

    request.value = fetched;
  } catch (caught) {
    if (
      caught instanceof ApiError &&
      (caught.status === 403 || caught.status === 404)
    ) {
      forbidden.value = true;
    } else {
      error.value =
        caught instanceof ApiError
          ? caught.message
          : "Tidak dapat memuat request";
    }
  } finally {
    loading.value = false;
  }
}

watch(id, load, { immediate: true });
</script>

<template>
  <LoadingState v-if="loading" :rows="5" />

  <ErrorState
    v-else-if="error"
    title="Request tidak dapat dimuat"
    :message="error"
    @retry="load"
  />

  <section v-else-if="forbidden" class="page">
    <div class="notice">
      <h1 class="notice__title">Tidak dapat mengedit request ini</h1>
      <p class="notice__message">
        Request hanya bisa diubah saat statusnya masih submitted, dan hanya oleh
        pembuatnya atau admin.
      </p>
      <RouterLink :to="{ name: 'requests' }">
        <AppButton variant="secondary">Kembali ke daftar</AppButton>
      </RouterLink>
    </div>
  </section>

  <RequestFormPage v-else-if="request" :initial="request" />
</template>

<style scoped>
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
  max-width: 60ch;
  color: var(--color-text-muted);
}
</style>
