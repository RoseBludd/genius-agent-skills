#!/usr/bin/env bash
# check-chat-update.sh
# Compare the deployed chat.geniuzs.com (genius Open WebUI) version against the
# latest upstream open-webui release. If upstream is newer, trigger a Coolify
# redeploy of app ynuu6714x5m50f42ok769jiu (chat-geniuzs). Durable + idempotent.
#
# Requires from caller env: COOLIFY_API_KEY (Coolify on-box token).
# Depends on: tailscale ssh root@<tailnet-ip> (per Skills/tailscale-server-access).
# App: chat-geniuzs, uuid ynuu6714x5m50f42ok769jiu, git-source (RoseBludd/genius-open-webui@master, Dockerfile).
# The Dockerfile bases on ghcr.io/open-webui/open-webui:main, so every redeploy rebuilds on newest upstream.

set -uo pipefail

HOST="<tailnet-ip>"
APP_UUID="ynuu6714x5m50f42ok769jiu"
COOLIFY_CONTAINER_LABEL="coolify.resourceName=chat-geniuzs"

echo "== chat.geniuzs.com auto-update check: $(date -u '+%Y-%m-%dT%H:%M:%SZ') =="

# 1) Current DEPLOYED version (read from the running container's baked package.json)
DEPLOYED=$(tailscale ssh root@${HOST} '
  CID=$(docker ps --filter "label=coolify.resourceName=chat-geniuzs" --format "{{.ID}}" | head -1)
  [ -n "$CID" ] && docker exec "$CID" sh -c "grep -m1 version /app/package.json" 2>/dev/null | tr -d " \t\"," | sed "s/version://"
' 2>/dev/null)
DEPLOYED=${DEPLOYED:-unknown}
echo "deployed version : ${DEPLOYED}"

# 2) Latest UPSTREAM version
UPSTREAM=$(curl -fsSL "https://api.github.com/repos/open-webui/open-webui/releases/latest" 2>/dev/null \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['tag_name'].lstrip('v'))" 2>/dev/null)
UPSTREAM=${UPSTREAM:-unknown}
echo "upstream release : ${UPSTREAM}"

if [[ "$DEPLOYED" == "unknown" || "$UPSTREAM" == "unknown" ]]; then
  echo "RESULT=ERROR one or both versions unknown (deployed=$DEPLOYED upstream=$UPSTREAM); no deploy triggered"
  exit 0
fi

# 3) Normalize numeric comparison
norm() { echo "$1" | awk -F. '{printf "%d%03d%03d", $1, ($2+0), ($3+0)}'; }
D=$(norm "$DEPLOYED"); U=$(norm "$UPSTREAM")

if (( U > D )); then
  echo "update available: ${UPSTREAM} > ${DEPLOYED} -> triggering Coolify redeploy of ${APP_UUID}"

  # 3a) Push a WAL-consistent R2 snapshot of chat state BEFORE the destructive rebuild.
  # Backups live under key chat-geniuzs/<date>.tar.gz in the genius-server-backups R2 bucket.
  echo "pre-deploy backup -> R2 (genius-server-backups)"
  if [ -n "${CLOUDFLARE_S3_API_ENDPOINT:-}" ] && [ -n "${CLOUDFLARE_ACCESS_KEY_ID:-}" ] && [ -n "${CLOUDFLARE_SECRET_ACCESS_KEY:-}" ]; then
    tailscale ssh root@${HOST} "CLOUDFLARE_S3_API_ENDPOINT='${CLOUDFLARE_S3_API_ENDPOINT}' CLOUDFLARE_ACCESS_KEY_ID='${CLOUDFLARE_ACCESS_KEY_ID}' CLOUDFLARE_SECRET_ACCESS_KEY='${CLOUDFLARE_SECRET_ACCESS_KEY}' python3 /home/workspace/Skills/genius-substrates-ops/scripts/backup-chat-db.py"
  else
    echo "  (R2 creds absent -> writing local on-host backup instead)"
    tailscale ssh root@${HOST} "python3 /home/workspace/Skills/genius-substrates-ops/scripts/backup-chat-db.py --local /data/coolify/backups/chatgeniuzs"
  fi

  RESULT=$(tailscale ssh root@${HOST} "curl -s -X POST \"http://localhost:8000/api/v1/deploy?uuid=${APP_UUID}&force=false\" -H \"Authorization: Bearer ${COOLIFY_API_KEY}\"")
  echo "deploy response   : ${RESULT}"
  echo "RESULT=UPDATING deployed=$DEPLOYED -> $UPSTREAM"
else
  echo "RESULT=UP-TO-DATE deployed=$DEPLOYED upstream=$UPSTREAM (no deploy)"
fi
