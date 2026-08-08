# Shared helpers for lab-usb-start.sh / lab-lan-start.sh.
# shellcheck shell=bash

lab_root() {
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  cd "$ROOT"
}

lab_need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing: $1" >&2
    exit 1
  }
}

lab_port_up() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

lab_load_functions_env() {
  if [[ -f firebase/functions/.env ]]; then
    set -a
    # shellcheck disable=SC1091
    . firebase/functions/.env
    set +a
  fi
}

lab_ensure_express_data_dir() {
  mkdir -p server/data
}

lab_start_express() {
  lab_ensure_express_data_dir
  if lab_port_up 4000; then
    echo "Express already on :4000"
    return 0
  fi
  echo "Starting Express SOS on :4000..."
  (cd server && node index.js > /tmp/seren-express-sos.log 2>&1 &)
  for _ in $(seq 1 20); do
    lab_port_up 4000 && break
    sleep 0.25
  done
  curl -sf -m 3 http://127.0.0.1:4000/health >/dev/null || {
    echo "Express failed to start — see /tmp/seren-express-sos.log" >&2
    exit 1
  }
}

lab_clear_partial_emulators() {
  echo "Partial emulator set detected — stopping orphans and restarting full set..."
  pkill -f 'cloud-firestore-emulator' 2>/dev/null || true
  pkill -f 'firebase emulators:start' 2>/dev/null || true
  pkill -f 'cloud-firestore-emulator-v' 2>/dev/null || true
  for _ in $(seq 1 20); do
    if ! lab_port_up 8080 && ! lab_port_up 9099 && ! lab_port_up 5001; then
      break
    fi
    sleep 0.25
  done
  if lab_port_up 8080 || lab_port_up 9099 || lab_port_up 5001; then
    echo "Could not clear partial emulators. Free ports 8080/9099/5001 and re-run." >&2
    exit 1
  fi
}

lab_start_emulators() {
  if ! lab_port_up 8080 || ! lab_port_up 9099 || ! lab_port_up 5001; then
    if lab_port_up 8080 || lab_port_up 9099 || lab_port_up 5001; then
      lab_clear_partial_emulators
    fi
    echo "Starting Firebase emulators (firestore,auth,functions) project=demo-seren..."
    npx firebase emulators:start \
      --only firestore,auth,functions \
      --config firebase/firebase.json \
      --project demo-seren \
      > /tmp/seren-firebase-emulators.log 2>&1 &
    for _ in $(seq 1 90); do
      if lab_port_up 8080 && lab_port_up 9099 && lab_port_up 5001; then
        break
      fi
      sleep 1
    done
    if ! lab_port_up 8080 || ! lab_port_up 9099 || ! lab_port_up 5001; then
      echo "Emulators failed — see /tmp/seren-firebase-emulators.log" >&2
      exit 1
    fi
  else
    echo "Firebase emulators already up"
  fi
}

lab_seed_phase2b() {
  echo "Seeding phase2b tenants (emulator data wipes on restart)..."
  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren \
    npm --prefix firebase/functions run seed:phase2b
}

lab_seed_clerk_user() {
  local clerk_user="$1"
  [[ -n "$clerk_user" ]] || return 0
  echo "Seeding device membership for $clerk_user (SEED_ROLE=${SEED_ROLE:-student}, SEED_RESPONDER_TRACK=${SEED_RESPONDER_TRACK:-security})..."
  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren \
    CLERK_USER_ID="$clerk_user" \
    CLERK_USER_EMAIL="${CLERK_USER_EMAIL:-}" \
    SEED_ROLE="${SEED_ROLE:-student}" \
    SEED_RESPONDER_TRACK="${SEED_RESPONDER_TRACK:-security}" \
    EXPRESS_UNIT_CODE="${EXPRESS_UNIT_CODE:-ALPHA-12}" \
    node scripts/seed-device-clerk-membership.js
}

lab_detect_lan_ip() {
  local ip=""
  if [[ -n "${LAB_LAN_IP:-}" ]]; then
    echo "$LAB_LAN_IP"
    return 0
  fi
  if command -v ipconfig >/dev/null 2>&1; then
    ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
    if [[ -z "$ip" ]]; then
      ip="$(ipconfig getifaddr en1 2>/dev/null || true)"
    fi
  fi
  if [[ -z "$ip" ]] && command -v route >/dev/null 2>&1; then
    local iface
    iface="$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')"
    if [[ -n "$iface" ]]; then
      ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
    fi
  fi
  if [[ -z "$ip" || "$ip" == 127.* ]]; then
    echo "Could not detect LAN IP. Set LAB_LAN_IP=x.x.x.x and re-run." >&2
    exit 1
  fi
  echo "$ip"
}

# Read first matching KEY=value from candidate files (value only).
lab_read_env_value() {
  local key="$1"
  shift
  local src line
  for src in "$@"; do
    [[ -f "$src" ]] || continue
    line="$(grep -E "^${key}=" "$src" | tail -n 1 || true)"
    if [[ -n "$line" ]]; then
      echo "${line#*=}"
      return 0
    fi
  done
  return 1
}

# Write gitignored .env.local for LAN hosts; preserve Clerk / enable flags.
lab_write_lan_env_local() {
  local ip="$1"
  local pk enable compat
  pk="$(lab_read_env_value EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY .env.local .env.local.usb .env.local.lan .env || true)"
  enable="$(lab_read_env_value EXPO_PUBLIC_ENABLE_CLERK_MOBILE .env.local .env.local.usb .env.local.lan .env || true)"
  compat="$(lab_read_env_value EXPO_PUBLIC_EXPRESS_CLERK_COMPAT_SECRET .env.local .env .env.local.usb || true)"
  enable="${enable:-true}"

  if [[ -f .env.local ]] && grep -q '127\.0\.0\.1' .env.local; then
    cp .env.local .env.local.usb.bak 2>/dev/null || true
    echo "Backed up USB-style .env.local → .env.local.usb.bak"
  fi

  cat > .env.local <<EOF
# Local overrides for Expo (loaded over \`.env\`, gitignored).
# Seren SOS (Seren Tech) — Development — real-guppy-12
#
# PHYSICAL device / LAN mode (auto-written by scripts/lab-lan-start.sh).
# Phone + Mac must share the same Wi‑Fi (no AP/guest isolation).
# Open: exp://$ip:8081
# Avoid Expo --tunnel for bridge testing (tunnel only carries the JS bundle).
#
# For Android USB instead: copy \`.env.local.usb\` → \`.env.local\` and use \`npm run lab:usb\`.

EXPO_PUBLIC_ENABLE_CLERK_MOBILE=$enable
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=$pk

EXPO_PUBLIC_API_BASE_URL=http://$ip:4000
EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST=$ip:5001
EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=$ip:9099
EOF

  if [[ -n "$compat" ]]; then
    printf '\nEXPO_PUBLIC_EXPRESS_CLERK_COMPAT_SECRET=%s\n' "$compat" >> .env.local
  fi

  if [[ -z "$pk" || "$pk" == *your_key* ]]; then
    echo "WARN: EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY missing/placeholder in .env.local — set Seren SOS (real-guppy-12) key." >&2
  fi
  echo "Wrote .env.local LAN hosts → $ip"
}
