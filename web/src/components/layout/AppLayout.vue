<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import type { Role } from "@/api/types";

interface NavItem {
  to: string;
  label: string;
  roles?: Role[];
}

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard" },
  { to: "/requests", label: "All Requests" },
  { to: "/users", label: "Users", roles: ["admin"] },
];

const visibleNav = computed(() =>
  navItems.filter((item) => !item.roles || auth.hasRole(...item.roles)),
);

const initials = computed(() => {
  const name = auth.user?.name ?? "";
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
});

const roleLabel = computed(() => {
  const role = auth.user?.role;
  if (!role) return "";
  return role.charAt(0).toUpperCase() + role.slice(1);
});

async function handleLogout(): Promise<void> {
  await auth.logout();
  await router.push({ name: "login" });
}
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">HIROSE</span>
        <span class="brand-sub">Electric Indonesia</span>
      </div>

      <nav class="nav">
        <RouterLink
          v-for="item in visibleNav"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ active: route.path === item.to }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="profile">
        <span class="avatar">{{ initials }}</span>
        <span class="profile-text">
          <span class="profile-name">{{ auth.user?.name }}</span>
          <span class="profile-role">{{ roleLabel }}</span>
        </span>
      </div>
    </aside>

    <div class="main">
      <header class="header">
        <span class="header-user">
          <span class="header-name">{{ auth.user?.name }}</span>
          <span class="header-role">{{ roleLabel }}</span>
        </span>
        <button type="button" class="logout" @click="handleLogout">
          Logout
        </button>
      </header>

      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 232px 1fr;
  min-height: 100vh;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-5) var(--space-4);
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
}

.brand {
  display: flex;
  flex-direction: column;
}

.brand-mark {
  font-size: var(--text-card);
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: 0.02em;
}

.brand-sub {
  font-size: var(--text-small);
  color: var(--color-text-muted);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
}

.nav-item {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-body);
  font-weight: 500;
  color: var(--color-text-muted);
}

.nav-item:hover {
  background: var(--color-primary-soft);
}

.nav-item.active {
  background: var(--tab-active-bg);
  color: var(--tab-active-fg);
}

.profile {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.avatar {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: var(--text-small);
  font-weight: 600;
  flex-shrink: 0;
}

.profile-text {
  display: flex;
  flex-direction: column;
}

.profile-name {
  font-size: var(--text-body);
  font-weight: 600;
}

.profile-role {
  font-size: var(--text-small);
  color: var(--color-text-muted);
}

.main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-6);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.header-user {
  display: none;
  flex-direction: column;
  align-items: flex-end;
  min-width: 0;
}

.header-name {
  font-size: var(--text-body);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-role {
  font-size: var(--text-small);
  color: var(--color-text-muted);
}

.logout {
  flex-shrink: 0;
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-size: var(--text-button);
  font-weight: 600;
  color: var(--color-text);
}

.logout:hover {
  background: var(--color-bg);
}

.content {
  flex: 1;
  padding: var(--space-6);
  min-width: 0;
}

@media (max-width: 768px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    flex-direction: row;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-right: none;
    border-bottom: 1px solid var(--color-border);
  }

  .brand {
    flex-shrink: 0;
  }

  .brand-sub {
    display: none;
  }

  /* The nav is the only region that scrolls horizontally. */
  .nav {
    flex-direction: row;
    flex-wrap: nowrap;
    gap: var(--space-1);
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .nav-item {
    white-space: nowrap;
    padding: var(--space-2) var(--space-3);
  }

  /* On mobile the identity moves to the header, so drop the sidebar copy. */
  .profile {
    display: none;
  }

  .header-user {
    display: flex;
    margin-right: auto;
  }

  .content {
    padding: var(--space-5) var(--space-4);
  }
}
</style>
