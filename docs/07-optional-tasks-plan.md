# 07 — Optional Tasks — RENCANA (belum dikerjakan)

Brief: _"Pick at most one or two that interest you, and note in your README which you did."_

**Keputusan:** dari daftar bonus, yang akan **dikerjakan** adalah **dua** berikut (paling relevan dan paling terlihat nilainya tanpa menambah kompleksitas arsitektur):

| #   | Bonus                                      | Status                                                                  |
| --- | ------------------------------------------ | ----------------------------------------------------------------------- |
| 1   | **Audit trail** (riwayat perubahan status) | 🔷 Akan dikerjakan — UI timeline-nya sudah ada di referensi             |
| 2   | **Pagination + server-side search**        | 🔷 Akan dikerjakan — sudah tampak di referensi (bar hasil + pagination) |

Sisanya hanya **direncanakan** di bawah (bagian §5–§9), agar jelas ada pemikiran, tanpa menambah risiko ke hasil akhir. Prinsip dari brief: _"A smaller, well-built submission scores higher than a feature-complete but messy one."_

---

## 1. Audit Trail (akan dikerjakan)

### 1.1 Tujuan

Merekam **setiap** perubahan status dengan pelaku + waktu, lalu menampilkannya sebagai timeline di halaman detail request.

### 1.2 Skema

```sql
-- migrations/002_audit_trail.sql
CREATE TYPE audit_action AS ENUM ('created', 'updated', 'approved', 'rejected', 'deleted');

CREATE TABLE request_audit (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID         NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  action      audit_action NOT NULL,
  from_status request_status,        -- null untuk 'created'
  to_status   request_status,        -- null untuk 'updated'/'deleted'
  actor_id    UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_name  TEXT         NOT NULL, -- snapshot nama saat aksi (tahan rename user)
  note        TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_request ON request_audit(request_id, created_at);
```

**Keputusan:** `ON DELETE CASCADE` di sini (bukan `RESTRICT`) — bila request dihapus Admin, riwayatnya ikut terhapus wajar. `actor_name` disimpan sebagai snapshot agar riwayat tetap terbaca meski user mengganti nama.

### 1.3 Penulisan

- Ditulis di **dalam transaksi** yang sama dengan perubahan `requests` → atomic. Bila update request gagal, audit tidak ditulis.
- Helper: `recordAudit(client, { requestId, action, fromStatus, toStatus, actor, note })`.

### 1.4 API

`GET /api/requests/:id/history` — otorisasi sama dengan `GET /api/requests/:id`.

```json
{
  "data": [
    {
      "action": "submitted",
      "fromStatus": null,
      "toStatus": "submitted",
      "actor": { "id": "…", "name": "Budi Santoso" },
      "note": null,
      "createdAt": "2026-09-24T01:32:00.000Z"
    },
    {
      "action": "approved",
      "fromStatus": "submitted",
      "toStatus": "approved",
      "actor": { "id": "…", "name": "Siti Nurhaliza" },
      "note": "Diverifikasi di lapangan",
      "createdAt": "2026-09-24T03:10:00.000Z"
    }
  ]
}
```

### 1.5 UI

Card **History** di halaman detail menjadi timeline dari endpoint ini. Titik pertama selalu "created"; setiap approve/reject menambah titik baru dengan ikon + warna status.

### 1.6 Uji

- Approve satu request → `history` bertambah 1 baris dengan `actor` benar.
- Update gagal (403) → `history` **tidak** bertambah.
- Hapus request → baris audit ikut terhapus (`CASCADE`).

---

## 2. Pagination + Server-side Search (akan dikerjakan)

### 2.1 Pagination

Kontrak sudah dicadangkan di [04-api-spec](04-api-spec.md#3-requests): `?page=&limit=` → respons menyertakan `meta { page, limit, total, totalPages }`.

**Keputusan:** memakai **LIMIT/OFFSET**, bukan keyset pagination.
Alasan: kedalaman halaman di aplikasi internal ini kecil (puluhan halaman), dan `OFFSET` jauh lebih mudah dibaca. Keyset (berbasis `created_at` + `id`) dicatat di §5 sebagai opsi bila data tumbuh besar.

Query:

```sql
SELECT ... FROM requests
WHERE (status = $1 OR $1 IS NULL)
  AND (priority = $2 OR $2 IS NULL)
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;
-- plus: SELECT count(*) FROM requests WHERE <filter sama>
```

### 2.2 Server-side Search

- Parameter `?search=`.
- Pencocokan `machine_id ILIKE '%'||$1||'%'` OR `description ILIKE '%'||$1||'%'`.

**Optimasi (penting untuk skenario "ribuan baris"):**

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_requests_machine_trgm ON requests USING gin (machine_id gin_trgm_ops);
CREATE INDEX idx_requests_desc_trgm    ON requests USING gin (description gin_trgm_ops);
```

`pg_trgm` + GIN membuat `ILIKE '%...%'` tetap terindeks, bukan full scan. Tanpa ini, pencarian `LIKE` berawalan wildcard tidak memakai indeks B-tree biasa — inilah justifikasi teknis yang diminta brief ("working sensibly with a few thousand seeded rows").

### 2.3 Batas & Pengamanan

- `limit` dibatasi maksimum **100**; nilai lebih besar di-clamp, bukan ditolak (ramah klien).
- `page` minimal 1.
- `sort` hanya menerima kolom **whitelist** (`created_at`, `priority`, `status`) untuk mencegah SQL injection lewat nama kolom.
- Query count dan query data dijalankan paralel (`Promise.all`) untuk menekan latensi.

### 2.4 Uji

- Seed 5.000 baris → halaman terakhir dan `totalPages` benar.
- `?search=boiler` → hanya baris cocok.
- Ukur waktu dengan `EXPLAIN ANALYZE` untuk membuktikan indeks GIN terpakai (bukti ditulis di README).

---

## 3. Helper & Skrip Terkait

| Skrip                   | Fungsi                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `api/db/seed-large.ts`  | Seed opsional ± 5.000 request untuk menguji pagination/search (`npm run seed:large`) |
| `scripts/smoke-test.sh` | Verifikasi cepat: tunggu `/health`, login 3 peran, cek 1 tolakan izin                |

---

## 4. Yang Dibutuhkan untuk Menyelesaikan Bonus Ini

- [ ] Migrasi `002_audit_trail.sql`
- [ ] Helper `recordAudit` + pemanggilan di service approve/reject/update/delete
- [ ] Endpoint `GET /api/requests/:id/history`
- [ ] Komponen `HistoryTimeline.vue` di halaman detail
- [ ] Migrasi `003_search_index.sql` (`pg_trgm` + GIN)
- [ ] Parameter `page`/`limit`/`search`/`sort` di `GET /api/requests` + `meta`
- [ ] Komponen `Pagination.vue` + debounce di `SearchInput.vue`
- [ ] Uji: matriks izin, audit, pagination
- [ ] Catat di README bagian "Optional Tasks Attempted"

---

## 5. Blocker / Risiko yang Dicatat

| Risiko                                     | Mitigasi                                                |
| ------------------------------------------ | ------------------------------------------------------- |
| `OFFSET` lambat di halaman sangat dalam    | Ganti ke keyset pagination; keputusan dicatat di README |
| Search tetap lambat bila ekspresi kompleks | Pertimbangkan kolom `tsvector` + GIN sebagai alternatif |
| Timeline jadi panjang                      | Batasi 50 entri terakhir atau tambah "load more"        |

---

## 6. Health Check & Structured Logging (RENCANA — tidak dikerjakan)

Ide yang sudah setengah jalan dan mudah ditambahkan:

- Endpoint `/health` sudah direncanakan di [04 §5](04-api-spec.md) dan dipakai `healthcheck` Compose — **ini akan tetap diimplementasikan** karena dibutuhkan Compose, walau bonusnya sendiri tidak diklaim.
- Structured logging JSON per-request dengan `requestId`, `method`, `path`, `status`, `durationMs`, `userId`. Sudah dipakai sebagai middleware di [02](02-architecture.md).
- Bila diklaim: tambahkan `pino` + redaksi field sensitif, lalu dokumentasikan di README.

---

## 7. OpenAPI / Swagger (RENCANA — tidak dikerjakan)

Opsi paling rapi: menulis skema **Zod → `zod-to-openapi`**, lalu menyajikan UI Scalar di `/docs`.

Alasan **tidak** dikerjakan: dokumen [`04-api-spec.md`](04-api-spec.md) sudah menjadi spesifikasi API yang lengkap dan dapat dibaca; menambah generator berarti menjaga dua sumber kebenaran (skema Zod & spec tergenerate). Bila dikerjakan, pendekatannya harus **satu sumber** (generate dari Zod), bukan menulis dua kali.

---

## 8. Automated Tests (RENCANA — kemungkinan dikerjakan sebagian)

Sudah dipetakan lengkap di [01 §6](01-requirements.md). Prioritas:

1. **Matriks izin** (paling penting — brief secara eksplisit menyebutnya).
2. Service request (transisi status, konsistensi `reviewed_by`).
3. Validasi Zod (payload buruk → 400).

Rencana runner: **Vitest** untuk keduanya, dengan DB test terpisah (schema sendiri, di-truncate tiap suite). Untuk endpoint, uji lewat `app.request()` milik Hono tanpa perlu membuka port.

---

## 9. Multi-stage Dockerfile (RENCANA — kemungkinan dikerjakan)

Sudah dirancang di [06 §3.2](06-infrastructure.md). Yang belum: **mengukur size sebenarnya** dengan `docker images` dan menulis before/after di README. Ini murah dikerjakan dan memberi nilai jelas, jadi statusnya "kemungkinan".

---

## 10. Time-Series (downtime chart) (RENCANA — tidak dikerjakan)

Catatan teknis bila nanti diminati:

- **TimescaleDB** di atas Postgres yang sudah ada (hemat: satu mesin DB, ekstensi `timescaledb`).
- Atau **InfluxDB** service terpisah (isolasi lebih bersih, satu container tambahan).
- Tabel `machine_metrics(time, machine_id, request_id, downtime_minutes)`.
- Endpoint `GET /api/metrics/downtime?machineId=&from=&to=` → agregasi harian.
- Chart di dashboard (Vue) — pakai SVG/CSS sederhana, bukan library baru, agar tidak menambah bobot.

Alasan **tidak** dikerjakan: menambah satu layanan stateful baru memperbesar permukaan Compose & CI, sementara brief menekankan kualitas di atas kuantitas.

---

## 11. MQTT Ingest (RENCANA — tidak dikerjakan)

Catatan teknis bila nanti diminati:

- Broker **Mosquitto** (container) + skrip publisher `scripts/mock-machine.js`.
- Topik `factory/{machine_id}/alert` → payload `{ machine_id, description, priority }`.
- Subscriber di `api` membuat request otomatis dengan `created_by` = akun **service** khusus (mis. `system-machine`) yang perannya `operator`, sehingga tetap lewat jalur izin yang sama — **tidak** ada bypass otorisasi.
- Perlu idempotency (kunci `machine_id + time bucket`) agar satu kerusakan tidak membuat lonjakan request.

Alasan **tidak** dikerjakan: nilai demonstasinya tinggi tetapi biayanya (broker + subscriber lifecycle + idempotency) paling besar dari semua opsi, dan sulit dijelaskan singkat di interview.

---

## 12. Ringkasan Keputusan Bonus

| Bonus                  | Keputusan                  | Alasan singkat                                                 |
| ---------------------- | -------------------------- | -------------------------------------------------------------- |
| Audit trail            | ✅ dikerjakan              | UI timeline sudah ada di referensi; nilai tinggi, biaya rendah |
| Pagination + search    | ✅ dikerjakan              | Sudah tampak di referensi; ≥1 filter memang wajib              |
| Health check & logging | 🔶 sebagian (health)       | Health dibutuhkan Compose walau bonus tidak diklaim            |
| Automated tests        | 🔶 sebagian (matriks izin) | Brief menyebutnya eksplisit                                    |
| Multi-stage Dockerfile | 🔶 sebagian                | Desain siap; tinggal ukur & catat size                         |
| OpenAPI                | ❌ planned saja            | Sudah terwakili dokumen ini; hindari dua sumber kebenaran      |
| Time-series            | ❌ planned saja            | Menambah layanan stateful baru                                 |
| MQTT                   | ❌ planned saja            | Biaya & risiko lifecycle tertinggi                             |

> Setelah implementasi, README akan mencantumkan bagian **"Optional Tasks Attempted"** yang mencerminkan tabel ini secara jujur — termasuk yang **tidak** dikerjakan.
