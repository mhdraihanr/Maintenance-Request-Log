# 03 — Data Model

Database: **PostgreSQL 16**. Skema minimal — hanya dua tabel inti. ENUM native Postgres dipakai agar nilai ilegal ditolak di level DB, bukan hanya di aplikasi.

---

## 1. Diagram Relasi

```
┌──────────────────────┐
│        users         │
├──────────────────────┤
│ id            uuid PK│
│ username      text U │
│ name          text   │
│ password_hash text   │
│ role          role_e │
│ is_active     bool   │
│ last_login_at tstz  ∅│
│ created_at    tstz   │
└──────┬───────────────┘
       │ 1
       │
       │ N  created_by      (ON DELETE RESTRICT)
       │ N  reviewed_by     (ON DELETE SET NULL)
       │
┌──────▼──────────────────────┐
│         requests            │
├─────────────────────────────┤
│ id            uuid PK       │
│ code          text U        │
│ machine_id    text          │
│ description   text          │
│ priority      priority_e    │
│ status        status_e      │
│ created_by    uuid FK → users│
│ created_at    tstz          │
│ reviewed_by   uuid FK → users ∅│
│ reviewed_at   tstz ∅        │
└─────────────────────────────┘
```

**Alasan `ON DELETE RESTRICT` pada `created_by`:** user yang pernah membuat request tidak boleh dihapus keras — cukup dinonaktifkan (`is_active = false`). Ini menjaga integritas riwayat.

**Alasan `ON DELETE SET NULL` pada `reviewed_by`:** bila akun reviewer dihapus, fakta bahwa request sudah ditinjau tetap boleh ada; identitas peninjau hilang tetapi `reviewed_at` tetap terekam. (Dalam praktik, deaktivasi lebih disukai.)

---

## 2. DDL

```sql
-- 001_init.sql

CREATE TYPE user_role     AS ENUM ('operator', 'supervisor', 'admin');
CREATE TYPE request_status AS ENUM ('submitted', 'approved', 'rejected');
CREATE TYPE request_priority AS ENUM ('low', 'medium', 'high');

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT        NOT NULL UNIQUE,
  name          TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  role          user_role   NOT NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT username_format CHECK (username ~ '^[a-z0-9._-]{3,32}$'),
  CONSTRAINT name_not_blank  CHECK (length(trim(name)) > 0)
);

CREATE TABLE requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT             NOT NULL UNIQUE,
  machine_id   TEXT             NOT NULL,
  description  TEXT             NOT NULL,
  priority     request_priority NOT NULL,
  status       request_status   NOT NULL DEFAULT 'submitted',
  created_by   UUID             NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ      NOT NULL DEFAULT now(),
  reviewed_by  UUID             REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,

  CONSTRAINT machine_not_blank CHECK (length(trim(machine_id)) BETWEEN 1 AND 64),
  CONSTRAINT desc_length       CHECK (length(description) BETWEEN 5 AND 2000),

  -- reviewed_by & reviewed_at harus keduanya null atau keduanya terisi,
  -- dan status submitted wajib belum ditinjau. Aturan ini ditegakkan di DB.
  CONSTRAINT review_consistency CHECK (
    (status = 'submitted' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR
    (status IN ('approved','rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

-- Indeks untuk daftar yang difilter & diurutkan
CREATE INDEX idx_requests_status    ON requests(status);
CREATE INDEX idx_requests_priority  ON requests(priority);
CREATE INDEX idx_requests_created_by ON requests(created_by);
CREATE INDEX idx_requests_created_at ON requests(created_at DESC);
CREATE INDEX idx_users_role         ON users(role);
```

> `CHECK review_consistency` adalah **pertahanan lapis terakhir**. Aplikasi tetap memvalidasi lebih dulu agar pesan errornya ramah. Namun bila ada bug di service, DB tetap menolak data tidak konsisten. Ini contoh otorisasi/integritas yang tidak bergantung pada kode aplikasi saja.

---

## 3. Pembuatan `code` (MR-xxx)

`code` adalah nomor urut yang terlihat manusia: `MR-001`, `MR-002`, …

**Pendekatan yang dipilih:** sequence Postgres + format di aplikasi.

```sql
CREATE SEQUENCE request_code_seq START 1;

-- di service, saat insert:
-- SELECT nextval('request_code_seq') → 42 → 'MR-' || lpad('42', 3, '0') = 'MR-042'
```

Alasan: sequence aman terhadap race condition (dua insert bersamaan tidak akan mendapat nomor sama), dan jauh lebih sederhana daripada `MAX(code)+1` yang rentan tabrakan. Saat melewati 999, `lpad` cukup memanjang jadi `MR-1000` tanpa error.

---

## 4. Pertimbangan Skala

Skema ini dirancang agar bonus pagination/search (lihat [07](07-optional-tasks-plan.md)) tidak butuh migrasi besar:

| Kebutuhan masa depan                   | Sudah siap?                                                  |
| -------------------------------------- | ------------------------------------------------------------ |
| Filter status/priority                 | ✅ ada indeks                                                |
| Urut `created_at DESC`                 | ✅ ada indeks DESC                                           |
| "Request milik saya"                   | ✅ indeks `created_by`                                       |
| Search teks `machine_id`/`description` | ⚠️ perlu `pg_trgm` + GIN bila > ribuan baris (dicatat di 07) |
| Audit trail                            | ⚠️ butuh tabel baru (dicatat di 07)                          |
| Time-series downtime                   | ⚠️ butuh TSDB terpisah (dicatat di 07)                       |

Dengan ± 5.000 baris seed (skenario bonus), query dengan indeks di atas tetap di bawah beberapa milidetik — jauh sebelum perlu partisi atau TSDB.

---

## 5. Rencana Seed

Seed idempoten: aman dijalankan berulang (mis. setiap `docker compose up`).

```
seed.ts:
  1. Jika tabel users sudah punya ≥ 1 baris → lewati (kecuali SEED_FORCE=true)
  2. Hash password dengan argon2id
  3. INSERT 3 user (satu per role)
  4. INSERT ± 8 request yang menyebar di semua status & priority
  5. Set reviewed_by/reviewed_at untuk request yang approved/rejected
```

### 5.1 Data User

| username | password        | name           | role       | is_active |
| -------- | --------------- | -------------- | ---------- | --------- |
| `bud`    | `operator123`   | Budi Santoso   | operator   | true      |
| `siti`   | `supervisor123` | Siti Nurhaliza | supervisor | true      |
| `andi`   | `admin123`      | Andi Pratama   | admin      | true      |

### 5.2 Data Request

| code   | machine_id     | priority | status    | created_by | reviewed_by |
| ------ | -------------- | -------- | --------- | ---------- | ----------- |
| MR-001 | Machine A-12   | high     | submitted | bud        | —           |
| MR-002 | Conveyor B-03  | medium   | approved  | bud        | siti        |
| MR-003 | Press C-01     | high     | rejected  | siti       | andi        |
| MR-004 | Air Compressor | medium   | approved  | bud        | siti        |
| MR-005 | Robot Arm      | low      | submitted | siti       | —           |
| MR-006 | Cooling Fan    | medium   | approved  | bud        | andi        |
| MR-007 | Packaging Line | high     | submitted | siti       | —           |
| MR-008 | Boiler         | high     | rejected  | bud        | siti        |

Sebaran ini memastikan:

- Ketiga status terwakili (3 submitted, 3 approved, 2 rejected).
- Ketiga priority terwakili.
- Ada request "milik saya" untuk `bud` dan `siti` → bisa diuji langsung lewat API.
- Ada request yang sudah ditinjau → membuktikan status terkunci bagi non-Admin.

> `created_at` seed diberi variasi waktu (mundur beberapa hari) agar tabel & chart terlihat realistis, bukan semua detik yang sama.

---

## 6. Migrasi & Versi Skema

```
api/db/migrations/
├── 001_init.sql          # tabel users, requests, enum, indeks, sequence
└── 002_audit_trail.sql   # (hanya bila bonus audit trail dikerjakan)
```

`migrate.ts` membaca folder secara berurutan, mencatat versi yang sudah dijalankan di tabel `schema_migrations (version text PK, applied_at timestamptz)`, dan melewati yang sudah ada. Sederhana, idempoten, tanpa dependensi tooling migrasi eksternal.
