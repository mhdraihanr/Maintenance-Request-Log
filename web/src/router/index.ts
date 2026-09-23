import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import type { Role } from "@/api/types";

declare module "vue-router" {
  interface RouteMeta {
    /** Route publik (mis. login) — tidak butuh sesi. */
    public?: boolean;
    /** Peran yang boleh masuk. Kosong = semua yang login. */
    roles?: Role[];
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("@/pages/LoginPage.vue"),
      meta: { public: true },
    },
    {
      path: "/",
      component: () => import("@/components/layout/AppLayout.vue"),
      children: [
        {
          path: "",
          name: "dashboard",
          component: () => import("@/pages/DashboardPage.vue"),
        },
        {
          path: "requests",
          name: "requests",
          component: () => import("@/pages/RequestsPage.vue"),
        },
        {
          path: "requests/new",
          name: "request-new",
          component: () => import("@/pages/RequestNewPage.vue"),
        },
        {
          path: "requests/:id",
          name: "request-detail",
          component: () => import("@/pages/RequestDetailPage.vue"),
        },
        {
          path: "requests/:id/edit",
          name: "request-edit",
          component: () => import("@/pages/RequestEditPage.vue"),
        },
        {
          path: "users",
          name: "users",
          component: () => import("@/pages/UsersPage.vue"),
          meta: { roles: ["admin"] },
        },
      ],
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      redirect: { name: "dashboard" },
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (!(await auth.restore())) {
    if (to.meta.public) return true;
    return { name: "login", query: { redirect: to.fullPath } };
  }

  if (to.meta.public) {
    return { name: "dashboard" };
  }

  const required = to.meta.roles;
  if (required && !auth.hasRole(...required)) {
    return { name: "dashboard" };
  }

  return true;
});

export default router;
