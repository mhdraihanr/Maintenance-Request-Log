<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { createRequest, updateRequest } from "@/api/requests";
import type { MaintenanceRequest, Priority } from "@/api/types";
import { ApiError } from "@/api/client";
import { useToast } from "@/composables/useToast";
import FormInput from "@/components/forms/FormInput.vue";
import FormTextarea from "@/components/forms/FormTextarea.vue";
import FormSelect from "@/components/forms/FormSelect.vue";
import AppButton from "@/components/common/AppButton.vue";

const props = withDefaults(
  defineProps<{
    /** Diisi saat mode edit; kosong berarti create. */
    initial?: MaintenanceRequest | null;
  }>(),
  { initial: null },
);

const router = useRouter();
const toast = useToast();

const isEdit = computed(() => Boolean(props.initial));

const form = ref({
  machine_id: props.initial?.machineId ?? "",
  description: props.initial?.description ?? "",
  priority: (props.initial?.priority ?? "medium") as Priority,
});

/** Error per field. Kunci mengikuti nama field API supaya cocok dengan `fields`. */
const errors = ref<Record<string, string>>({});
const submitting = ref(false);

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

/**
 * Validasi klien hanya untuk kenyamanan; server tetap memvalidasi.
 * Aturannya sengaja dicerminkan dari api/src/schemas/request.schema.ts
 * supaya pesannya konsisten dan tidak mengejutkan.
 */
function validate(): boolean {
  const next: Record<string, string> = {};

  const machineId = form.value.machine_id.trim();
  if (!machineId) next.machine_id = "Machine ID wajib diisi";
  else if (machineId.length > 64)
    next.machine_id = "Machine ID maksimal 64 karakter";

  const description = form.value.description.trim();
  if (!description) next.description = "Deskripsi wajib diisi";
  else if (description.length < 5)
    next.description = "Deskripsi minimal 5 karakter";
  else if (description.length > 2000)
    next.description = "Deskripsi maksimal 2000 karakter";

  errors.value = next;

  if (Object.keys(next).length > 0) {
    /**
     * Fokus ke field salah pertama. Ringkasan tidak perlu `role="alert"`:
     * fokus yang mendarat di field sudah membacakan pesannya sekali, dan
     * menambah live region akan membuatnya terbaca dua kali.
     */
    const firstKey = Object.keys(next)[0];
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          `[data-field="${firstKey}"] input,
          [data-field="${firstKey}"] textarea,
          [data-field="${firstKey}"] select`,
        )
        ?.focus();
    });

    return false;
  }

  return true;
}

async function submit() {
  if (!validate()) return;

  submitting.value = true;

  try {
    const payload = {
      machine_id: form.value.machine_id.trim(),
      description: form.value.description.trim(),
      priority: form.value.priority,
    };

    if (isEdit.value && props.initial) {
      await updateRequest(props.initial.id, payload);
      toast.success("Request diperbarui.");
      router.push({ name: "request-detail", params: { id: props.initial.id } });
    } else {
      const created = await createRequest(payload);
      toast.success(`Request ${created.code} dibuat.`);
      router.push({ name: "request-detail", params: { id: created.id } });
    }
  } catch (caught) {
    if (caught instanceof ApiError) {
      // Error validasi server dipetakan kembali ke field yang tepat.
      if (caught.fields) errors.value = caught.fields;
      toast.error(caught.message);
    } else {
      toast.error("Gagal menyimpan request");
    }
  } finally {
    submitting.value = false;
  }
}

function cancel() {
  if (isEdit.value && props.initial) {
    router.push({ name: "request-detail", params: { id: props.initial.id } });
  } else {
    router.push({ name: "requests" });
  }
}
</script>

<template>
  <section class="page">
    <div class="page-head">
      <div class="page-head__text">
        <h1 class="page-title">
          {{ isEdit ? "Edit Request" : "Create New Request" }}
        </h1>
        <p class="page-desc">
          {{
            isEdit
              ? "Perbarui detail request. Hanya request berstatus submitted yang dapat diubah."
              : "Isi detail kerusakan. Field bertanda * wajib diisi."
          }}
        </p>
      </div>
    </div>

    <article class="card">
      <div class="card__body">
        <form class="form" novalidate @submit.prevent="submit">
          <div class="form__grid">
            <div data-field="machine_id">
              <FormInput
                v-model="form.machine_id"
                label="Machine / Asset"
                required
                placeholder="Contoh: CNC-04"
                :error="errors.machine_id"
                hint="Kode mesin atau aset, maksimal 64 karakter."
              />
            </div>

            <div data-field="priority">
              <FormSelect
                v-model="form.priority"
                label="Priority"
                required
                :options="priorityOptions"
                :error="errors.priority"
              />
            </div>
          </div>

          <div data-field="description">
            <FormTextarea
              v-model="form.description"
              label="Problem Description"
              required
              :rows="6"
              placeholder="Jelaskan gejala, kapan mulai terjadi, dan dampaknya."
              :error="errors.description"
              hint="Minimal 5 karakter, maksimal 2000."
            />
          </div>

          <div class="form__actions">
            <AppButton
              variant="secondary"
              :disabled="submitting"
              @click="cancel"
            >
              Cancel
            </AppButton>
            <AppButton type="submit" :loading="submitting">
              {{ isEdit ? "Save Changes" : "Submit" }}
            </AppButton>
          </div>
        </form>
      </div>
    </article>
  </section>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 760px;
}

.form__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-5);
}

@media (max-width: 767px) {
  .form__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.form__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding-top: var(--space-2);
}
</style>
