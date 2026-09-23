import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { getRequest } from "@/api/requests";
import type { MaintenanceRequest } from "@/api/types";
import { ApiError } from "@/api/client";
import { canDelete, canEdit, canReview, canView } from "@/policies/permissions";
import { useAuthStore } from "@/stores/auth";

/**
 * Satu sumber untuk halaman detail, edit, dan form.
 * Menangani tiga keadaan yang mudah terlewat: masih memuat, gagal, dan
 * request yang tidak boleh dilihat pengguna ini (server balas 404/403).
 */
export function useRequestDetail() {
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
      request.value = fetched;

      if (!canView(auth.user, fetched)) {
        forbidden.value = true;
        request.value = null;
      }
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

  onMounted(load);
  watch(id, load);

  const canEditRequest = computed(
    () => Boolean(request.value) && canEdit(auth.user, request.value!),
  );
  const canDeleteRequest = computed(
    () => Boolean(request.value) && canDelete(auth.user, request.value!),
  );
  const canReviewRequest = computed(
    () => Boolean(request.value) && canReview(auth.user, request.value!),
  );

  return {
    request,
    loading,
    error,
    forbidden,
    reload: load,
    canEditRequest,
    canDeleteRequest,
    canReviewRequest,
  };
}
