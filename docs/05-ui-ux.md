# 05 — UI / UX

Sumber visual: `ui-ux-reference.png` + `UI_UX_REFERENCE.md`.
Prinsip: **internal enterprise**, corporate, minimal, mudah dipindai. Hirose blue sebagai brand + aksi.

> **Catatan penting (AI disclosure):** skill `ui-ux-pro-max --design-system` merekomendasikan _Dark Mode OLED + hijau `#16A34A` + tipografi serif_. Rekomendasi itu **ditolak** karena bertentangan dengan brand Hirose yang sudah ditetapkan. Brand identity dari brief menang atas default skill. Detail di README bagian AI Disclosure.

---

## 1. Design Token

Arsitektur 3 lapis: **Primitive → Semantic → Component**. Semua nilai hidup di `web/src/styles/theme.css` sebagai CSS variable, sehingga tidak ada hex mentah yang tersebar di komponen.

### 1.1 Primitive

```css
:root {
  /* Brand */
  --hiro-blue-600: #0066cc; /* primary */
  --hiro-blue-800: #003b73; /* dark blue */
  --hiro-blue-050: #eaf3ff; /* light blue */

  /* Neutral */
  --neutral-000: #ffffff;
  --neutral-050: #f5f8fc; /* app background */
  --neutral-150: #d9e2ec; /* border */
  --neutral-500: #667085; /* secondary text */
  --neutral-900: #172b4d; /* primary text */

  /* Status */
  --status-success: #12b76a;
  --status-warning: #f79009;
  --status-danger: #f04438;
  --status-info: #2e90fa;
}
```

### 1.2 Semantic

```css
:root {
  --color-primary: var(--hiro-blue-600);
  --color-primary-hover: var(--hiro-blue-800);
  --color-primary-soft: var(--hiro-blue-050);

  --color-bg: var(--neutral-050);
  --color-surface: var(--neutral-000);
  --color-border: var(--neutral-150);

  --color-text: var(--neutral-900);
  --color-text-muted: var(--neutral-500);

  --color-success: var(--status-success);
  --color-warning: var(--status-warning);
  --color-danger: var(--status-danger);
  --color-info: var(--status-info);

  /* Radius — dipakai sengaja, bukan pill di semua elemen */
  --radius-sm: 6px; /* badge, input kecil */
  --radius-md: 10px; /* card, tombol, panel */

  /* Spacing — kelipatan 4 */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* Elevation — hanya untuk elemen yang memang harus terangkat */
  --shadow-card:
    0 1px 2px rgba(23, 43, 77, 0.06), 0 1px 3px rgba(23, 43, 77, 0.04);
  --shadow-pop: 0 4px 12px rgba(23, 43, 77, 0.1);
}
```

### 1.3 Component

```css
:root {
  --button-primary-bg: var(--color-primary);
  --button-primary-fg: #fff;
  --button-primary-bg-hov: var(--color-primary-hover);
  --button-danger-bg: var(--color-danger);
  --tab-active-bg: var(--color-primary);
  --tab-active-fg: #fff;
  --table-row-hover-bg: var(--color-primary-soft);
  --input-border: var(--color-border);
  --input-border-focus: var(--color-primary);
  --input-ring: 0 0 0 3px rgba(0, 102, 204, 0.15);
}
```

### 1.4 Typography

Font: **Inter**, fallback `system-ui, -apple-system, "Segoe UI", sans-serif` (self-host atau Google Fonts; tidak perlu font kedua).

| Token               | Ukuran / Berat | Dipakai untuk                  |
| ------------------- | -------------- | ------------------------------ |
| `--text-page-title` | 24px / 700     | Judul halaman ("All Requests") |
| `--text-section`    | 18px / 600     | Judul seksi                    |
| `--text-card`       | 16px / 600     | Judul card ("Recent Requests") |
| `--text-body`       | 14px / 400     | Isi tabel, label               |
| `--text-small`      | 12px / 400     | Teks bantu, timestamp          |
| `--text-button`     | 14px / 600     | Tombol                         |

Line-height 1.5 untuk body. Tidak ada teks < 12px.

---

## 2. Layout

```
┌───────────┬──────────────────────────────────────────────┐
│           │  AppHeader (search global opsional, bell,     │
│ AppSidebar│  user menu / logout)                          │
│  ~230px   ├──────────────────────────────────────────────┤
│           │                                              │
│  LOGO     │   ┌─ Page title + deskripsi + aksi ─────┐     │
│  ─────    │   └──────────────────────────────────────┘     │
│  Dashboard│                                              │
│  My Req   │   ┌─ Konten: card, tabel, form ─────────┐     │
│  All Req  │   │                                       │     │
│  Users    │   │                                       │     │
│           │   └───────────────────────────────────────┘     │
│  ─────    │                                              │
│  [avatar] │   padding 16–24px, konten memanfaatkan lebar  │
│  Admin    │                                              │
└───────────┴──────────────────────────────────────────────┘
```

- Sidebar: lebar 220–240px, background putih, tetap (fixed) di desktop.
- Item aktif: background `--tab-active-bg` (Hirose blue) + teks putih, radius `--radius-md`.
- Item non-aktif: teks `--color-text-muted`, hover → background `--color-primary-soft`.
- Profil user di bawah sidebar (avatar inisial + nama + role).
- Konten maksimum tidak dikunci lebar kaku; memakai lebar viewport secara efisien.

### 2.1 Responsif

| Breakpoint | Perubahan                                                                |
| ---------- | ------------------------------------------------------------------------ |
| ≥ 1024px   | Sidebar penuh, dashboard multi-kolom, tabel penuh                        |
| 768–1023px | Sidebar bisa collapse (toggle ikon menu), card dashboard wrap 2 kolom    |
| < 768px    | Sidebar jadi drawer (overlay), form 1 kolom, tabel **scroll horizontal** |

Detail aturan dari skill `antislop-layoutmobile`: mobile **bukan** desktop yang dikecilkan — ia harus menata ulang. Tabel dengan 8 kolom tidak dipaksakan menyusut; ia di-scroll, dengan kolom `Actions` tetap terlihat (sticky kanan).

---

## 3. Navigasi Berdasarkan Peran

Menu disembunyikan bila peran tidak berhak, **tetapi API tetap menolak** (lihat [04](04-api-spec.md)).

| Menu         | Operator | Supervisor | Admin |
| ------------ | :------: | :--------: | :---: |
| Dashboard    |    ✅    |     ✅     |  ✅   |
| My Requests  |    ✅    |     ✅     |  ✅   |
| All Requests |    ❌    |     ✅     |  ✅   |
| Users        |    ❌    |     ❌     |  ✅   |

Tombol/aksi di dalam halaman juga mengikuti aturan ini (mis. tombol "Approve" hanya muncul untuk Supervisor/Admin).

---

## 4. Halaman

### 4.1 Login — split screen

```
┌──────────────────────────┬───────────────────────────────┐
│  Panel kiri (biru)       │  Panel kanan (putih)          │
│                          │                               │
│  HIROSE                  │        ⌾ (ikon maintenance)   │
│  Electric Indonesia      │                               │
│                          │  Maintenance Request Log      │
│  [foto/ilustrasi         │   PT. Hirose Electric Indonesia│
│   pabrik]                │                               │
│                          │   Username  [____________]    │
│                          │   Password  [______] [👁]      │
│                          │                               │
│  "Better Connection      │   [       Login        ]      │
│   for a Brighter Future" │                               │
│                          │   Secure access for           │
│                          │   authorized users only       │
└──────────────────────────┴───────────────────────────────┘
```

- Tidak ada field selain username + password. Tidak ada "remember me", tidak ada "lupa password".
- Toggle visibilitas password.
- Error inline di bawah form: "Username atau password salah" (tanpa membedakan mana yang salah).
- Tombol disabled + spinner saat submit.

### 4.2 Dashboard

- 4 **StatCard** di atas: Total Requests, Approved, Rejected, Submitted.
  - Setiap card: ikon berwarna, label kecil, angka besar, aksen warna status.
  - Ikon: total=blue, approved=green, rejected=red, submitted=orange.
- **Request Status Overview**: donut chart. Data = jumlah per status. Legenda menampilkan jumlah + persentase. Pusat donut = total.
  - Warna: Submitted = orange/blue, Approved = green, Rejected = red.
  - **Aksesibilitas:** angka real juga ditampilkan sebagai teks di legenda, sehingga informasi **tidak** bergantung pada warna saja.
- **Recent Requests**: tabel ringkas 5 baris terbaru + link "View all". Kolom: ID, Machine/Asset, Priority, Status, Created At.
- Tombol "+ New Request" sebagai quick action (untuk semua peran).
- Tampilkan sapaan: "Welcome back, {name}".

**Peran Operator:** statistik mencerminkan **request miliknya** saja, bukan seluruh sistem. Ini konsisten dengan cakupan data di API.

### 4.3 Requests — All Requests / My Requests

- Judul dinamis: Operator melihat "My Requests"; Supervisor/Admin melihat "All Requests".
- Deskripsi singkat di bawah judul.
- Tombol "+ New Request" di kanan atas.
- **Filter bar**: SearchInput (machine ID / deskripsi / user), FilterSelect Status, FilterSelect Priority.
- **DataTable** kolom: ID (MR-001) · Machine/Asset · Problem Description (truncate 1 baris + tooltip) · Priority · Status · Created By · Created At · Actions.
- Badge: `StatusBadge` (submitted/approved/rejected), `PriorityBadge` (low/medium/high).
- Actions: menu tiga titik (⋮) berisi aksi yang relevan dengan peran & status. **Hanya** aksi yang benar-benar boleh yang ditampilkan.
- Footer: "Showing 1–8 of 24 results" + pagination (‹ 1 2 3 ›).
- State: loading (skeleton), empty (`EmptyState`: "Belum ada request"), error (`ErrorState` + tombol "Coba lagi").

**Aturan badge (dari skill `ui-ux-pro-max`, domain `ux`):** label badge **tidak boleh wrap** ke baris kedua → `white-space: nowrap`, `min-width: 0`, dan nilai penuh tetap dapat diakses (bukan hanya tooltip hover).

### 4.4 Request Detail

Layout dua kolom (kolom kanan sticky di desktop):

**Kolom kiri — informasi**

- Baris atas: `← Back to list`, `MR-001`, `StatusBadge`, `PriorityBadge`.
- Judul besar: Machine/Asset. Di bawahnya: "Created by Budi (Operator) · 24 Sep 2026 08:32".
- Card **Request Information**: Machine/Asset, Problem Description, Priority, Status, Created By, Created At, Last Reviewed By, Last Reviewed At (tampilkan "—" bila belum ditinjau).

**Kolom kanan — aksi & riwayat**

- Card **Actions**: tombol bergantung peran & status.
  - Edit Request (bila boleh edit)
  - Approve (Supervisor/Admin, status `submitted`)
  - Reject (Supervisor/Admin, status `submitted`)
  - Delete Request (Admin) — **wajib** melalui `ConfirmDialog`
- Card **History**: timeline vertikal. Item pertama selalu "Request submitted by X". Item berikutnya saat ditinjau: "Approved by Y". (Bila bonus audit trail dikerjakan, isi timeline diambil dari tabel audit; bila tidak, minimal merekonstruksi 2 titik: submitted & reviewed.)

### 4.5 Create / Edit Request

Judul: **Create New Request** (atau "Edit Request").

- Card container, layout dua kolom untuk field pendek saat desktop.
- Field:
  1. **Machine / Asset** — input teks, wajib, tanda `*`.
  2. **Problem Description** — textarea full-width, wajib.
  3. **Priority** — select (Low / Medium / High), wajib.
  4. **Attachments** — _placeholder saja_ di referensi; **tidak** diimplementasikan (lihat [07](07-optional-tasks-plan.md)). Saat implementasi, area dropzone **dihilangkan** alih-alih menampilkan kontrol non-fungsional.
- Tombol: `Cancel` (secondary) + `Submit` (primary Hirose blue).
- Tombol Submit disabled + spinner selama request berjalan.
- **Validasi:** error tampil **di bawah field terkait** dengan `aria-describedby`; field invalid diberi border merah; setelah submit gagal, fokus pindah ke ringkasan error / field pertama yang salah. Validasi klien hanya untuk kenyamanan — server tetap memvalidasi ([01](01-requirements.md) NFR-03).

### 4.6 Users (Admin saja)

- Judul "Users" + tombol "+ Add User".
- Filter: SearchInput (nama/username) + FilterSelect Role.
- DataTable: Username · Name · Role · Status (Active/Inactive) · Created At · Last Login · Actions.
- Actions: Edit, Deactivate (via ConfirmDialog). Deactivate = soft delete; user tidak dihapus dari daftar, status berubah jadi Inactive.
- Tombol deactivate dinonaktifkan untuk akun sendiri (mencegah admin mengunci dirinya keluar).
- Empty/loading/error state seperti halaman lain.

---

## 5. Daftar Komponen

Semua reusable — tidak ada duplikasi UI antar halaman.

### Layout

| Komponen         | Tanggung jawab                                    |
| ---------------- | ------------------------------------------------- |
| `AppSidebar.vue` | Navigasi + logo + profil; item difilter per peran |
| `AppHeader.vue`  | Bell notifikasi (opsional), menu user, logout     |

### Common

| Komponen                                                         | Props utama                                               |
| ---------------------------------------------------------------- | --------------------------------------------------------- |
| `StatCard.vue`                                                   | `label`, `value`, `icon`, `tone`                          |
| `DataTable.vue`                                                  | `columns`, `rows`, `loading`, `emptyText`, slot per-kolom |
| `StatusBadge.vue`                                                | `status` → warna + label                                  |
| `PriorityBadge.vue`                                              | `priority` → warna + label                                |
| `SearchInput.vue`                                                | `modelValue`, debounce                                    |
| `FilterSelect.vue`                                               | `modelValue`, `options`, `placeholder`                    |
| `PrimaryButton.vue` / `SecondaryButton.vue` / `DangerButton.vue` | `loading`, `disabled`                                     |
| `ConfirmDialog.vue`                                              | `title`, `message`, `confirmLabel`, `tone`                |
| `Modal.vue`                                                      | `open`, `title`, slot body/footer                         |
| `EmptyState.vue`                                                 | `title`, `message`, slot aksi                             |
| `LoadingState.vue`                                               | skeleton / spinner                                        |
| `ErrorState.vue`                                                 | `message`, emit `retry`                                   |
| `Toast.vue`                                                      | `type` (success/error/warning/info), auto-dismiss         |

### Forms

| Komponen                                                | Catatan                                                         |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| `RequestForm.vue`                                       | Dipakai bersama oleh Create & Edit; menerima `initial` opsional |
| `UserForm.vue`                                          | Create/Edit user; field password hanya wajib saat create        |
| `FormInput.vue` / `FormTextarea.vue` / `FormSelect.vue` | Label visible + error inline + `aria-describedby`               |

---

## 6. Aturan Interaksi

**Tombol**

- Primary → Hirose blue. Destructive → merah. Secondary → putih + border.
- State: default, hover, focus-visible (ring), disabled, loading.
- Transisi 150–300ms, hormati `prefers-reduced-motion`.

**Tabel**

- Hover baris → `--table-row-hover-bg`.
- Spacing kompak, alignment kolom konsisten.
- Aksi dalam menu tiga titik bila > 2 aksi.

**Form**

- Label **selalu** terlihat (bukan hanya placeholder).
- Focus state terlihat jelas (ring biru).
- Error state jelas + pesan spesifik.
- Disabled selama submit + indikator loading.

**Notifikasi**

- Sukses → hijau; Error → merah; Warning → amber; Info → biru.
- Aksi destruktif (**Delete**, **Deactivate**) **wajib** lewat `ConfirmDialog`.

**Aksesibilitas (checklist dari skill)**

- Kontras teks ≥ 4.5:1.
- Semua elemen interaktif dijangkau keyboard, focus ring terlihat (jangan dihapus).
- Ikon **SVG** (Lucide), bukan emoji.
- Tombol ikon punya `aria-label`.
- Ukuran target sentuh ≥ 44×44px di mobile.
- Informasi status tidak hanya lewat warna (badge selalu punya teks).
- `cursor: pointer` pada semua elemen klikabel.

---

## 7. Peta Halaman → Peran

| Halaman        |       Operator       |      Supervisor      |   Admin    |
| -------------- | :------------------: | :------------------: | :--------: |
| Login          |          ✅          |          ✅          |     ✅     |
| Dashboard      |  ✅ (data sendiri)   |      ✅ (semua)      | ✅ (semua) |
| My Requests    |          ✅          |          ✅          |     ✅     |
| All Requests   | ❌ (tidak ada menu)  |          ✅          |     ✅     |
| Request Detail |       miliknya       |        semua         |   semua    |
| Create Request |          ✅          |          ✅          |     ✅     |
| Edit Request   | miliknya + submitted | miliknya + submitted |   semua    |
| Users          |          ❌          |          ❌          |     ✅     |
