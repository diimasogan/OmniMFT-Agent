#!/usr/bin/env bash
# OmniMFT outbound-only bridge for Boomi Agentstudio (no tunnel, no inbound ports).
#   ./start-bridge.sh          start the worker in the background (needs FortiClient VPN for ST)
#   ./start-bridge.sh --stop   stop it
#   ./start-bridge.sh --status show whether it runs + last log lines
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p logs
case "${1:-}" in
  --stop)   pkill -f "python bridge_worker.py" && echo "bridge stopped" || echo "bridge not running"; exit 0 ;;
  --status) pgrep -af "python bridge_worker.py" >/dev/null && echo "bridge RUNNING" || echo "bridge STOPPED"; tail -n 8 logs/bridge.log 2>/dev/null; exit 0 ;;
esac
pkill -f "python bridge_worker.py" 2>/dev/null || true
nohup .venv/bin/python bridge_worker.py >/dev/null 2>&1 &
sleep 2
pgrep -af "python bridge_worker.py" >/dev/null && echo "bridge started (log: logs/bridge.log)" || { echo "bridge failed to start"; tail -n 20 logs/bridge.log; exit 1; }
