#!/usr/bin/env bash
# Renderer entrypoint: Next.js server + Xvfb + password-protected VNC + kiosk Chrome.
# Any child exiting stops the container so the orchestrator can restart it.
set -euo pipefail

: "${VNC_PASSWORD:?VNC_PASSWORD must be set (min 8 chars)}"
if [ "${#VNC_PASSWORD}" -lt 8 ]; then echo "VNC_PASSWORD must be at least 8 characters" >&2; exit 64; fi

SCREEN="${RENDER_SCREEN:-1920x1080x24}"
RENDER_PATH="${RENDER_PATH:-/}"
export DISPLAY=:99

pids=()
cleanup() { kill "${pids[@]}" 2>/dev/null || true; wait || true; }
trap cleanup TERM INT EXIT

Xvfb :99 -screen 0 "$SCREEN" -nolisten tcp &
pids+=($!)
for _ in $(seq 1 50); do xdpyinfo -display :99 >/dev/null 2>&1 && break; sleep 0.1; done

fluxbox >/dev/null 2>&1 &
pids+=($!)

mkdir -p "$HOME/.vnc"
x11vnc -storepasswd "$VNC_PASSWORD" "$HOME/.vnc/passwd" >/dev/null
unset VNC_PASSWORD
x11vnc -display :99 -forever -shared -rfbauth "$HOME/.vnc/passwd" -rfbport 5900 -noxdamage -quiet &
pids+=($!)

npx next start -H 0.0.0.0 -p 3000 &
pids+=($!)
for _ in $(seq 1 120); do
  node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" && break
  sleep 1
done

if [ -e /dev/nvidia0 ] || [ -e /dev/dri/renderD128 ]; then
  GL_FLAGS=(--use-angle=gl-egl --ignore-gpu-blocklist --enable-gpu-rasterization)
  echo "renderer: GPU device present, requesting ANGLE gl-egl"
else
  GL_FLAGS=(--use-angle=swiftshader --enable-unsafe-swiftshader)
  echo "renderer: no GPU device, using SwiftShader software WebGL"
fi

# --no-sandbox: Docker's default seccomp profile blocks Chrome's user-namespace sandbox.
# Chrome runs as the unprivileged app user, and no remote-debugging port is opened.
google-chrome-stable \
  --kiosk "http://127.0.0.1:3000${RENDER_PATH}" \
  --user-data-dir=/tmp/chrome-profile \
  --no-first-run --no-default-browser-check --disable-dev-shm-usage --no-sandbox \
  --window-size="$(echo "$SCREEN" | cut -dx -f1),$(echo "$SCREEN" | cut -dx -f2)" --window-position=0,0 \
  "${GL_FLAGS[@]}" >/tmp/chrome.log 2>&1 &
pids+=($!)

wait -n "${pids[@]}"
echo "renderer: a child process exited; stopping" >&2
exit 1
