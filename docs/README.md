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

## Menjalankan Cepat

Prasyarat: Docker + Docker Compose, dan Node 20+ bila ingin mode dev.

```bash
cp .env.example .env
openssl rand -hex 32        # tempel hasilnya ke JWT_SECRET di .env
docker compose up --build
```

Buka `http://localhost:8080`. Akun seed:

| Username | Password        | Peran      |
| -------- | --------------- | ---------- |
| `bud`    | `operator123`   | operator   |
| `siti`   | `supervisor123` | supervisor |
| `andi`   | `admin123`      | admin      |

### Catatan port

`WEB_PORT` di `.env` menentukan port host untuk `web`. Default `8080`. **Kalau port 8080 sudah
dipakai** (misalnya oleh Adminer dalam container lain), ubah jadi `WEB_PORT=8081`. Jangan mengubah
pemetaan di `docker-compose.yml` — nilai itu sengaja bisa dikonfigurasi.

Periksa dulu apakah port bebas:

```bash
netstat -ano | grep LISTENING | grep ":8080"
```

### Kalau mengakses dari mesin lain

Cookie sesi di-set dengan flag `Secure` saat `NODE_ENV=production`. Browser hanya menyimpan cookie
`Secure` dari origin yang dianggap aman, dan `http://localhost` **termasuk** aman menurut
spesifikasi. Alamat IP LAN (`http://192.168.x.x:8080`) **tidak** — di sana login akan tampak
berhasil lalu langsung kembali ke halaman login. Pakai `localhost`.

---

## Catatan Infrastruktur

### `dist/` adalah keluaran build, bukan sumber

`api/` ditulis dalam TypeScript. Node tidak menjalankan TypeScript, jadi `npm run build`
menjalankan `tsc` untuk menerjemahkan `api/src/` menjadi JavaScript di `api/dist/`. Yang dijalankan
saat produksi (`npm start`, `CMD` di Dockerfile) adalah `node dist/index.js`.

Di mode dev (`npm run dev`) `dist/` tidak dipakai sama sekali — `tsx` menjalankan `src/` langsung.
Jangan mengedit apa pun di `dist/`; setiap build akan menimpanya.

### Kenapa `build` memanggil skrip rewrite

`api/package.json` memakai:

```json
"build": "tsc && node scripts/rewrite-imports.mjs dist"
```

`tsconfig.json` memakai `moduleResolution: "bundler"`, yang **membiarkan import relatif tanpa
ekstensi** (`from "./env"`) karena menganggap ada bundler di hilir. Proyek ini menjalankan hasil
`tsc` langsung tanpa bundler, dan Node ESM menolak import tanpa ekstensi. Akibatnya
`node dist/index.js` gagal dengan:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/app/dist/db/pool'
```

Bug ini sudah ada sejak awal proyek dan tidak terlihat selama ini karena dev selalu memakai `tsx`,
yang menyelesaikan import tanpa ekstensi. Skrip `rewrite-imports.mjs` menambahkan `.js` pada
spesifier relatif di `dist/` setelah compile, sehingga `dist/` valid untuk Node ESM.

Perbaikan ini dipilih supaya **tidak menyentuh satu pun file sumber**. Alternatif yang
dipertimbangkan dan ditolak: menulis `.js` manual di 69 import `src/`; memakai
`rewriteRelativeImportExtensions` (125 import terdampak, butuh `NodeNext`); dan membundel dengan
`esbuild` (gagal pada `@node-rs/argon2` yang memuat binary native `.node`).

### Ukuran image

Diukur lewat `docker images`, Docker 29.8.0:

| Image                           | Ukuran  |
| ------------------------------- | ------- |
| `api` (multi-stage)             | 214 MB  |
| `web` (multi-stage)             | 98.4 MB |
| `web` single-stage (pembanding) | 347 MB  |
| `postgres:16-alpine`            | 420 MB  |

`web` memakai dua stage: `node:20-alpine` untuk build, lalu `nginx:alpine` untuk menyajikan hasil
Vite. Node dan `node_modules` tidak ikut ke image akhir, sehingga sekitar 72% lebih kecil
dibanding single-stage.

`api` **tetap** membawa `node_modules` produksi karena `@node-rs/argon2` memuat binary native yang
tidak bisa dibundel. Karena itu image `api` jauh lebih besar dari `web`, dan itu memang tidak
bisa dihindari tanpa mengganti algoritma hashing.

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
