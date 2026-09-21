# 00 — Overview

**Proyek:** Maintenance Request Log (MRL)
**Klien:** PT. Hirose Electric Indonesia (internal factory tool)
**Konteks:** Technical Take-Home Test — Full Stack Engineer
**Deadline:** 24 September 2026, 10:00 WIB

---

## 1. Satu Kalimat

Aplikasi web internal untuk mencatat, menyetujui, dan mengelola **permintaan perbaikan mesin** di lantai produksi, dengan kontrol akses berbasis peran yang **ditegakkan di server**.

---

## 2. Masalah yang Diselesaikan

| #   | Masalah                                              | Dampak                                        |
| --- | ---------------------------------------------------- | --------------------------------------------- |
| 1   | Laporan kerusakan mesin dilakukan lisan / lewat chat | Tidak ada jejak, mudah hilang                 |
| 2   | Tidak jelas siapa yang sudah meninjau laporan        | Perbaikan tertunda tanpa ada yang tahu        |
| 3   | Tidak ada prioritas terukur                          | Mesin kritis menunggu di belakang yang ringan |
| 4   | Manajemen tidak punya gambaran status keseluruhan    | Sulit mengambil keputusan operasional         |

---

## 3. Alur Bisnis Inti

```
Operator menemukan masalah mesin
        │
        ▼
   Buat Request  ──────► status: SUBMITTED
        │
        ▼
Supervisor / Admin meninjau
        │
        ├──► Approve ──► status: APPROVED
        └──► Reject  ──► status: REJECTED
```

Aturan penting: Operator/Supervisor hanya boleh mengedit request miliknya **selama status masih `SUBMITTED`**. Setelah ditinjau, request terkunci bagi non-Admin.

---

## 4. Pengguna & Peran

| Peran          | Siapa                   | Inti Tanggung Jawab           |
| -------------- | ----------------------- | ----------------------------- |
| **Operator**   | Teknisi lantai produksi | Melaporkan kerusakan mesin    |
| **Supervisor** | Pengawas shift/line     | Meninjau & menyetujui laporan |
| **Admin**      | IT / Maintenance admin  | Mengelola user & seluruh data |

Semua peran bisa membuat request. Perbedaan utama ada pada **visibilitas** dan **hak meninjau/mengubah**.

---

## 5. Tujuan (Goals)

- ✅ Satu sumber kebenaran untuk seluruh permintaan perbaikan mesin.
- ✅ Otorisasi konsisten: aturan yang sama di UI **dan** API.
- ✅ Dapat dijalankan dengan satu perintah: `docker compose up`.
- ✅ Kode yang rapi dan dapat diuji, bukan kumpulan fitur.
- ✅ Jejak waktu jelas: siapa membuat, kapan, siapa meninjau, kapan.

## 6. Non-Tujuan (Non-Goals)

Sengaja **tidak** dikerjakan agar hasil tetap fokus dan rapi:

- ❌ Manajemen inventaris/spare-part.
- ❌ Penjadwalan shift atau kalender produksi.
- ❌ Notifikasi email / WhatsApp / push.
- ❌ Upload attachment (dropzone di referensi UI hanya placeholder — dicatat di [07](07-optional-tasks-plan.md)).
- ❌ Aplikasi mobile native.
- ❌ Integrasi langsung dengan PLC / SCADA mesin (kecuali bonus MQTT, hanya planned).
- ❌ Multi-tenant / multi-pabrik.

**Prinsip pengambilan keputusan:** _"A smaller, well-built submission scores higher than a feature-complete but messy one."_ → kualitas di atas kuantitas.

---

## 7. Ruang Lingkup Fitur (Ringkas)

**Wajib (akan diimplementasikan):**

1. Login & logout (JWT di httpOnly cookie).
2. CRUD Request + list view dengan filter status & priority.
3. Server-side validation di semua input.
4. Password di-hash.
5. Enforce matriks izin di server.
6. Seed data (1 user per peran + beberapa request).
7. Docker Compose satu perintah.
8. Jenkinsfile + penjelasan stage di README.

**Bonus (hanya _planning_ di [07](07-optional-tasks-plan.md)):**

- Audit trail (riwayat perubahan status) — _UI timeline sudah ada di referensi_.
- Pagination + server-side search.
- Health check & structured logging.
- OpenAPI/Swagger.
- Automated tests (matriks izin).
- Multi-stage Dockerfile.
- Time-series (downtime) & MQTT ingest.

---

## 8. Indeks Dokumen

| Dok                                                    | Isi                                               |
| ------------------------------------------------------ | ------------------------------------------------- |
| [00-overview.md](00-overview.md)                       | Dokumen ini — ringkasan & lingkup                 |
| [01-requirements.md](01-requirements.md)               | Kebutuhan fungsional + matriks izin lengkap       |
| [02-architecture.md](02-architecture.md)               | Arsitektur, tumpukan teknologi, keputusan kunci   |
| [03-data-model.md](03-data-model.md)                   | Skema database, enum, rencana seed                |
| [04-api-spec.md](04-api-spec.md)                       | Kontrak endpoint, payload, aturan validasi        |
| [05-ui-ux.md](05-ui-ux.md)                             | Design token, layout per halaman, daftar komponen |
| [06-infrastructure.md](06-infrastructure.md)           | Docker, env, Jenkinsfile, langkah run             |
| [07-optional-tasks-plan.md](07-optional-tasks-plan.md) | Rencana bonus (belum dikerjakan)                  |

> Catatan: `README.md` di root repo akan disusun dari dokumen-dokumen ini agar tidak ada informasi yang berbeda antara dokumen dan README.
