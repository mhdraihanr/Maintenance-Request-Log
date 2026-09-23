import { computed, ref } from "vue";
import { defineStore } from "pinia";
import * as authApi from "@/api/auth";
import { ApiError } from "@/api/client";
import type { AuthUser, Role } from "@/api/types";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser | null>(null);
  const loading = ref(false);

  const isAuthenticated = computed(() => user.value !== null);
  const role = computed<Role | null>(() => user.value?.role ?? null);

  function hasRole(...roles: Role[]): boolean {
    return user.value !== null && roles.includes(user.value.role);
  }

  async function login(username: string, password: string): Promise<void> {
    loading.value = true;
    try {
      user.value = await authApi.login(username, password);
    } finally {
      loading.value = false;
    }
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout();
    } finally {
      user.value = null;
    }
  }

  /**
   * Mengembalikan true bila sesi valid. Dipakai router guard: satu kali cek
   * ke /auth/me saat halaman di-refresh (store belum tahu siapa yang login).
   */
  async function restore(): Promise<boolean> {
    if (user.value) return true;
    try {
      user.value = await authApi.me();
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        user.value = null;
        return false;
      }
      throw err;
    }
  }

  return {
    user,
    loading,
    isAuthenticated,
    role,
    hasRole,
    login,
    logout,
    restore,
  };
});
