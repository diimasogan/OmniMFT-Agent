#!/usr/bin/env bash
# Start the OmniMFT demo stack: relay API (127.0.0.1:8765) + Cloudflare quick tunnel, then point the
# Agentstudio tools at the new tunnel URL.
#   ./start-demo.sh            start relay + tunnel, update agent tools
#   ./start-demo.sh --deploy   same, and package + deploy the agent to "Agent Garden Test"
#   ./start-demo.sh --stop     stop relay + tunnel (closes public access)
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p logs
CF="$(command -v cloudflared || echo "$HOME/.local/bin/cloudflared")"

stop() {
  pkill -f "uvicorn relay:app" 2>/dev/null && echo "relay stopped" || true
  pkill -f "cloudflared tunnel --url http://127.0.0.1:8765" 2>/dev/null && echo "tunnel stopped" || true
}
if [[ "${1:-}" == "--stop" ]]; then stop; exit 0; fi
[[ -x "$CF" ]] || { echo "cloudflared not found at $CF"; exit 1; }

stop
nohup .venv/bin/uvicorn relay:app --host 127.0.0.1 --port 8765 --log-level warning >> logs/relay.log 2>&1 &
for _ in $(seq 1 20); do curl -s -o /dev/null http://127.0.0.1:8765/health && break; sleep 1; done
echo "relay up on 127.0.0.1:8765"

: > logs/tunnel.log
nohup "$CF" tunnel --url http://127.0.0.1:8765 --protocol http2 --no-autoupdate >> logs/tunnel.log 2>&1 &
URL=""
for _ in $(seq 1 60); do
  URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' logs/tunnel.log | head -1 || true)"
  [[ -n "$URL" ]] && break; sleep 1
done
[[ -n "$URL" ]] || { echo "tunnel URL not found; see logs/tunnel.log"; exit 1; }
echo "tunnel: $URL"

if grep -q '^RELAY_PUBLIC_URL=' .env; then sed -i "s#^RELAY_PUBLIC_URL=.*#RELAY_PUBLIC_URL=$URL#" .env
else printf 'RELAY_PUBLIC_URL=%s\n' "$URL" >> .env; fi

# wait until the public URL serves the relay (401 = reachable and auth enforced)
code=""
for _ in $(seq 1 45); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$URL/health" || true)"
  [[ "$code" == "401" ]] && break; sleep 2
done
[[ "$code" == "401" ]] || { echo "public URL not serving the relay yet (last HTTP $code); see logs/tunnel.log"; exit 1; }
echo "public relay reachable (auth enforced)"

python3 -I agent/agentgarden_build.py "$PWD" "$@"
echo "Demo ready. Stop public access afterwards with: ./start-demo.sh --stop"
