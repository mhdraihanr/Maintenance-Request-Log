import { readonly, ref } from "vue";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

const items = ref<ToastItem[]>([]);
let nextId = 1;

const DEFAULT_DURATION = 4000;

function push(type: ToastType, message: string, duration = DEFAULT_DURATION) {
  const id = nextId++;
  items.value = [...items.value, { id, type, message }];

  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }

  return id;
}

function dismiss(id: number) {
  items.value = items.value.filter((item) => item.id !== id);
}

export function useToast() {
  return {
    items: readonly(items),
    dismiss,
    success: (message: string) => push("success", message),
    error: (message: string) => push("error", message),
    warning: (message: string) => push("warning", message),
    info: (message: string) => push("info", message),
  };
}
