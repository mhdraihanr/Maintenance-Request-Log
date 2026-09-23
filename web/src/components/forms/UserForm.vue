<script setup lang="ts">
import { computed, ref } from "vue";
import type { PublicUser, Role } from "@/api/types";
import { ApiError } from "@/api/client";
import { createUser, updateUser } from "@/api/users";
import FormInput from "@/components/forms/FormInput.vue";
import FormSelect from "@/components/forms/FormSelect.vue";
import AppButton from "@/components/common/AppButton.vue";
import { ROLE_LABEL } from "@/utils/format";

const props = withDefaults(
  defineProps<{
    /** Diisi saat edit; kosong berarti tambah. */
    initial?: PublicUser | null;
  }>(),
  { initial: null },
);

const emit = defineEmits<{ saved: []; cancel: [] }>();

const isEdit = computed(() => Boolean(props.initial));

const form = ref({
  username: props.initial?.username ?? "",
  name: props.initial?.name ?? "",
  password: "",
  role: (props.initial?.role ?? "operator") as Role,
});

const errors = ref<Record<string, string>>({});
const submitting = ref(false);
const genericError = ref("");

const roleOptions = [
  { value: "operator", label: ROLE_LABEL.operator },
  { value: "supervisor", label: ROLE_LABEL.supervisor },
  { value: "admin", label: ROLE_LABEL.admin },
];

function validate(): boolean {
  const next: Record<string, string> = {};

  if (!isEdit.value) {
    const username = form.value.username.trim().toLowerCase();
    if (!username) next.username = "Username wajib diisi";
    else if (!/^[a-z0-9._-]{3,32}$/.test(username))
      next.username =
        "Hanya huruf kecil, angka, titik, garis bawah, atau strip (3–32 karakter)";
  }

  const name = form.value.name.trim();
  if (!name) next.name = "Nama wajib diisi";
  else if (name.length > 64) next.name = "Nama maksimal 64 karakter";

  /**
   * Password wajib saat create, opsional saat edit.
   * Saat edit, kosong berarti "jangan ubah".
   */
  if (!isEdit.value && !form.value.password) {
    next.password = "Password wajib diisi";
  } else if (form.value.password) {
    if (form.value.password.length < 8)
      next.password = "Password minimal 8 karakter";
    else if (form.value.password.length > 128)
      next.password = "Password maksimal 128 karakter";
  }

  errors.value = next;

  if (Object.keys(next).length > 0) {
    const firstKey = Object.keys(next)[0];
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          `[data-field="${firstKey}"] input,
          [data-field="${firstKey}"] select`,
        )
        ?.focus();
    });
    return false;
  }

  return true;
}

async function submit() {
  genericError.value = "";
  if (!validate()) return;

  submitting.value = true;

  try {
    if (isEdit.value && props.initial) {
      const payload: Record<string, unknown> = {
        name: form.value.name.trim(),
        role: form.value.role,
      };
      if (form.value.password) payload.password = form.value.password;

      await updateUser(props.initial.id, payload);
    } else {
      await createUser({
        username: form.value.username.trim().toLowerCase(),
        name: form.value.name.trim(),
        password: form.value.password,
        role: form.value.role,
      });
    }

    emit("saved");
  } catch (caught) {
    if (caught instanceof ApiError) {
      if (caught.fields) errors.value = caught.fields;
      genericError.value = caught.message;
    } else {
      genericError.value = "Gagal menyimpan user";
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <form class="form" novalidate @submit.prevent="submit">
    <p v-if="genericError" class="form__error" role="alert">
      {{ genericError }}
    </p>

    <div data-field="username">
      <FormInput
        v-model="form.username"
        label="Username"
        required
        :disabled="isEdit"
        placeholder="Contoh: budi.s"
        :error="errors.username"
        :hint="
          isEdit
            ? 'Username tidak dapat diubah setelah dibuat.'
            : 'Huruf kecil, angka, titik, garis bawah, atau strip.'
        "
      />
    </div>

    <div data-field="name">
      <FormInput
        v-model="form.name"
        label="Nama"
        required
        placeholder="Nama lengkap"
        :error="errors.name"
      />
    </div>

    <div data-field="password">
      <FormInput
        v-model="form.password"
        label="Password"
        type="password"
        :required="!isEdit"
        :error="errors.password"
        :hint="
          isEdit
            ? 'Kosongkan bila tidak ingin mengubah password.'
            : 'Minimal 8 karakter.'
        "
        autocomplete="new-password"
      />
    </div>

    <div data-field="role">
      <FormSelect
        v-model="form.role"
        label="Role"
        required
        :options="roleOptions"
        :error="errors.role"
      />
    </div>

    <div class="form__actions">
      <AppButton
        variant="secondary"
        :disabled="submitting"
        @click="emit('cancel')"
      >
        Cancel
      </AppButton>
      <AppButton type="submit" :loading="submitting">
        {{ isEdit ? "Save Changes" : "Add User" }}
      </AppButton>
    </div>
  </form>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form__error {
  padding: var(--space-3) var(--space-4);
  border-left: 4px solid var(--color-danger);
  border-radius: var(--radius-sm);
  background: #fee4e2;
  color: #b42318;
  font-size: var(--text-body);
}

.form__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding-top: var(--space-2);
}
</style>
