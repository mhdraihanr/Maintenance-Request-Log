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

CREATE SEQUENCE request_code_seq START 1;
