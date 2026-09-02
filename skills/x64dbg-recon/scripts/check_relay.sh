#!/usr/bin/env bash
# Health check for the x64dbg MCP relay on genius-substrates-host (<tailnet-ip>:50301).
# This sandbox has no tailscale tun route, so we proxy through `tailscale ssh`.
# Real tailnet nodes (Windows VM, PC) can hit http://<tailnet-ip>:50301 directly.
set -u
HOST="root@<tailnet-ip>"
PORT=50301

echo "== relay service =="
tailscale ssh "$HOST" "systemctl is-active x64dbg-relay; curl -s -m 5 http://127.0.0.1:$PORT/api/status; echo"

echo "== direct tailnet reachability (expected to FAIL from this sandbox) =="
if curl -s -m 4 "http://<tailnet-ip>:$PORT/api/status"; then
  echo "direct: OK"
else
  echo "direct: unreachable from sandbox (userspace tailscale — use the proxied result above)"
fi
