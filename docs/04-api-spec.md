# 04 — API Spec

Base URL: `/api`. Semua respons JSON.
Autentikasi: cookie `auth=<jwt>` (httpOnly). Frontend memakai `credentials: 'include'`.

> **Untuk reviewer:** seluruh endpoint di bawah **wajib** berperilaku sesuai [matriks izin](01-requirements.md). Semua tabel di dokumen ini sudah mencantumkan "siapa boleh" — itu kontrak yang diuji langsung.

---

## 1. Format Respons

**Sukses**

```json
{ "data": { "...": "..." } }
```

**Error**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input tidak valid",
    "fields": { "machine_id": "Wajib diisi" }
  }
}
```

### Kode Error

| HTTP | `code`                | Kapan                                              |
| ---- | --------------------- | -------------------------------------------------- |
| 400  | `VALIDATION_ERROR`    | Body/query gagal Zod                               |
| 400  | `BAD_REQUEST`         | Aturan bisnis (mis. nonaktifkan diri sendiri)      |
| 401  | `UNAUTHENTICATED`     | Tidak ada cookie / JWT invalid / kedaluwarsa       |
| 401  | `ACCOUNT_INACTIVE`    | JWT sah tapi `is_active = false`                   |
| 401  | `INVALID_CREDENTIALS` | Login gagal                                        |
| 403  | `FORBIDDEN`           | Login sah, tidak punya izin atas aksi/resource     |
| 404  | `NOT_FOUND`           | Resource tidak ada (atau tidak terlihat oleh user) |
| 409  | `ALREADY_REVIEWED`    | Meninjau request yang sudah ditinjau               |
| 429  | `RATE_LIMITED`        | Terlalu banyak percobaan login                     |
| 500  | `INTERNAL_ERROR`      | Tak terduga (detail tidak dibocorkan ke klien)     |

> **Catatan keamanan:** `404` dan `403` sengaja dibedakan dengan hati-hati. Untuk resource yang **tidak boleh dilihat** user (mis. Operator mengakses request orang lain), API mengembalikan **`403`** bukan `404` — karena memang login dan request-nya ada. Ini membuat pengujian izin jelas: reviewer melihat perbedaan antara "tidak ada" dan "tidak boleh".

---

## 2. Auth

### `POST /api/auth/login`

Siapa boleh: publik (belum login).

**Body**

```json
{ "username": "bud", "password": "operator123" }
```

**Validasi:** `username` 3–32 char; `password` 1–128 char. Keduanya wajib.

**200**

```json
{
  "data": {
    "id": "...",
    "username": "bud",
    "name": "Budi Santoso",
    "role": "operator"
  }
}
```

`Set-Cookie: auth=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800`

**401** `INVALID_CREDENTIALS` — pesan selalu "Username atau password salah" (jangan bedakan keduanya).
**401** `ACCOUNT_INACTIVE` — kredensial benar tapi akun dinonaktifkan.
**429** `RATE_LIMITED` — lebih dari 5 kegagalan dalam 15 menit.

Efek samping: `users.last_login_at = now()`.

---

### `POST /api/auth/logout`

Siapa boleh: semua yang login.

**204** + `Set-Cookie: auth=; Max-Age=0`.

---

### `GET /api/auth/me`

Siapa boleh: semua yang login. Dipakai frontend saat bootstrap untuk menentukan menu yang tampil.

**200**

```json
{
  "data": {
    "id": "...",
    "username": "bud",
    "name": "Budi Santoso",
    "role": "operator"
  }
}
```

**401** bila cookie tidak ada/invalid/akun nonaktif.

---

## 3. Requests

### `GET /api/requests`

Siapa boleh: semua yang login. **Cakupan hasil bergantung peran** — ini bukan parameter yang dikirim klien, melainkan dipaksa server.

| Peran      | Hasil                                           |
| ---------- | ----------------------------------------------- |
| Operator   | **Hanya** request dengan `created_by = user.id` |
| Supervisor | Semua request                                   |
| Admin      | Semua request                                   |

> Parameter `scope=all` dari klien **diabaikan** untuk Operator. Tidak ada cara bagi Operator melihat request orang lain lewat endpoint ini.

**Query params**

| Param      | Nilai                                   | Keterangan                                    |
| ---------- | --------------------------------------- | --------------------------------------------- |
| `status`   | `submitted` \| `approved` \| `rejected` | Filter (FR-02.3)                              |
| `priority` | `low` \| `medium` \| `high`             | Filter (FR-02.3)                              |
| `search`   | string                                  | Bonus — cocokkan `machine_id` / `description` |
| `page`     | int ≥ 1                                 | Bonus (default 1)                             |
| `limit`    | int 1–100                               | Bonus (default 20)                            |
| `sort`     | `created_at` \| `priority` \| `status`  | Bonus (default `created_at`)                  |
| `order`    | `asc` \| `desc`                         | Bonus (default `desc`)                        |

**200**

```json
{
  "data": [
    {
      "id": "…",
      "code": "MR-001",
      "machineId": "Machine A-12",
      "description": "Overheating issue on motor",
      "priority": "high",
      "status": "submitted",
      "createdBy": { "id": "…", "name": "Budi Santoso" },
      "createdAt": "2026-09-24T01:32:00.000Z",
      "reviewedBy": { "id": "…", "name": "Siti Nurhaliza" },
      "reviewedAt": "2026-09-24T02:10:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 24, "totalPages": 2 }
}
```

`meta` disertakan agar pagination (bonus) tidak mengubah bentuk respons.

`reviewedBy` berbentuk `{ id, name }` seperti `createdBy`, dan bernilai `null` selama request
belum ditinjau. Nama peninjau diambil dengan `LEFT JOIN users` pada kolom `reviewed_by`.

---

### `POST /api/requests`

Siapa boleh: semua yang login (Operator, Supervisor, Admin).

**Body**

```json
{
  "machine_id": "Machine A-12",
  "description": "Overheating issue on motor",
  "priority": "high"
}
```

**Validasi**
| Field | Aturan |
|-------|--------|
| `machine_id` | wajib, trim, 1–64 char |
| `description` | wajib, trim, 5–2000 char |
| `priority` | wajib, salah satu enum |

**Field yang diabaikan bila dikirim klien:** `id`, `code`, `status`, `created_by`, `created_at`, `reviewed_by`, `reviewed_at`. Zod menggunakan `.strict()` sehingga field tak dikenal → `400`, bukan diam-diam diterima.

**201**

```json
{ "data": { "id": "…", "code": "MR-009", "status": "submitted", "...": "..." } }
```

`created_by` **selalu** dari sesi, `status` selalu `submitted`, `code` dari sequence.

---

### `GET /api/requests/:id`

Siapa boleh: Operator hanya bila `created_by = user.id`; Supervisor & Admin bebas.

**200** objek request penuh.
**403** bila Operator meminta request yang bukan miliknya.
**404** bila `id` tidak ada (atau bukan UUID valid).

---

### `PATCH /api/requests/:id`

Siapa boleh: sesuai matriks.

| Peran      | Syarat                                                |
| ---------- | ----------------------------------------------------- |
| Operator   | `created_by = user.id` **dan** `status = 'submitted'` |
| Supervisor | `created_by = user.id` **dan** `status = 'submitted'` |
| Admin      | tanpa syarat                                          |

**Body** (parsial, minimal satu field)

```json
{ "machine_id": "Machine A-13", "description": "...", "priority": "medium" }
```

**Aturan:** `status`, `created_by`, `created_at`, `reviewed_by`, `reviewed_at` **tidak dapat** diubah di sini (FR-02.9). Mengirimnya → `400` (karena `.strict()`).

**200** objek terbaru.
**403** bila melanggar tabel di atas — termasuk kasus "sudah ditinjau".
**404** bila tidak ada.

---

### `POST /api/requests/:id/approve`

### `POST /api/requests/:id/reject`

Siapa boleh: Supervisor & Admin saja. Operator → `403`.

**Body** (opsional)

```json
{ "note": "Sudah diverifikasi di lapangan" }
```

**Aturan:**

- Hanya berlaku saat `status = 'submitted'`.
- Menyetel `status`, `reviewed_by = user.id`, `reviewed_at = now()` secara atomik dalam satu `UPDATE`.
- Jika sudah `approved`/`rejected` → `409 ALREADY_REVIEWED` (mengecualikan Admin, lihat [01 §2.1](01-requirements.md)).

**200** objek terbaru dengan `reviewedBy`/`reviewedAt` terisi.

> **Endpoint terpisah, bukan `PATCH status`.** Sengaja dipisah agar aksi peninjauan punya otorisasi, aturan transisi status, dan efek samping (`reviewed_by`/`reviewed_at`) yang eksplisit — dan agar tidak bisa disalahgunakan lewat PATCH biasa.

---

### `DELETE /api/requests/:id`

Siapa boleh: **Admin saja.** Operator & Supervisor → `403`.

**204** tanpa body.
**404** bila tidak ada.

---

## 4. Users (Admin saja)

Seluruh endpoint di bagian ini: **hanya `role = 'admin'`**. Semua peran lain → `403`, tanpa pengecualian.

### `GET /api/users`

Query: `search` (username/name), `role`, `is_active`, `page`, `limit`.

**200**

```json
{
  "data": [
    {
      "id": "…",
      "username": "bud",
      "name": "Budi Santoso",
      "role": "operator",
      "isActive": true,
      "lastLoginAt": "2026-09-24T01:32:00.000Z",
      "createdAt": "2026-09-20T00:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

**`password_hash` tidak pernah disertakan dalam respons apa pun.**

### `POST /api/users`

**Body**

```json
{
  "username": "dika",
  "name": "Dika Setiawan",
  "password": "rahasia123",
  "role": "operator"
}
```

**Validasi**
| Field | Aturan |
|-------|--------|
| `username` | wajib, unik, `^[a-z0-9._-]{3,32}$` |
| `name` | wajib, 1–64 char |
| `password` | wajib, min 8 char |
| `role` | wajib, salah satu enum |

**201** objek user (tanpa hash). **409** bila username sudah dipakai.

### `PATCH /api/users/:id`

**Body:** `name`, `role`, `password` (opsional — bila ada, di-hash ulang), `is_active`.

**Aturan:** menonaktifkan diri sendiri → `400 BAD_REQUEST`. Menonaktifkan admin aktif terakhir → `400`.

**200** objek user.

### `DELETE /api/users/:id`

**Soft delete** — set `is_active = false`. Tidak ada penghapusan baris keras.

Alasan: `requests.created_by` memakai `ON DELETE RESTRICT`; menghapus user akan memutus riwayat. Deaktivasi memenuhi kebutuhan bisnis ("cabut akses") tanpa merusak jejak.

**204**.

---

## 5. Health

### `GET /health`

Siapa boleh: publik (untuk liveness/readiness probe Compose).
**200** `{ "status": "ok", "db": "up", "uptime": 123.4 }`
**503** bila koneksi DB gagal.

---

## 6. Ringkasan Endpoint

| Method | Path                        |        Operator         |       Supervisor        | Admin  |
| ------ | --------------------------- | :---------------------: | :---------------------: | :----: |
| POST   | `/api/auth/login`           |         publik          |         publik          | publik |
| POST   | `/api/auth/logout`          |           ✅            |           ✅            |   ✅   |
| GET    | `/api/auth/me`              |           ✅            |           ✅            |   ✅   |
| GET    | `/api/requests`             |        miliknya         |          semua          | semua  |
| POST   | `/api/requests`             |           ✅            |           ✅            |   ✅   |
| GET    | `/api/requests/:id`         |        miliknya         |           ✅            |   ✅   |
| PATCH  | `/api/requests/:id`         | ⚠️ miliknya + submitted | ⚠️ miliknya + submitted |   ✅   |
| POST   | `/api/requests/:id/approve` |           ❌            |           ✅            |   ✅   |
| POST   | `/api/requests/:id/reject`  |           ❌            |           ✅            |   ✅   |
| DELETE | `/api/requests/:id`         |           ❌            |           ❌            |   ✅   |
| GET    | `/api/users`                |           ❌            |           ❌            |   ✅   |
| POST   | `/api/users`                |           ❌            |           ❌            |   ✅   |
| PATCH  | `/api/users/:id`            |           ❌            |           ❌            |   ✅   |
| DELETE | `/api/users/:id`            |           ❌            |           ❌            |   ✅   |

---

## 7. Contoh Uji Cepat (untuk reviewer)

```bash
# 1. Login sebagai Operator
curl -c cookies.txt -X POST localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"bud","password":"operator123"}'

# 2. Operator hanya melihat request miliknya (scope=all diabaikan)
curl -b cookies.txt 'localhost:3000/api/requests?scope=all'

# 3. Operator mencoba approve → harus 403
curl -b cookies.txt -X POST localhost:3000/api/requests/<id>/approve

# 4. Operator mencoba akses daftar user → harus 403
curl -b cookies.txt localhost:3000/api/users

# 5. Login sebagai Admin, lalu delete → harus 204
curl -c admin.txt -X POST localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"andi","password":"admin123"}'
curl -b admin.txt -X DELETE localhost:3000/api/requests/<id>
```
