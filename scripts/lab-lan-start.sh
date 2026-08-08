#!/usr/bin/env bash
# LAN device lab: Express SOS + Firebase emulators + Expo (LAN) with .env.local host sync.
# Canonical Clerk app: Seren SOS (real-guppy-12) — not Seren SOS Platform.
#
# Preferred for physical iPhone (no adb reverse). Also works for Android on same Wi‑Fi.
#
# Usage (from repo root):
#   npm run lab
#   npm run lab:lan
#   ./scripts/lab-lan-start.sh
#   ./scripts/lab-lan-start.sh --seed-clerk-user user_xxx
#   LAB_LAN_IP=192.168.0.90 ./scripts/lab-lan-start.sh
#
# Requires: same Wi‑Fi without AP/guest isolation; node; java (Firestore); firebase-tools.
# Do not use Expo tunnel for bridge testing — tunnel only carries the JS bundle.

set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")" && pwd)/lab-lib.sh"
lab_root

SEED_CLERK_USER=""
CLEAR_CACHE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --seed-clerk-user)
      SEED_CLERK_USER="${2:-}"
      shift 2
      ;;
    --clear)
      CLEAR_CACHE=1
      shift
      ;;
    -h|--help)
      sed -n '1,18p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

lab_need node
lab_need npx
lab_need curl
lab_need lsof

LAN_IP="$(lab_detect_lan_ip)"
echo "LAN IP: $LAN_IP"
lab_write_lan_env_local "$LAN_IP"

lab_load_functions_env
lab_start_express
lab_start_emulators
lab_seed_phase2b
lab_seed_clerk_user "$SEED_CLERK_USER"

echo ""
echo "Lab ready (LAN)."
echo "  Express     http://$LAN_IP:4000"
echo "  Functions   http://$LAN_IP:5001"
echo "  Auth        http://$LAN_IP:9099"
echo "  Firestore   http://$LAN_IP:8080"
echo "  Metro       http://$LAN_IP:8081"
echo "  Open        exp://$LAN_IP:8081"
echo "  Dev Client  exp+safety-alert-app://expo-development-client/?url=http%3A%2F%2F${LAN_IP}%3A8081"
echo "  Clerk app   Seren SOS (real-guppy-12)"
echo "  Logs        /tmp/seren-express-sos.log  /tmp/seren-firebase-emulators.log"
echo "  After emulator restart: phase2b + device membership are re-seeded by this script."
echo "  Avoid --tunnel for bridge testing."
echo ""

if lab_port_up 8081; then
  echo "Metro already on :8081 — leave it running (restart if it still advertises a stale IP)."
  echo "  Quick check: curl -s http://$LAN_IP:8081/status"
  exit 0
fi

echo "Starting Expo Metro on LAN :8081 (REACT_NATIVE_PACKAGER_HOSTNAME=$LAN_IP)..."
export REACT_NATIVE_PACKAGER_HOSTNAME="$LAN_IP"
EXPO_ARGS=(start --lan --port 8081)
if [[ "$CLEAR_CACHE" -eq 1 ]]; then
  EXPO_ARGS+=(--clear)
fi
exec npx expo "${EXPO_ARGS[@]}"
