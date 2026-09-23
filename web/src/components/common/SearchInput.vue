<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    label?: string;
    /** Jeda sebelum emit, supaya tidak memanggil API tiap ketukan tombol. */
    debounceMs?: number;
  }>(),
  { placeholder: "Cari…", label: "Cari", debounceMs: 300 },
);

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const local = ref(props.modelValue);
let timer: ReturnType<typeof setTimeout> | undefined;

/** Perubahan dari luar (mis. reset filter) harus tercermin di kotak input. */
watch(
  () => props.modelValue,
  (value) => {
    if (value !== local.value) local.value = value;
  },
);

function onInput(event: Event) {
  local.value = (event.target as HTMLInputElement).value;

  if (timer) clearTimeout(timer);
  timer = setTimeout(
    () => emit("update:modelValue", local.value),
    props.debounceMs,
  );
}

function clear() {
  if (timer) clearTimeout(timer);
  local.value = "";
  emit("update:modelValue", "");
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <div class="search">
    <label class="sr-only" for="search-input">{{ label }}</label>
    <input
      id="search-input"
      class="search__input"
      type="search"
      :value="local"
      :placeholder="placeholder"
      @input="onInput"
      @keydown.esc="clear"
    />
    <button
      v-if="local"
      type="button"
      class="search__clear"
      aria-label="Bersihkan pencarian"
      @click="clear"
    >
      &times;
    </button>
  </div>
</template>

<style scoped>
.search {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 240px;
}

.search__input {
  width: 100%;
  min-height: 38px;
  padding: 0 var(--space-6) 0 var(--space-3);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  background: var(--color-input-bg);
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--text-body);
}

.search__input:focus {
  outline: none;
  border-color: var(--input-border-focus);
  box-shadow: var(--input-ring);
}

.search__clear {
  position: absolute;
  right: var(--space-2);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.search__clear:hover {
  background: var(--color-primary-soft);
  color: var(--color-text);
}
</style>
