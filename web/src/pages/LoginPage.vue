<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { ApiError } from "@/api/client";
import loginHero from "@/assets/login-hero.png";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const username = ref("");
const password = ref("");
const showPassword = ref(false);
const errorMessage = ref("");

async function handleSubmit(): Promise<void> {
  errorMessage.value = "";

  if (!username.value || !password.value) {
    errorMessage.value = "Username dan password wajib diisi";
    return;
  }

  try {
    await auth.login(username.value, password.value);
    const redirect = route.query.redirect;
    await router.push(
      typeof redirect === "string" ? redirect : { name: "dashboard" },
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      errorMessage.value = "Username atau password salah";
      return;
    }
    errorMessage.value = "Tidak dapat terhubung ke server. Coba lagi.";
  }
}
</script>

<template>
  <div class="login">
    <section class="panel-brand">
      <!-- Urutan lapisan dekoratif: foto, lalu slab, lalu garis aksen.
           Ketiganya aria-hidden karena teks di atasnya yang membawa makna. -->
      <img
        class="panel-brand__photo"
        :src="loginHero"
        alt=""
        aria-hidden="true"
      />
      <span class="panel-brand__slab" aria-hidden="true"></span>
      <span class="panel-brand__edge" aria-hidden="true"></span>

      <div class="brand-copy">
        <span class="brand-mark">HIROSE</span>
        <span class="brand-sub">Electric Indonesia</span>
      </div>
      <p class="tagline">Creative Links<br />to World Electronics</p>
    </section>

    <section class="panel-form">
      <form class="form" novalidate @submit.prevent="handleSubmit">
        <div class="form-head">
          <span class="logo" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M9 4.5H7.5A2.5 2.5 0 0 0 5 7v12.5A2.5 2.5 0 0 0 7.5 22h9a2.5 2.5 0 0 0 2.5-2.5V7a2.5 2.5 0 0 0-2.5-2.5H15"
              />
              <rect x="9" y="2" width="6" height="4.5" rx="1.5" />
              <path d="m9.4 14 2 2 3.4-3.9" />
            </svg>
          </span>
          <h1 class="title">Maintenance Request System</h1>
          <p class="subtitle">PT. Hirose Electric Indonesia</p>
        </div>

        <div class="field">
          <label for="username">Username</label>
          <input
            id="username"
            v-model="username"
            type="text"
            autocomplete="username"
            :disabled="auth.loading"
          />
        </div>

        <div class="field">
          <label for="password">Password</label>
          <div class="password-wrap">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              :disabled="auth.loading"
            />
            <button
              type="button"
              class="toggle"
              :aria-label="
                showPassword ? 'Sembunyikan password' : 'Tampilkan password'
              "
              @click="showPassword = !showPassword"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
                />
                <circle cx="12" cy="12" r="3.2" />
                <path v-if="showPassword" d="m4 20 16-16" />
              </svg>
            </button>
          </div>
        </div>

        <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

        <button type="submit" class="submit" :disabled="auth.loading">
          {{ auth.loading ? "Memproses…" : "Login" }}
        </button>

        <p class="note">Secure access for authorized users only</p>
      </form>
    </section>
  </div>
</template>

<style scoped>
.login {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
}

.panel-brand {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: var(--space-8);
  /* Fallback bila gambar gagal dimuat — tetap biru, teks tetap terbaca. */
  background: linear-gradient(
    160deg,
    var(--hiro-blue-800),
    var(--hiro-blue-600)
  );
  color: var(--color-text-inverse);
  overflow: hidden;
}

.panel-brand__photo {
  position: absolute;
  inset: 0;
  z-index: -3;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 85% center;
}

.panel-brand__slab {
  position: absolute;
  inset: 0;
  z-index: -2;
  background: linear-gradient(
    180deg,
    rgba(0, 110, 210, 0.58) 0%,
    rgba(0, 85, 185, 0.8) 45%,
    rgba(0, 60, 155, 0.94) 100%
  );
  clip-path: polygon(99% 0, 100% 0, 100% 100%, 88% 100%);
}

.panel-brand__edge {
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(
    180deg,
    rgba(56, 150, 252, 0.35) 0%,
    rgba(56, 150, 252, 0.62) 60%,
    rgba(56, 150, 252, 0.72) 100%
  );
  clip-path: polygon(93% 0, 96.5% 0, 85% 100%, 81.5% 100%);
}

.panel-brand::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 42%;
  z-index: 0;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.72) 0%,
    rgba(255, 255, 255, 0.34) 45%,
    rgba(255, 255, 255, 0) 100%
  );
  pointer-events: none;
}

.panel-brand::after {
  content: "";
  position: absolute;
  inset: auto 0 0 0;
  height: 32%;
  z-index: 0;
  background: linear-gradient(
    0deg,
    rgba(0, 30, 60, 0.6) 0%,
    rgba(0, 30, 60, 0.28) 55%,
    rgba(0, 30, 60, 0) 100%
  );
  pointer-events: none;
}

.brand-copy,
.tagline {
  position: relative;
  z-index: 1;
}

.brand-copy {
  display: flex;
  flex-direction: column;
}

.brand-mark {
  font-size: 40px;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: 0.02em;
  color: var(--hiro-blue-800);
}

.brand-sub {
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--hiro-blue-800);
  opacity: 0.9;
}

.tagline {
  font-size: var(--text-section);
  font-weight: 700;
  line-height: 1.4;
  color: var(--color-text-inverse);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}

.panel-form {
  display: grid;
  place-items: center;
  padding: var(--space-6);
  background: var(--color-surface);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  max-width: 360px;
}

.form-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  text-align: center;
}

.logo {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 2px solid var(--color-primary);
  border-radius: 50%;
  color: var(--color-primary);
}

.logo svg {
  width: 24px;
  height: 24px;
}

.title {
  font-size: var(--text-page-title);
  font-weight: 700;
}

.subtitle {
  font-size: var(--text-body);
  color: var(--color-text-muted);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field label {
  font-size: var(--text-small);
  font-weight: 600;
  color: var(--color-text-muted);
}

.field input {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-md);
  background: var(--color-input-bg);
  font-family: inherit;
  font-size: var(--text-body);
  color: var(--color-text);
}

.field input:focus {
  border-color: var(--input-border-focus);
  box-shadow: var(--input-ring);
  outline: none;
}

.password-wrap {
  position: relative;
  display: flex;
}

.password-wrap input {
  width: 100%;
}

.toggle {
  position: absolute;
  right: var(--space-2);
  top: 50%;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.toggle:hover {
  color: var(--color-primary);
}

.toggle svg {
  width: 18px;
  height: 18px;
}

.error {
  color: var(--color-danger);
  font-size: var(--text-small);
}

.submit {
  padding: var(--space-3) var(--space-4);
  border: none;
  border-radius: var(--radius-md);
  background: var(--button-primary-bg);
  color: var(--button-primary-fg);
  font-size: var(--text-button);
  font-weight: 600;
  transition: background 200ms ease;
}

.submit:hover:not(:disabled) {
  background: var(--button-primary-bg-hov);
}

.submit:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.note {
  text-align: center;
  font-size: var(--text-small);
  color: var(--color-text-muted);
}

@media (max-width: 768px) {
  .login {
    grid-template-columns: 1fr;
  }

  .panel-brand {
    min-height: 180px;
    padding: var(--space-6);
  }

  /* Di layar sempit, panel jadi strip pendek. Sembunyikan slab & garis aksen
     supaya tidak terlihat aneh (foto saja yang tampil), dan geser fokus foto
     ke gedung bagian atas. */
  .panel-brand__slab,
  .panel-brand__edge {
    display: none;
  }

  .panel-brand__photo {
    object-position: 85% 35%;
  }

  .panel-form {
    padding: var(--space-6) var(--space-4);
  }
}
</style>
