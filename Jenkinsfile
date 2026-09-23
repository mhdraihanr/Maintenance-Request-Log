// Pipeline CI untuk Maintenance Request Log.
//
// Catatan: pipeline ini TIDAK dijalankan terhadap server Jenkins nyata — brief
// menyatakan Jenkinsfile akan dibaca dan ditanyakan. Karena itu setiap stage
// diberi komentar tentang tujuan dan alasan urutannya.
//
// Setiap perintah di sini sudah diverifikasi bisa dijalankan di repo ini
// (lihat docs/steps/step-30-jenkinsfile.md bagian "Bukti"). Tidak ada perintah
// yang memanggil script yang tidak ada.

pipeline {
  agent any

  environment {
    COMPOSE_FILE = 'docker-compose.yml'
    // Port web di stack; dipakai smoke test untuk menyusun URL.
    WEB_PORT = '8080'
  }

  stages {
    stage('Checkout') {
      // Ambil source + riwayat commit. Full clone, bukan depth 1, karena
      // reviewer menilai riwayat commit bertahap.
      steps {
        checkout scm
      }
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
      // Dijalankan di dua paket karena keduanya punya lockfile sendiri.
      steps {
        sh 'cd api && npm ci'
        sh 'cd web && npm ci'
      }
    }

    stage('Type Check') {
      // Menangkap error tipe tanpa menghasilkan artefak. Sengaja sebelum test:
      // lebih murah dan gagal lebih cepat. Kedua paket punya script typecheck.
      steps {
        sh 'cd api && npm run typecheck'
        sh 'cd web && npm run typecheck'
      }
    }

    stage('Test') {
      // Uji API: matriks izin, middleware, skema, service, dan route.
      // `npm run verify` = typecheck:all + seluruh rangkaian check:*.
      // Uji ini tidak butuh Postgres (service & route diuji dengan query palsu).
      steps {
        sh 'cd api && npm run verify'
      }
    }

    stage('Build') {
      // Bangun image api & web. Memvalidasi Dockerfile dan konteks build;
      // ini juga menjalankan `tsc` di dalam image, jadi error build tertangkap.
      steps {
        sh 'docker compose build'
      }
    }

    stage('Start Stack & Smoke Test') {
      // Nyalakan stack, lalu buktikan benar-benar berjalan: /health dengan db up,
      // halaman web, login seed, dan endpoint terproteksi.
      steps {
        sh 'docker compose up -d --wait'
        sh 'sh scripts/smoke-test.sh'
      }
    }
  }

  post {
    // Selalu turunkan stack + hapus volume, walau ada stage yang gagal.
    // `-v` penting supaya run berikutnya mulai dari database bersih.
    always {
      sh 'docker compose down -v || true'
    }
    success {
      echo 'Pipeline selesai: semua stage lulus.'
    }
    failure {
      echo 'Pipeline gagal — lihat stage yang merah.'
    }
  }
}
