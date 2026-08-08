#!/usr/bin/env bash
# USB device lab: Express SOS + Firebase emulators + Expo (localhost) + adb reverse.
# Canonical Clerk app: Seren SOS (real-guppy-12) — not Seren SOS Platform.
#
# Usage (from repo root):
#   ./scripts/lab-usb-start.sh
#   ./scripts/lab-usb-start.sh --seed-clerk-user user_xxx
#
# Requires: adb device in "device" state, node, java (Firestore emulator), firebase-tools.
# Do not use Expo tunnel for bridge testing — tunnel only carries the JS bundle.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SEED_CLERK_USER=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --seed-clerk-user)
      SEED_CLERK_USER="${2:-}"
      shift 2
      ;;
    -h|--help)
      sed -n '1,12p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1" >&2; exit 1; }; }
need adb
need node
need npx

if ! adb devices 2>/dev/null | awk 'NR>1 && $2=="device"{found=1} END{exit !found}'; then
  echo "No USB Android device (adb devices must show state=device)." >&2
  echo "Enable USB debugging / file transfer, then re-run." >&2
  exit 1
fi

ensure_reverse() {
  adb reverse tcp:5001 tcp:5001
  adb reverse tcp:9099 tcp:9099
  adb reverse tcp:8080 tcp:8080
  adb reverse tcp:4000 tcp:4000
  adb reverse tcp:8081 tcp:8081
  echo "adb reverse:"
  adb reverse --list
}

port_up() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

# Load functions env (Clerk / mint secrets) for the emulator process.
if [[ -f firebase/functions/.env ]]; then
  set -a
  # shellcheck disable=SC1091
  . firebase/functions/.env
  set +a
fi

ensure_reverse

if ! port_up 4000; then
  echo "Starting Express SOS on :4000..."
  (cd server && node index.js > /tmp/seren-express-sos.log 2>&1 &)
  for _ in $(seq 1 20); do
    port_up 4000 && break
    sleep 0.25
  done
  curl -sf -m 3 http://127.0.0.1:4000/health >/dev/null || {
    echo "Express failed to start — see /tmp/seren-express-sos.log" >&2
    exit 1
  }
else
  echo "Express already on :4000"
fi

if ! port_up 8080 || ! port_up 9099 || ! port_up 5001; then
  if port_up 8080 || port_up 9099 || port_up 5001; then
    echo "Partial emulator set detected; stop existing Firebase emulators and re-run." >&2
    exit 1
  fi
  echo "Starting Firebase emulators (firestore,auth,functions) project=demo-seren..."
  npx firebase emulators:start \
    --only firestore,auth,functions \
    --config firebase/firebase.json \
    --project demo-seren \
    > /tmp/seren-firebase-emulators.log 2>&1 &
  for _ in $(seq 1 90); do
    if port_up 8080 && port_up 9099 && port_up 5001; then
      break
    fi
    sleep 1
  done
  if ! port_up 8080 || ! port_up 9099 || ! port_up 5001; then
    echo "Emulators failed — see /tmp/seren-firebase-emulators.log" >&2
    exit 1
  fi
else
  echo "Firebase emulators already up"
fi

echo "Seeding phase2b tenants (emulator data wipes on restart)..."
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren \
  npm --prefix firebase/functions run seed:phase2b

if [[ -n "$SEED_CLERK_USER" ]]; then
  echo "Seeding device membership for $SEED_CLERK_USER..."
  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren \
    CLERK_USER_ID="$SEED_CLERK_USER" \
    node scripts/seed-device-clerk-membership.js
fi

ensure_reverse

if port_up 8081; then
  echo "Metro already on :8081 — leave it running (prefer --localhost for USB)."
else
  echo "Starting Expo Go Metro on localhost:8081 (USB reverse)..."
  echo "  Open on phone: exp://127.0.0.1:8081"
  echo "  Env: .env.local should set EXPO_PUBLIC_* hosts to 127.0.0.1"
  echo "  Avoid --tunnel for bridge testing."
  exec npx expo start --go --localhost
fi

echo ""
echo "Lab ready."
echo "  Express     http://127.0.0.1:4000"
echo "  Functions   http://127.0.0.1:5001"
echo "  Auth        http://127.0.0.1:9099"
echo "  Firestore   http://127.0.0.1:8080"
echo "  Metro       http://127.0.0.1:8081  →  exp://127.0.0.1:8081"
echo "  Clerk app   Seren SOS (real-guppy-12)"
echo "  Logs        /tmp/seren-express-sos.log  /tmp/seren-firebase-emulators.log"
