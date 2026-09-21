# 01 — Requirements

Turunan langsung dari `Take-Home-Test-Full-Stack-Engineer.md`. Dokumen ini adalah **acuan tunggal** untuk fitur dan otorisasi. Jika kode berbeda dari dokumen ini, dokumen ini yang benar.

---

## 1. Entitas

### 1.1 User

| Field           | Tipe        | Aturan                                                             |
| --------------- | ----------- | ------------------------------------------------------------------ |
| `id`            | UUID        | Primary key                                                        |
| `username`      | string      | Unik, 3–32 char, `[a-z0-9._-]`, lowercase saat simpan              |
| `name`          | string      | Nama tampilan, 1–64 char                                           |
| `password_hash` | string      | **Wajib hash** (bcrypt/argon2). Tidak pernah dikembalikan ke klien |
| `role`          | enum        | `operator` \| `supervisor` \| `admin`                              |
| `is_active`     | boolean     | Default `true`. Deaktivasi = tidak bisa login                      |
| `last_login_at` | timestamptz | Nullable, diisi saat login sukses                                  |
| `created_at`    | timestamptz | Auto                                                               |

### 1.2 Request

| Field         | Tipe        | Aturan                                     |
| ------------- | ----------- | ------------------------------------------ |
| `id`          | UUID        | Primary key                                |
| `code`        | string      | Human-readable, contoh `MR-001`. Unik      |
| `machine_id`  | string      | Wajib, 1–64 char. Contoh: `Machine A-12`   |
| `description` | text        | Wajib, 5–2000 char                         |
| `priority`    | enum        | `low` \| `medium` \| `high`                |
| `status`      | enum        | `submitted` \| `approved` \| `rejected`    |
| `created_by`  | UUID → User | Wajib, diambil dari sesi (bukan dari body) |
| `created_at`  | timestamptz | Auto                                       |
| `reviewed_by` | UUID → User | Nullable                                   |
| `reviewed_at` | timestamptz | Nullable                                   |

**Aturan konsistensi:** `reviewed_by` dan `reviewed_at` harus **keduanya null** atau **keduanya terisi**. Status `approved`/`rejected` wajib punya keduanya; status `submitted` wajib null keduanya.

---

## 2. Matriks Izin (SUMBER KEBENARAN)

Legenda: ✅ diizinkan · ❌ ditolak · ⚠️ bersyarat (lihat catatan) · 👤 hanya miliknya sendiri

| #   | Aksi                                      | Operator | Supervisor | Admin | Catatan                              |
| --- | ----------------------------------------- | :------: | :--------: | :---: | ------------------------------------ |
| 1   | Buat request                              |    ✅    |     ✅     |  ✅   | `created_by` dari sesi               |
| 2   | Lihat request sendiri                     |    ✅    |     ✅     |  ✅   | Kepemilikan dicek by `created_by`    |
| 3   | Lihat semua request                       |    ❌    |     ✅     |  ✅   | Operator hanya melihat miliknya      |
| 4   | Edit request sendiri (status `submitted`) |    ✅    |     ✅     |  ✅   | 👤                                   |
| 5   | Edit request apa pun                      |    ❌    |     ❌     |  ✅   | Admin bypass                         |
| 6   | Approve / Reject                          |    ❌    |     ✅     |  ✅   | Menyetel `reviewed_by`/`reviewed_at` |
| 7   | Hapus request                             |    ❌    |     ❌     |  ✅   |                                      |
| 8   | Kelola user (buat/edit/nonaktifkan)       |    ❌    |     ❌     |  ✅   |                                      |

**Catatan bersyarat:**

- **Baris 4 vs 5:** Admin boleh edit request apa pun **kapan pun**. Operator/Supervisor hanya boleh edit miliknya **dan** hanya saat `status === 'submitted'`.
- **Baris 6:** Meninjau dua kali tidak diizinkan — request yang sudah `approved`/`rejected` tidak bisa ditinjau ulang (kecuali Admin, lihat keputusan di bawah).
- **Baris 8:** Admin **tidak boleh** menonaktifkan dirinya sendiri, dan sistem harus mencegah tersisa 0 user admin aktif.

### 2.1 Keputusan atas kasus ambigu

| Kasus                                                    | Keputusan                                           | Alasan                                                              |
| -------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| Admin meninjau request yang sudah ditinjau               | **Diizinkan** (menimpa hasil sebelumnya)            | Admin adalah jalur koreksi; riwayatnya terekam di audit trail bonus |
| Supervisor meninjau request yang sudah ditinjau          | **Ditolak** `409 Conflict`                          | Mencegah dua supervisor saling menimpa                              |
| Operator mengedit request miliknya yang sudah `approved` | **Ditolak** `403`                                   | Status terkunci pasca-review                                        |
| Membuat request atas nama user lain                      | **Ditolak** (field `created_by` diabaikan/di-strip) | Mencegah spoofing identitas                                         |
| User dinonaktifkan tapi masih pegang token               | **Ditolak** `401`                                   | Cek `is_active` di setiap request, bukan hanya saat login           |

---

## 3. Kebutuhan Fungsional

### FR-01 Autentikasi

- **FR-01.1** Login dengan `username` + `password`.
- **FR-01.2** Password diverifikasi terhadap hash (bcrypt/argon2).
- **FR-01.3** Login sukses → set JWT di httpOnly cookie + update `last_login_at`.
- **FR-01.4** Login gagal → `401`, pesan generik ("Username atau password salah") — jangan bocorkan mana yang salah.
- **FR-01.5** Rate-limit login (mis. 5 percobaan / 15 menit / IP+username) untuk cegah brute force.
- **FR-01.6** Logout → hapus cookie.
- **FR-01.7** User `is_active = false` → `401` meski kredensial benar.
- **FR-01.8** `GET /api/auth/me` mengembalikan profil dari sesi (dipakai frontend untuk role-gating).

### FR-02 Request

- **FR-02.1** Create — validasi server-side, `created_by` dari sesi, `code` dibuat otomatis.
- **FR-02.2** List — Operator: miliknya; Supervisor/Admin: semua.
- **FR-02.3** **Filter wajib:** minimal satu — implementasi `status` **dan** `priority` sekaligus (`?status=&priority=`).
- **FR-02.4** Search opsional (bonus) berdasarkan `machine_id`/`description`.
- **FR-02.5** Detail — dicek izin lihat (baris 2/3 matriks).
- **FR-02.6** Update — dicek baris 4/5 matriks.
- **FR-02.7** Approve/Reject — dicek baris 6; set `reviewed_by` + `reviewed_at`.
- **FR-02.8** Delete — Admin saja (baris 7).
- **FR-02.9** Kolom `status`, `created_by`, `created_at`, `reviewed_by`, `reviewed_at` **tidak bisa** diubah lewat endpoint update biasa.

### FR-03 User Management

- **FR-03.1** List user (Admin saja) + filter `role` & `is_active`.
- **FR-03.2** Create user — `password` wajib, di-hash.
- **FR-03.3** Update user — ganti `name`/`role`; password opsional (reset).
- **FR-03.4** Deactivate/activate user (`is_active`).
- **FR-03.5** Tidak boleh menonaktifkan diri sendiri.
- **FR-03.6** Tidak boleh menyisakan 0 admin aktif.

### FR-04 Seed Data

Satu user per peran + beberapa request, agar reviewer bisa langsung login:

| Username | Password        | Peran      |
| -------- | --------------- | ---------- |
| `bud`    | `operator123`   | Operator   |
| `siti`   | `supervisor123` | Supervisor |
| `andi`   | `admin123`      | Admin      |

> Password seed sengaja lemah & didokumentasikan; ini data demo. README akan menandai agar tidak dipakai di produksi.

Request seed: ± 8 baris mencakup **ketiga** status dan **ketiga** prioritas, dibuat oleh user berbeda, minimal 2 sudah ditinjau.

---

## 4. Kebutuhan Non-Fungsional

| Kode   | Kebutuhan                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------- |
| NFR-01 | Semua aturan izin **ditegakkan di server**. UI hanya menyembunyikan, bukan mengamankan             |
| NFR-02 | `docker compose up` dari clone bersih harus jalan, tanpa langkah manual selain copy `.env.example` |
| NFR-03 | Validasi server-side untuk **setiap** input, dengan pesan error per-field                          |
| NFR-04 | Password di-hash, tidak pernah dikembalikan lewat API, tidak pernah dicatat di log                 |
| NFR-05 | UI konsisten dengan `ui-ux-reference.png`                                                          |
| NFR-06 | Responsif: desktop, tablet, mobile (tabel bisa scroll horizontal)                                  |
| NFR-07 | Riwayat git nyata, commit bertahap, **tidak** di-squash                                            |

---

## 5. Definisi "Selesai" (Definition of Done)

- [ ] `docker compose up` dari clone bersih → aplikasi dapat diakses di browser.
- [ ] Seed ter-load otomatis; ketiga kredensial di atas bisa login.
- [ ] Matriks izin §2 terbukti berlaku saat API dipanggil langsung (curl/Postman).
- [ ] Semua halaman di referensi UI ada dan sesuai visual.
- [ ] `README.md` lengkap termasuk **AI Disclosure**.
- [ ] `.env.example` tersedia dan **tidak** ada secret nyata di repo.
- [ ] `Jenkinsfile` ada di root dan tiap stage dijelaskan di README.
- [ ] Riwayat commit > 1 dan bermakna.

---

## 6. Kebutuhan = Uji (Traceability)

Matriks izin §2 dipetakan langsung ke test suite (bonus):

| Kasus Uji                                      | Ekspektasi                                   |
| ---------------------------------------------- | -------------------------------------------- |
| Operator `GET /api/requests?scope=all`         | hanya miliknya (bukan 403 — scope diabaikan) |
| Operator `PATCH` request orang lain            | `403`                                        |
| Operator `PATCH` miliknya, status `approved`   | `403`                                        |
| Operator `POST /api/requests/:id/approve`      | `403`                                        |
| Supervisor `PATCH` request orang lain          | `403`                                        |
| Supervisor `DELETE` request                    | `403`                                        |
| Supervisor `POST .../approve` pada `submitted` | `200`                                        |
| Supervisor `POST .../approve` pada `approved`  | `409`                                        |
| Admin `DELETE` request                         | `204`                                        |
| Operator `GET /api/users`                      | `403`                                        |
| Admin nonaktifkan diri sendiri                 | `400`                                        |
| Tanpa cookie                                   | `401`                                        |
| Cookie milik user `is_active=false`            | `401`                                        |
