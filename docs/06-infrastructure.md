# 06 — Infrastructure

Target utama: **`docker compose up` dari clone bersih harus menjalankan seluruh aplikasi**, tanpa langkah manual selain menyalin `.env.example`.

---

## 1. Topologi Compose

```
docker compose up
        │
        ├── service: db      (postgres:16-alpine)   volume: pgdata
        ├── service: api     (build ./api)          depends_on: db (healthy)
        └── service: web     (build ./web, nginx)   depends_on: api
                                     │
                     nginx: serve SPA + proxy /api/* → api:3000
                                     │
                              http://localhost:8080   ← satu pintu masuk
```

Keputusan: **web/nginx sebagai satu-satunya pintu masuk.** SPA dan API berada di origin yang sama sehingga:

- Tidak ada CORS.
- Cookie `SameSite=Lax` langsung bekerja.
- Satu URL untuk reviewer: `http://localhost:8080`.

---

## 2. docker-compose.yml (rencana)

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  api:
    build: ./api
    environment:
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      JWT_SECRET: ${JWT_SECRET}
      JWT_TTL_HOURS: ${JWT_TTL_HOURS:-8}
      NODE_ENV: production
      PORT: 3000
    depends_on:
      db:
        condition: service_healthy
    # entrypoint: migrate → seed → serve
    # (migrasi & seed idempoten, aman dijalankan setiap start)
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
        ]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  web:
    build: ./web
    ports:
      - "${WEB_PORT:-8080}:80"
    depends_on:
      - api
    restart: unless-stopped

volumes:
  pgdata:
```

**Tidak ada langkah manual:** `api` menjalankan migrasi + seed saat start. Karena `db` punya healthcheck dan `api` menunggu `service_healthy`, tidak ada race condition "database belum siap".

---

## 3. Dockerfile

### 3.1 API

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

RUN npm run build            # TypeScript → dist/

ENV NODE_ENV=production
EXPOSE 3000

# migrate + seed idempoten, lalu jalankan server
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/db/seed.js && node dist/index.js"]
```

### 3.2 Web — multi-stage (bonus: ukuran before/after)

```dockerfile
# ---- stage 1: build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build            # Vite → dist/

# ---- stage 2: serve ----
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

`nginx.conf` menangani dua hal:

```nginx
location /api/ { proxy_pass http://api:3000; }   # proxy ke service api
location /     { try_files $uri /index.html; }   # SPA fallback
```

**Rencana pengukuran size (diisi saat implementasi, lalu dicatat di README):**

| Tahap                                  | Perkiraan |
| -------------------------------------- | --------- |
| Single-stage (node + devDeps + source) | ~1.1 GB   |
| Multi-stage (nginx + dist saja)        | ~55 MB    |

Angka final akan diukur dengan `docker images` dan ditulis di README (ini bagian dari bonus "Multi-stage Dockerfile", dicatat sebagai planned di [07](07-optional-tasks-plan.md)).

---

## 4. Environment Variables

`.env.example` (di-commit; `.env` di-`.gitignore`):

```dotenv
# ---- Database ----
POSTGRES_USER=mrl
POSTGRES_PASSWORD=change_me_in_local_env
POSTGRES_DB=maintenance_request_log

# ---- API ----
# WAJIB diganti. Minimal 32 karakter acak.
# Hasilkan dengan: openssl rand -hex 32
JWT_SECRET=change_me_to_a_long_random_string_at_least_32_chars
JWT_TTL_HOURS=8
PORT=3000

# ---- Web ----
WEB_PORT=8080
```

### `DATABASE_URL` — dua varian

Nilai `DATABASE_URL` **berbeda** antara menjalankan API langsung dan lewat Docker Compose,
karena nama host-nya berbeda:

| Cara jalan                | Nilai                                                       | Kenapa                         |
| ------------------------- | ----------------------------------------------------------- | ------------------------------ |
| Dev lokal (`npm run dev`) | `postgres://mrl:...@localhost:5432/maintenance_request_log` | DB diakses lewat port ke host  |
| Di dalam Docker Compose   | `postgres://mrl:...@db:5432/maintenance_request_log`        | `db` = nama service di network |

Di `docker-compose.yml`, `DATABASE_URL` **di-set oleh Compose** (lihat §2), jadi nilai di `.env`
tidak berpengaruh saat berjalan di dalam container. Untuk dev lokal, simpan varian `localhost`
di `.env`; varian `db` boleh ditulis sebagai komentar agar mudah ditukar.

> `api/src/env.ts` hanya mewajibkan `DATABASE_URL` terisi (minimal 1 karakter) — tidak memeriksa
> host-nya. Kesalahan host akan muncul sebagai kegagalan koneksi saat `db:ping` atau boot.

**Aturan secret**

- `.env` **tidak** di-commit (ada di `.gitignore`).
- `.env.example` hanya berisi placeholder, tidak ada secret nyata.
- `api/src/env.ts` memvalidasi env dengan Zod saat boot dan **menolak start** bila `JWT_SECRET` kosong/terlalu pendek — agar deployment tidak pernah berjalan dengan secret lemah secara diam-diam.

---

## 5. Langkah Menjalankan (untuk README)

```bash
git clone <repo-url>
cd maintenance-request-log
cp .env.example .env          # satu-satunya langkah manual
docker compose up --build
```

Buka **http://localhost:8080** → login dengan kredensial seed:

| Username | Password        | Peran      |
| -------- | --------------- | ---------- |
| `bud`    | `operator123`   | Operator   |
| `siti`   | `supervisor123` | Supervisor |
| `andi`   | `admin123`      | Admin      |

> Akan diuji sendiri di direktori baru sebelum submission, sesuai instruksi brief.

---

## 6. Jenkinsfile

Tidak dijalankan terhadap Jenkins server nyata — brief menyatakan akan **dibaca** dan ditanyakan. Karena itu setiap stage diberi komentar tujuan, dan README menjelaskannya.

Berkasnya ada di akar repo: [`Jenkinsfile`](../Jenkinsfile).

**Setiap perintah di dalamnya sudah dijalankan manual di repo ini** (lihat tabel bukti di bawah), kecuali `checkout scm` yang hanya bekerja di dalam Jenkins. Tidak ada stage yang memanggil script yang tidak ada — draf awal bagian ini sempat memanggil `npm run lint` dan `npm test` yang tidak pernah ada, dan itu sudah diperbaiki.

```groovy
pipeline {
  agent any

  environment {
    COMPOSE_FILE = 'docker-compose.yml'
    WEB_PORT = '8080'
  }

  stages {
    stage('Checkout') {
      // Ambil source + riwayat commit. Full clone, bukan depth 1, karena
      // reviewer menilai riwayat commit bertahap.
      steps { checkout scm }
    }

    stage('Prepare Env') {
      // docker compose membaca .env untuk POSTGRES_* dan JWT_SECRET.
      // .env tidak masuk repo, jadi dibuat dari contoh dengan secret acak.
      steps {
        sh '''
          if [ ! -f .env ]; then
            cp .env.example .env
            secret=$(openssl rand -hex 32)
            sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$secret|" .env
          fi
        '''
      }
    }

    stage('Install') {
      // npm ci deterministik: patuh package-lock.json, tidak mengubahnya.
      steps { sh 'cd api && npm ci' ; sh 'cd web && npm ci' }
    }

    stage('Type Check') {
      // Menangkap error tipe tanpa emit. Lebih murah dari test, jadi lebih dulu.
      steps { sh 'cd api && npm run typecheck' ; sh 'cd web && npm run typecheck' }
    }

    stage('Test') {
      // verify = typecheck:all + seluruh rangkaian check:*
      // (izin, middleware, skema, service, route). Tidak butuh Postgres.
      steps { sh 'cd api && npm run verify' }
    }

    stage('Build') {
      // Validasi Dockerfile & konteks build; juga menjalankan tsc di image.
      steps { sh 'docker compose build' }
    }

    stage('Start Stack & Smoke Test') {
      // Buktikan stack benar-benar berjalan, bukan hanya ter-build.
      steps {
        sh 'docker compose up -d --wait'
        sh 'sh scripts/smoke-test.sh'
      }
    }
  }

  post {
    // Selalu turunkan stack + hapus volume, walau ada stage yang gagal.
    always  { sh 'docker compose down -v || true' }
    success { echo 'Pipeline selesai: semua stage lulus.' }
    failure { echo 'Pipeline gagal — lihat stage yang merah.' }
  }
}
```

### Penjelasan stage (juga masuk README)

| Stage               | Apa yang dilakukan                                         | Kenapa di urutan ini                                                |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| Checkout            | Ambil repo & commit history penuh                          | Butuh riwayat; depth-1 menghilangkan histori                        |
| Prepare Env         | Buat `.env` dari `.env.example` + `JWT_SECRET` acak        | `compose` butuh `POSTGRES_*` & `JWT_SECRET`; `.env` tidak di repo   |
| Install             | `npm ci` di `api` & `web`                                  | `npm ci` deterministik (patuh lockfile), beda dari `npm install`    |
| Type Check          | `tsc --noEmit` / `vue-tsc --noEmit`                        | Menangkap error tipe tanpa artefak; lebih murah dari build          |
| Test                | `npm run verify` (izin, middleware, skema, service, route) | Melindungi aturan izin dari regresi; tanpa DB, jadi cepat & mandiri |
| Build               | `docker compose build`                                     | Memvalidasi Dockerfile & konteks build                              |
| Start Stack & Smoke | `compose up -d --wait` → `smoke-test.sh` → `down -v`       | Membuktikan stack benar-benar **berjalan**, bukan hanya ter-build   |
| post                | Selalu `compose down -v`                                   | Bersihkan resource walau gagal                                      |

**Catatan desain:** stage `Test` dan `Smoke Test` sengaja dipisah — `Test` mengecek unit logika izin tanpa database, `Smoke Test` mengecek integrasi nyata end-to-end (DB + migrasi + seed + auth). Kegagalan di salah satu menunjuk area yang berbeda.

**Kenapa tidak ada stage `Lint`:** repo ini tidak memasang ESLint/Prettier. Menulis stage `Lint` yang memanggil script tak ada hanya akan membuat pipeline merah. Bila linting ditambahkan nanti, tambahkan script `lint` di kedua paket dulu, baru stage-nya.

### `scripts/smoke-test.sh`

Skrip ini menunggu `/health` melaporkan `db: "up"`, lalu memeriksa halaman web, login seed, dan satu endpoint terproteksi (dengan dan tanpa cookie). Keluar non-nol pada kegagalan pertama.

**Temuan saat verifikasi:** `/health` **tidak** bisa dijangkau dari luar lewat nginx. Endpoint itu didaftarkan di root app API (`app.get("/health")`), sedangkan `nginx.conf` hanya mem-proxy `location /api/`, dan `proxy_pass http://api:3000;` **tanpa** trailing slash sehingga path diteruskan utuh — akibatnya `/api/health` menjadi `api:3000/api/health` → `404`, sementara `/health` langsung ditelan SPA fallback (`try_files $uri /index.html`) → `200` HTML. Karena itu skrip memeriksa health **dari dalam container api**, yang sekaligus menguji koneksi API → database sungguhan. Login dan endpoint lain tetap diperiksa lewat nginx karena prefix `/api/` memang di-proxy dengan benar.

### Bukti verifikasi (2026-09-23)

| Stage       | Perintah yang diuji             | Hasil                                                              |
| ----------- | ------------------------------- | ------------------------------------------------------------------ |
| Prepare Env | guard `if [ ! -f .env ]`        | `.env` sudah ada → dilewati (idempoten)                            |
| Install     | `npm ci` di `api` & `web`       | terpasang dari lockfile                                            |
| Type Check  | `npm run typecheck` (api & web) | exit 0                                                             |
| Test        | `npm run verify`                | 36 + 19 + 11 + 24 + 18 + 13 + 32 + 21 lulus, 0 gagal               |
| Build       | `docker compose build`          | image `api` & `web` terbangun                                      |
| Start Stack | `docker compose up -d --wait`   | 3 container **healthy**                                            |
| Smoke Test  | `sh scripts/smoke-test.sh`      | 5 pemeriksaan OK, exit 0                                           |
| post        | `docker compose down -v`        | container, volume, network terhapus; container dev tidak tersentuh |

> Dijalankan dengan `WEB_PORT=8080` (nilai default). Container pendukung seperti Adminer dipindah ke port lain lewat `docker-compose.tools.yml`, lihat bagian “Catatan port” di [ROADMAP](ROADMAP.md).

---

## 7. Strategi Riwayat Git

Brief: _"a real commit history … do not squash everything into one commit."_

Urutan commit yang direncanakan (tiap baris = satu commit bermakna):

```
1. chore: init repo, .gitignore, .env.example
2. docs: tambah dokumen perencanaan di docs/
3. feat(api): setup Hono + tsconfig + entry point
4. feat(api): koneksi postgres + runner migrasi
5. feat(api): skema awal (users, requests, enum)
6. feat(api): util password (argon2) + jwt
7. feat(api): middleware auth + requireRole + errorHandler
8. feat(api): endpoint auth (login/logout/me)
9. feat(api): CRUD request + policy izin
10. feat(api): endpoint approve/reject
11. feat(api): manajemen user (admin)
12. feat(api): seed data
13. feat(web): setup Vue 3 + Vite + router + pinia
14. feat(web): design token & style dasar
15. feat(web): komponen layout (sidebar, header)
16. feat(web): komponen umum (badge, table, statcard, …)
17. feat(web): halaman login
18. feat(web): dashboard
19. feat(web): daftar request + filter
20. feat(web): detail request + aksi
21. feat(web): create/edit request
22. feat(web): halaman users (admin)
23. chore: docker compose + Dockerfile
24. ci: Jenkinsfile
25. docs: README lengkap + AI disclosure
```

Konvensi: prefix `feat`/`fix`/`docs`/`chore`/`ci`/`test`, pesan imperatif, satu concern per commit.

---

## 8. Struktur File Infrastruktur

```
.
├── docker-compose.yml
├── Jenkinsfile
├── .env.example
├── .gitignore
├── README.md
├── scripts/
│   └── smoke-test.sh          # dipakai stage Jenkins & verifikasi lokal
├── docs/
├── api/
│   └── Dockerfile
└── web/
    ├── Dockerfile
    └── nginx.conf
```

`.gitignore` mencakup: `node_modules/`, `dist/`, `.env`, `.env.*` (kecuali `.env.example`), `coverage/`, log, dan artefak OS/editor.
