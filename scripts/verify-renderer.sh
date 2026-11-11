#!/usr/bin/env bash
# Boots the renderer container and checks what this host can prove:
# server health, Chrome alive, VNC password required, ports bound to localhost, a screen capture.
# GPU checks run only when an NVIDIA device is visible.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${VNC_PASSWORD:?set VNC_PASSWORD}"
APP_PORT="${RENDERER_APP_PORT:-3100}"
VNC_PORT="${RENDERER_VNC_PORT:-5900}"
OUT="${RENDERER_SHOT:-renderer-screen.png}"
COMPOSE=(docker compose -f docker-compose.renderer.yml)
if [ "${RENDERER_GPU:-0}" = 1 ]; then COMPOSE+=(-f docker-compose.renderer.gpu.yml); fi
C=brain_lab_renderer
fail() { echo "FAIL: $*" >&2; docker logs --tail 60 "$C" >&2 || true; exit 1; }

if [ "${RENDERER_BUILD:-1}" = 1 ]; then "${COMPOSE[@]}" up -d --build; else "${COMPOSE[@]}" up -d; fi

echo "waiting for /api/health on 127.0.0.1:${APP_PORT}"
code=000
for _ in $(seq 1 180); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/api/health" || true)
  [ "$code" = 200 ] && break
  sleep 1
done
[ "$code" = 200 ] || fail "/api/health returned $code"
echo "PASS /api/health HTTP 200"

for p in 3000 5900; do
  bind=$(docker port "$C" "$p/tcp")
  case "$bind" in 127.0.0.1:*) echo "PASS port $p bound to $bind" ;; *) fail "port $p bound to '$bind', expected 127.0.0.1 only" ;; esac
done
docker port "$C" 9222/tcp >/dev/null 2>&1 && fail "Chrome debugging port 9222 is published"
chrome_cmds() { docker exec "$C" sh -c 'for p in /proc/[0-9]*; do tr "\0" " " < "$p/cmdline" 2>/dev/null; echo; done' | grep '^/opt/google/chrome/chrome' || true; }
chrome_cmds | grep -q -- '--remote-debugging' && fail "Chrome started with remote debugging"
echo "PASS no Chrome debugging port"

sleep "${RENDERER_SETTLE_S:-45}"
chrome_cmds | grep -q -- '--type=gpu-process' || fail "Chrome GPU process is not running"
echo "PASS Chrome running ($(chrome_cmds | grep -o -- '--use-angle=[a-z-]*' | sort -u | tr '\n' ' '))"

python3 - "$VNC_PORT" <<'PY' || fail "VNC does not require a password"
import socket, sys
s = socket.create_connection(("127.0.0.1", int(sys.argv[1])), timeout=10)
ver = s.recv(12); s.sendall(ver)
n = s.recv(1)[0]; types = list(s.recv(n))
print(f"VNC {ver.decode().strip()} security types {types}")
sys.exit(0 if types and 1 not in types and 2 in types else 1)
PY
echo "PASS VNC requires password (no 'None' auth type)"

docker exec "$C" sh -c 'xwd -root -silent -display :99' > /tmp/renderer-screen.xwd
convert /tmp/renderer-screen.xwd "$OUT"
rm -f /tmp/renderer-screen.xwd
echo "PASS screen captured to $OUT"

if docker exec "$C" sh -c 'test -e /dev/nvidia0' 2>/dev/null; then
  docker exec "$C" nvidia-smi || fail "nvidia-smi failed inside container"
else
  echo "SKIP GPU checks: no NVIDIA device visible in the container (software rendering)"
fi
