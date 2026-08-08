#!/usr/bin/env bash
# USB device lab: Express SOS + Firebase emulators + Expo (localhost) + adb reverse.
# Canonical Clerk app: Seren SOS (real-guppy-12) — not Seren SOS Platform.
#
# Usage (from repo root):
#   ./scripts/lab-usb-start.sh
#   ./scripts/lab-usb-start.sh --seed-clerk-user user_xxx
#   npm run lab:usb
#
# Requires: adb device in "device" state, node, java (Firestore emulator), firebase-tools.
# Do not use Expo tunnel for bridge testing — tunnel only carries the JS bundle.
# For physical iPhone / no USB: npm run lab:lan

set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")" && pwd)/lab-lib.sh"
lab_root

SEED_CLERK_USER=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --seed-clerk-user)
      SEED_CLERK_USER="${2:-}"
      shift 2
      ;;
    -h|--help)
      sed -n '1,14p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

lab_need adb
lab_need node
lab_need npx
lab_need curl
lab_need lsof

if ! adb devices 2>/dev/null | awk 'NR>1 && $2=="device"{found=1} END{exit !found}'; then
  echo "No USB Android device (adb devices must show state=device)." >&2
  echo "Enable USB debugging / file transfer, then re-run — or use: npm run lab:lan" >&2
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

if [[ -f .env.local.usb ]]; then
  cp .env.local.usb .env.local
  echo "Applied .env.local.usb → .env.local (127.0.0.1 hosts for adb reverse)"
elif [[ -f .env.local ]] && ! grep -q '127\.0\.0\.1' .env.local; then
  echo "WARN: .env.local does not look like USB (127.0.0.1). Copy .env.local.usb → .env.local for adb reverse." >&2
fi

lab_load_functions_env
ensure_reverse
lab_start_express
lab_start_emulators
lab_seed_phase2b
lab_seed_clerk_user "$SEED_CLERK_USER"
ensure_reverse

echo ""
echo "Lab ready (USB)."
echo "  Express     http://127.0.0.1:4000"
echo "  Functions   http://127.0.0.1:5001"
echo "  Auth        http://127.0.0.1:9099"
echo "  Firestore   http://127.0.0.1:8080"
echo "  Metro       http://127.0.0.1:8081  →  exp://127.0.0.1:8081"
echo "  Clerk app   Seren SOS (real-guppy-12)"
echo "  Logs        /tmp/seren-express-sos.log  /tmp/seren-firebase-emulators.log"
echo "  Avoid --tunnel for bridge testing."
echo ""

if lab_port_up 8081; then
  echo "Metro already on :8081 — leave it running (prefer --localhost for USB)."
  exit 0
fi

echo "Starting Expo Go Metro on localhost:8081 (USB reverse)..."
exec npx expo start --go --localhost --port 8081
