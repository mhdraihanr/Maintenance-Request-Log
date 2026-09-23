#!/usr/bin/env sh
#
# Smoke test end-to-end: membuktikan stack benar-benar berjalan, bukan sekadar
# ter-build. Dipakai stage "Start Stack & Smoke Test" di Jenkinsfile dan bisa
# dijalankan manual dari root repo: sh scripts/smoke-test.sh
#
# Yang diuji, berurutan:
#   1. /health API membalas 200 dan db: "up"
#   2. halaman web (nginx) membalas 200
#   3. login seed berhasil dan mengembalikan cookie
#   4. cookie itu dipakai untuk memanggil endpoint terproteksi
#
# Keluar dengan kode non-nol pada kegagalan pertama, supaya Jenkins menandai
# stage merah di titik yang tepat.

set -eu

WEB_URL="${WEB_URL:-http://localhost:${WEB_PORT:-8080}}"
API_URL="${API_URL:-$WEB_URL/api}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-90}"
SEED_USERNAME="${SEED_USERNAME:-bud}"
SEED_PASSWORD="${SEED_PASSWORD:-operator123}"

fail() {
  echo "GAGAL: $1" >&2
  exit 1
}

ok() {
  echo "OK: $1"
}

# --- 1. tunggu /health sampai db "up" -------------------------------------
# Endpoint /health didaftarkan di root app API, sedangkan nginx hanya mem-proxy
# prefix /api/. Artinya /health tidak dijangkau dari luar (SPA fallback yang
# menangkapnya). Karena itu health diperiksa dari dalam jaringan Docker lewat
# container api. Ini juga menguji koneksi API -> database yang sebenarnya.
# Container api menjalankan migrate + seed sebelum listen, jadi 200 pertama
# bisa saja belum siap. Di-poll, bukan sekadar sleep.
echo "Menunggu /health di container api (maks ${HEALTH_TIMEOUT}s)..."
elapsed=0
health=""
while [ "$elapsed" -lt "$HEALTH_TIMEOUT" ]; do
  health=$(docker compose exec -T api \
    node -e "fetch('http://localhost:3000/health').then(r=>r.text()).then(t=>process.stdout.write(t)).catch(()=>{})" \
    2>/dev/null || true)
  case "$health" in
    *'"db":"up"'*) break ;;
  esac
  sleep 2
  elapsed=$((elapsed + 2))
done

case "$health" in
  *'"db":"up"'*) ok "/health merespons, db up" ;;
  *) fail "/health tidak melaporkan db up setelah ${HEALTH_TIMEOUT}s. Terakhir: ${health:-<kosong>}" ;;
esac

# --- 2. halaman web -------------------------------------------------------
code=$(curl -s -o /dev/null -w '%{http_code}' "$WEB_URL/")
[ "$code" = "200" ] || fail "halaman web membalas $code, bukan 200"
ok "halaman web membalas 200"

# --- 3. login seed --------------------------------------------------------
cookie_jar=$(mktemp)
trap 'rm -f "$cookie_jar"' EXIT

login_code=$(curl -s -o /dev/null -w '%{http_code}' \
  -c "$cookie_jar" \
  -H 'Content-Type: application/json' \
  -X POST "$API_URL/auth/login" \
  --data "{\"username\":\"$SEED_USERNAME\",\"password\":\"$SEED_PASSWORD\"}")

[ "$login_code" = "200" ] || fail "login '$SEED_USERNAME' membalas $login_code, bukan 200"
grep -q 'auth' "$cookie_jar" || fail "login tidak menyetel cookie 'auth'"
ok "login '$SEED_USERNAME' berhasil, cookie diterima"

# --- 4. endpoint terproteksi memakai cookie -------------------------------
me_code=$(curl -s -o /dev/null -w '%{http_code}' -b "$cookie_jar" "$API_URL/auth/me")
[ "$me_code" = "200" ] || fail "GET /auth/me membalas $me_code, bukan 200"
ok "GET /auth/me dengan cookie membalas 200"

# Tanpa cookie harus 401 — membuktikan proteksi benar-benar aktif.
anon_code=$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/auth/me")
[ "$anon_code" = "401" ] || fail "GET /auth/me tanpa cookie membalas $anon_code, bukan 401"
ok "GET /auth/me tanpa cookie membalas 401"

echo "Smoke test lulus."
