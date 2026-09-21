# Dokumen Perencanaan — Maintenance Request Log (MRL)

Folder ini berisi dokumen **perencanaan dan keputusan desain** sebelum implementasi.
Semua keputusan teknis utama ada di sini agar kode tinggal mengikuti, dan agar reviewer
dapat menilai _alasan_ di balik pilihan, bukan hanya hasilnya.

> Dokumen-dokumen ini dalam Bahasa Indonesia (sesuai permintaan). `README.md` di root repo
> akan disusun dalam Bahasa Inggris karena brief dan penilaian berlangsung dalam Bahasa Inggris.

---

## Urutan Membaca

| #   | Dokumen                                          | Isi                                                            | Untuk siapa           |
| --- | ------------------------------------------------ | -------------------------------------------------------------- | --------------------- |
| 00  | [Overview](00-overview.md)                       | Masalah, tujuan, non-goals, lingkup                            | Semua — mulai di sini |
| 01  | [Requirements](01-requirements.md)               | Entitas, **matriks izin**, kebutuhan fungsional/non-fungsional | Reviewer & pengembang |
| 02  | [Architecture](02-architecture.md)               | Tumpukan teknologi, ADR, struktur repo, alur request           | Pengembang            |
| 03  | [Data Model](03-data-model.md)                   | DDL, enum, indeks, rencana seed                                | Pengembang            |
| 04  | [API Spec](04-api-spec.md)                       | Kontrak endpoint, payload, kode error, contoh uji              | Reviewer & pengembang |
| 05  | [UI / UX](05-ui-ux.md)                           | Design token, layout per halaman, komponen, aksesibilitas      | Pengembang frontend   |
| 06  | [Infrastructure](06-infrastructure.md)           | Docker, env, Jenkinsfile, riwayat git                          | DevOps / reviewer     |
| 07  | [Optional Tasks Plan](07-optional-tasks-plan.md) | Rencana bonus (sebagian belum dikerjakan)                      | Reviewer              |

---

## Kesimpulan Keputusan Penting

| Area             | Keputusan                                                                      |
| ---------------- | ------------------------------------------------------------------------------ |
| Backend          | **Hono (TypeScript)** di Node 20 — dari dua opsi (Hono / Go), ini yang dipilih |
| Frontend         | **Vue 3 + Vite + TypeScript**, Pinia, Vue Router                               |
| Database         | **PostgreSQL 16**, akses via `pg` + SQL langsung                               |
| Autentikasi      | **JWT (HS256) di httpOnly cookie**, TTL 8 jam                                  |
| Password         | **argon2id**                                                                   |
| Validasi         | **Zod**, satu skema untuk tipe + validasi                                      |
| Otorisasi        | **Middleware berlapis + policy per-resource terpusat**                         |
| Pintu masuk      | **nginx** menyajikan SPA + proxy `/api/*` → tanpa CORS                         |
| Bonus dikerjakan | **Audit trail** + **Pagination & server-side search**                          |
| Alur kerja       | Dokumen dulu → kode mengikuti; commit bertahap, tidak di-squash                |

---

## Prinsip yang Dipegang

1. **Otorisasi adalah milik server.** UI hanya menyembunyikan, API yang memutuskan.
2. **Kualitas di atas kuantitas.** Fitur sedikit tapi rapi > banyak tapi berantakan.
3. **Alasan tertulis.** Setiap pilihan non-sepele punya alasan yang bisa dipertanggungjawabkan.
4. **Integritas data dijaga berlapis.** Validasi aplikasi + constraint database.
5. **Konsisten dengan referensi visual.** Warna, tipografi, dan komponen mengikuti `ui-ux-reference.png`.

---

## Catatan Penggunaan Skill AI

Folder `docs/` ini disusun dengan bantuan skill (`ui-ux-pro-max`, `design-system`, `antislop-ui`,
`antislop-layoutmobile`). Satu rekomendasi skill **ditolak secara sadar**: skill mengusulkan
_Dark Mode OLED + hijau + tipografi serif_, yang bertentangan dengan brand Hirose. Brand identity
dari brief dianggap otoritas tertinggi. Detailnya akan ada di bagian **AI Disclosure** pada README
root — brief secara eksplisit meminta pengungkapan ini.
