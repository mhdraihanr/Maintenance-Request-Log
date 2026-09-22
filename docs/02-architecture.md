# 02 — Architecture

---

## 1. Tumpukan Teknologi

| Lapisan  | Pilihan                                        | Alasan singkat                                                                                                                                           |
| -------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend | **Vue 3 + Vite + TypeScript**                  | Diminta oleh brief (Vue 3 atau Nuxt). Vite dipilih karena aplikasi ini SPA internal di belakang login — tidak butuh SSR/SEO yang jadi alasan utama Nuxt  |
| State    | **Pinia**                                      | Standar de-facto Vue 3, ringan, cukup untuk `auth` + `requests` store                                                                                    |
| Router   | **Vue Router 4**                               | Route guard untuk role-gating di sisi klien                                                                                                              |
| Styling  | **CSS murni + design token (CSS variables)**   | Referensi UI sudah menetapkan token warna/ukuran. Tidak menambah Tailwind agar tidak mengaburkan keputusan desain                                        |
| Backend  | **Hono (TypeScript) di Node.js**               | Dipilih dari dua opsi (Hono / Go). Alasan: satu bahasa (TS) untuk seluruh repo, tipe request/response bisa dibagi ke frontend, ekosistem validasi matang |
| Validasi | **Zod**                                        | Skema tunggal yang sekaligus menghasilkan tipe TS — mengurangi duplikasi validasi & tipe                                                                 |
| DB       | **PostgreSQL 16**                              | Diminta brief                                                                                                                                            |
| Akses DB | **`pg` + SQL langsung (query builder tipis)**  | Skema kecil (2 tabel). SQL langsung lebih mudah dibaca reviewer daripada ORM, dan memperlihatkan pemahaman query                                         |
| Migrasi  | **Skrip SQL bernomor** (`db/migrations/*.sql`) | Transparan, tanpa dependensi tambahan                                                                                                                    |
| Auth     | **JWT (HS256) di httpOnly cookie**             | Lihat §3                                                                                                                                                 |
| Hash     | **argon2id** (`@node-rs/argon2`)               | Pemenang Password Hashing Competition; lebih tahan GPU cracking daripada bcrypt                                                                          |
| Runtime  | **Node 20 LTS**                                | LTS, sesuai image Docker `node:20-alpine`                                                                                                                |

---

## 2. Diagram Sistem

```
┌────────────────────────────────────────────────────────────┐
│  Browser                                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Vue 3 SPA (Vite)  →  static files via nginx          │  │
│  │  - Pinia: auth, requests, users                      │  │
│  │  - Router guard: role-based route                  │  │
│  └───────────────────────┬──────────────────────────────┘  │
└──────────────────────────┼─────────────────────────────────┘
                           │  fetch('/api/...', credentials: 'include')
                           │  Cookie: auth=<jwt>  (httpOnly)
                           ▼
┌────────────────────────────────────────────────────────────┐
│  Hono API (Node 20)                                        │
│                                                            │
│  Middleware chain (urutan penting):                        │
│   1. requestId      → id unik per request (log correlation) │
│   2. logger         → structured log                        │
│   3. errorHandler   → error seragam → JSON                  │
│   4. authMiddleware → verifikasi JWT → c.set('user')        │
│   5. requireRole()  → guard per-route                       │
│                                                            │
│  Catatan: TIDAK ada middleware CORS. Di produksi nginx      │
│  menyajikan SPA dan mem-proxy /api/* sehingga satu origin   │
│  (lihat ADR-01 & 06 §1). Untuk mode dev frontend di         │
│  localhost:5173, CORS dibuka HANYA saat NODE_ENV=           │
│  development — lihat §6.                                   │
│                                                            │
│  Routes:                                                   │
│   /api/auth/*      login, logout, me                       │
│   /api/requests/*  CRUD + approve/reject                   │
│   /api/users/*     admin only                              │
│   /health          (bonus)                                 │
└──────────────────────────┬─────────────────────────────────┘
                           │  pg Pool
                           ▼
┌────────────────────────────────────────────────────────────┐
│  PostgreSQL 16                                             │
│   users(id, username, name, password_hash, role, ...)      │
│   requests(id, code, machine_id, ..., created_by, ...)     │
└────────────────────────────────────────────────────────────┘
```

> **Catatan routing:** di produksi, nginx menyajikan SPA dan mem-proxy `/api/*` ke service `api`. Ini menghindari CORS sepenuhnya dan membuat cookie `SameSite=Lax` bekerja tanpa konfigurasi domain tambahan.

---

## 3. Keputusan Kunci (ADR Ringkas)

### ADR-01 — Auth: JWT di httpOnly cookie

**Keputusan:** JWT ditandatangani HS256, disimpan di cookie `httpOnly; Secure (prod); SameSite=Lax; Path=/`.

| Alternatif                            | Kenapa tidak dipilih                                                                                                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| JWT di `localStorage` + Bearer header | Rentan XSS — JS apa pun bisa membaca token. Untuk aplikasi internal yang menangani data operasional, ini tidak dapat diterima                                                                                                  |
| Server-side session (tabel/Redis)     | Bisa direvoke, tapi menambah satu komponen stateful + lookup DB di setiap request. Manfaat revoke tidak sebanding untuk skala internal ini                                                                                     |
| JWT di cookie (dipilih)               | Stateless (tidak ada lookup sesi), tidak bisa dibaca JS (aman dari XSS), otomatis terkirim browser. Trade-off: sulit direvoke sebelum kedaluwarsa → dimitigasi dengan TTL pendek + **cek `is_active` ke DB di setiap request** |

**Mitigasi CSRF:** cookie `SameSite=Lax` + SPA dan API berada di origin yang sama (nginx proxy) → tidak ada cross-site request. Endpoint mutasi hanya menerima `application/json` (bukan form-encoded), yang mempersulit CSRF klasik.

**Isi JWT:** `{ sub: userId, role, iat, exp }` — **hanya** ID + role, bukan data sensitif. Role tetap diverifikasi ulang dari DB (jangan percaya role di token saja) demi konsistensi saat role diubah admin.

**TTL:** 8 jam (satu shift kerja). Alasan: keseimbangan antara keamanan dan kenyamanan operator di lantai produksi yang tidak selalu punya akses mudah ke login.

### ADR-02 — Backend Hono, bukan Go

Alasan: brief memperbolehkan pilih salah satu. Hono dipilih karena (a) seluruh repo jadi TypeScript sehingga tipe bisa dibagi, (b) Zod memberi validasi + tipe sekaligus, (c) target deploy di Node sudah dipahami tim internal. Go lebih cepat secara runtime, tapi kecepatan bukan bottleneck di aplikasi internal berskala ratusan request per hari.

### ADR-03 — SQL langsung, bukan ORM

Skema hanya 2 tabel. SQL langsung membuat setiap query terlihat utuh di review, tanpa perlu reviewer menebak apa yang dihasilkan ORM. Parameterized query (`$1, $2`) mencegah SQL injection.

### ADR-04 — Otorisasi sebagai middleware berlapis, bukan `if` tersebar

Tiga lapis, dari luar ke dalam:

1. **`authMiddleware`** — siapa Anda? (valid JWT + `is_active`)
2. **`requireRole(...)`** — peran ini boleh masuk route ini?
3. **Policy per-resource** — _resource ini_ boleh disentuh oleh user ini?

Lapis 3 adalah alasan matriks izin tidak bisa dijamin hanya oleh middleware: `PATCH /requests/:id` mengizinkan Operator **dan** Supervisor **dan** Admin, tapi Operator/Supervisor hanya untuk request miliknya yang masih `submitted`. Ini **wajib** dicek di service layer setelah baris diambil dari DB.

```ts
// contoh policy terpusat, dipakai semua handler mutasi
export function canEdit(user: AuthUser, req: RequestRow): boolean {
  if (user.role === "admin") return true;
  if (req.createdBy !== user.id) return false; // bukan miliknya
  return req.status === "submitted"; // sudah ditinjau → terkunci
}
```

**Prinsip:** jalur bahagia dan jalur tolakan memakai fungsi policy yang **sama**. Tidak ada duplikasi aturan antara "boleh" dan "tidak boleh".

### ADR-05 — Error & respons seragam

Semua respons sukses: `{ "data": ... }`. Semua error: `{ "error": { "code": "...", "message": "...", "fields": { ... } } }`.
Ini membuat frontend punya satu penangan error dan membuat pengujian API langsung jauh lebih mudah.

Kode status: `400` validasi · `401` belum login/token invalid · `403` tidak punya izin · `404` tidak ditemukan · `409` konflik status · `500` internal.

### ADR-06 — UI tidak dipakai sebagai batas keamanan

Navigasi menyembunyikan menu yang tidak relevan (Operator tidak melihat "All Requests"), tetapi **setiap** endpoint tetap mengecek izin. Reviewer dapat memanggil API langsung untuk membuktikan ini — skenario ujinya ada di [01 §6](01-requirements.md).

---

## 4. Struktur Repo

```text
maintenance-request-log/
├── docker-compose.yml
├── Jenkinsfile
├── .env.example
├── README.md
├── docs/                          # dokumen ini
├── api/                           # backend Hono
│   ├── src/
│   │   ├── index.ts               # entry: app + middleware + routes
│   │   ├── env.ts                 # baca & validasi env (Zod)
│   │   ├── db/
│   │   │   ├── pool.ts            # pg Pool
│   │   │   ├── migrate.ts         # jalankan migrations/*.sql
│   │   │   └── seed.ts            # seed user + request
│   │   ├── middleware/
│   │   │   ├── requestId.ts       # id unik per request (log correlation)
│   │   │   ├── auth.ts            # verify JWT → c.user
│   │   │   ├── requireRole.ts
│   │   │   ├── errorHandler.ts
│   │   │   └── logger.ts
│   │   ├── types.ts               # declaration merging ContextVariableMap (wajib)
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── request.routes.ts
│   │   │   ├── user.routes.ts
│   │   │   └── health.routes.ts
│   │   ├── services/              # logika bisnis (tempat policy dijalankan)
│   │   │   ├── auth.service.ts
│   │   │   ├── request.service.ts
│   │   │   └── user.service.ts
│   │   ├── schemas/               # skema Zod (input & output)
│   │   │   ├── auth.schema.ts
│   │   │   ├── request.schema.ts
│   │   │   └── user.schema.ts
│   │   ├── policies/
│   │   │   └── permissions.ts     # canEdit, canView, canReview, canDelete
│   │   └── utils/
│   │       ├── errors.ts          # AppError + factory (400/403/…)
│   │       ├── jwt.ts
│   │       └── password.ts        # argon2 wrapper
│   ├── db/
│   │   ├── migrations/001_init.sql
│   │   └── seed.sql (opsional, atau via seed.ts)
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
└── web/                           # frontend Vue 3
    ├── src/
    │   ├── main.ts
    │   ├── App.vue
    │   ├── router/index.ts        # guard role
    │   ├── stores/                # Pinia: auth, request, user
    │   ├── api/                   # wrapper fetch + error handling
    │   ├── components/
    │   │   ├── layout/            # AppSidebar, AppHeader
    │   │   ├── common/            # StatusBadge, PriorityBadge, DataTable,
    │   │   │                      # StatCard, ConfirmDialog, EmptyState, …
    │   │   └── forms/             # RequestForm, UserForm
    │   ├── pages/                 # Login, Dashboard, Requests, RequestDetail,
    │   │                          # CreateRequest, Users
    │   └── styles/theme.css       # design token (lihat 05-ui-ux.md)
    ├── Dockerfile                 # multi-stage: build → nginx (bonus)
    ├── index.html
    ├── package.json
    └── vite.config.ts
```

---

## 5. Alur Request (contoh nyata)

**Skenario:** Operator `bud` mengedit request miliknya yang masih `submitted`.

```
1. Browser  → PATCH /api/requests/:id   (cookie auth, body JSON)
2. requestId + logger middleware         → catat mulai
3. authMiddleware                        → verifikasi JWT, ambil user + is_active dari DB
4. requireRole('operator','supervisor','admin') → lolos
5. Zod parse body                        → hanya machine_id/description/priority (sisanya di-strip)
6. request.service.update():
     a. SELECT request WHERE id = :id    → 404 bila tidak ada
     b. canEdit(user, row)               → false? throw 403
     c. UPDATE ... SET updated fields    → 200
7. Response { data: {...} }              → frontend update store + toast sukses
```

Jika langkah 6b gagal → `403`, dan **tidak ada** perubahan tersimpan. Ini yang diuji reviewer lewat API langsung.

---

## 6. Konvensi Kode

| Area      | Konvensi                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------- |
| Penamaan  | `snake_case` di DB, `camelCase` di TS, tipe `PascalCase`                                            |
| Pemisahan | Route = HTTP saja. Logika di `services/`. Policy di `policies/`                                     |
| Validasi  | Semua input lewat Zod **sebelum** menyentuh service                                                 |
| Error     | Selalu `throw AppError`, jangan `return c.json({error})` langsung — agar errorHandler menyeragamkan |
| Log       | Structured (JSON). **Tidak pernah** mencatat password atau token                                    |
| Commit    | Commit kecil & bermakna; prefix `feat:`, `fix:`, `docs:`, `chore:`, `test:`                         |
| Bahasa    | Kode & komentar dalam Inggris; docs & UI copy mengikuti bahasa referensi                            |

---

## 7. CORS — dev vs produksi

**Produksi:** tidak ada CORS sama sekali. nginx menyajikan SPA dan mem-proxy `/api/*` ke service
`api`, sehingga browser melihat satu origin (`http://localhost:8080`). Cookie `SameSite=Lax`
bekerja tanpa konfigurasi domain tambahan. Ini alasan `cors` **tidak** ada di rantai middleware §2.

**Dev:** frontend Vite berjalan di `http://localhost:5173` sementara API di `http://localhost:3000`
— dua origin berbeda. Tanpa CORS, browser memblokir request dan cookie tidak terkirim.

Karena itu middleware CORS **hanya** diaktifkan saat `NODE_ENV=development`:

```ts
// di index.ts, SEBELUM requestId — hanya saat dev
if (env.NODE_ENV === "development") {
  app.use(
    "/api/*",
    cors({
      origin: "http://localhost:5173",
      credentials: true, // wajib, agar cookie auth ikut terkirim
    }),
  );
}
```

Aturan yang dipegang:

- Origin di-**whitelist eksplisit**, bukan `*` — karena `credentials: true` dan `*` tidak boleh
  dipakai bersama (browser akan menolak).
- **Jangan** aktifkan CORS di produksi. Kalau `NODE_ENV` salah di-set, itu bug konfigurasi yang
  harus terlihat, bukan ditutupi.
- Dependensi: `hono/cors` sudah tersedia dari paket `hono` — tidak perlu paket tambahan.

> Catatan implementasi: CORS untuk dev belum dipasang pada Step 1–7 (produksi belum membutuhkan).
> Ditambahkan saat frontend mulai dikerjakan di Step 16+.
