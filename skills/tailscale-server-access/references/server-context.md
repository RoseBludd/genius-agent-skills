# Genius Substrates Host — Server Context Map

> Captured **2026-08-05** via live `tailscale ssh` recon. This is the canonical orientation for the box: system, layout, containers, FQDNs, services, firewall, health playbook. Refresh this file when the platform materially changes (major migrations, new apps); resolve container names fresh at runtime (Coolify renames on redeploy).

## Identity

| Field | Value |
|---|---|
| Tailscale name | `genius-substrates-host` |
| Tailscale IP | `<tailnet-ip>` |
| Hostname (on box) | `genius-substrates` |
| OS | Ubuntu 24.04.4 LTS, kernel 6.8.0-136-generic, x86_64 |
| CPU / RAM / Disk | 4 vCPU / 15 GiB (10 GiB used) / 193G root (`/dev/vda1`, 86G free) |
| Docker | 29.7.1 (77 running containers at capture) |
| Load | ~8 sustained at capture (busy box — normal) |
| Provider | DigitalOcean (public IP seen in `.sslip.io` FQDNs: `206.81.14.111`) |

## Directory layout

```
/data
  ├── coolify/          # Coolify instance + all deployed applications
  │   ├── .env          # Coolify instance credentials (docker-compose managed)
  │   ├── applications/<uuid>/   # one dir per app (repo clones, .env, builds)
  │   └── ssh/keys/     # Coolify SSH keys
  ├── infisical/        # compose at docker-compose.yml + .env.example
  ├── maintenance/      # maintenance page (nginx, htpasswd) → maintenance.geniussubstrates.com
  └── mtls/             # mTLS controls: admin-dashboard/, developer-db/, CA/client certs, .infisical-auth
/projects               # bind-mount workspace area (source repos for builds)
/opt
  ├── cadis-dev/        # CADIS dev artifact (Dockerfile etc.)
  ├── genius-automations-sync-bridge/   # sync_bridge.py (host service, port 18787)
  └── genius-ide/       # Coder/genius-ide repo working copy
/root
  ├── scripts/          # issue_client_cert.sh, issue_developer_cert.sh, infisical invite scripts,
  │                     # daily_docker_cleanup.sh, weekly_maintenance.sh, maintenance helpers
  └── (maintenance page password file lives in scripts)
```

## Applications (FQDN → container, verified live)

| FQDN | Container | What it is |
|---|---|---|
| `ide.geniuzs.com` | `icbgr74fd7omamfa9ryfijzs-184925847896` | Genius IDE (Coder-based; CODER_URL, CADIS_API_TOKEN, OPENCODE stack) |
| `chat.geniuzs.com` | `ynuu6714x5m50f42ok769jiu-225434815138` | Genius chat (Open-WebUI lineage; LLM/router, EMBEDDINGS, RUNPOD lanes) |
| `actions.geniuzs.com` | `juziiacybtmd33myzlyysshp-031326541347` | Genius Actions API (Monday/CRM, queue, AWS S3) |
| `app.analyticzs.com` | `web-l135zwr4yfplvjcwe0p7ey0i` | PostHog web (big event-analytics fleet) |
| `www.analyticzs.com`, `analyticzs.com` | `kodbwnbdr3epdbhoozkf3w8z-200826374566` | Analyticzs marketing/app site |
| `www.socialzs.com` | `v34glya4zfzd7jfonktpmfwl-003757048540` | Postiz (social scheduler) |
| `blastzs.com`, `www.blastzs.com` | `cfznwgp1pz177q1mgl5t27ob-020310565920` | Blastzs app (GTM webhook, N8N base) |
| `automations.geniussubstrates.com` | `activepieces-aseh3t5im89kfd1w4xdmeiel` | Activepieces |
| `secrets.geniussubstrates.com` | `backend-wez37tb6lylw37bs2me0j4ja` | Infisical server |
| `sso.geniussubstrates.com` | `ssoready-app-zuaxwvm5bnynpminl5erx9pn` | SSOReady app |
| `sso-admin.geniussubstrates.com` | `ssoready-admin-zuaxwvm5bnynpminl5erx9pn` | SSOReady admin |
| `sso-api.geniussubstrates.com` | `ssoready-api-zuaxwvm5bnynpminl5erx9pn` | SSOReady API |
| `sso-auth.geniussubstrates.com` | `ssoready-auth-zuaxwvm5bnynpminl5erx9pn` | SSOReady auth |
| `compliance.geniussubstrates.com` | `probo-h14pagh5nbfpn5zdnt0dr2vb` | Probo (compliance checks; + seaweedfs, chrome-headless) |
| `hub.geniuzs.com` | `nextcloud-x11opq6rzyxsv7gbxcfm88sm` | Nextcloud |
| `maintenance.geniussubstrates.com` | `odv9qtlf4kbz1f4dnjqhpg84-035459848855` | Maintenance page (nginx + htpasswd) |
| `*.206.81.14.111.sslip.io` | `dg7wt8w8utf3ruzpl08tw52j…`, `eeedwc9e99xtt5ff6e9aubyt…`, `mvh2m5b77eofdoibgcruhu0p…`, `wqobxjrim8g09qb4tetju1j9…` (crewai), `ttcrdgrqbl70kmqffn5bo4xw…` (n8n) | Dev/test apps on sslip.io subdomains |

## Host services & infra containers (Coolify-managed)

- **PostHog fleet** (`*-l135zwr4yfplvjcwe0p7ey0i`): web, worker, capture, feature-flags, plugins, personhog-router/replica, property-defs-rs, recording-api, replay-capture, ingestion-general, ingestion-sessionreplay + backing clickhouse (26.3.10.60), kafka (redpanda v25.1.9), zookeeper 3.7.0, objectstorage (MinIO `RELEASE.2025-04-22T22-12-26Z`), redis7 (7.2-alpine)
- **Databases (postgres proxies)**: db `bibq0e8swnzciy0xtaea73t2` (pg16), `dr1jyv7bced0vee2fl4f8lnl` (pg16), `ee0nkuaszc29054xq5er08be` (pg16, port 5498 via proxy), `kbs57fyvtuf4en9ah4bp7sm0` (pg16), `lyc2lfwfoj8uf3yjkvjor2ok` (pg17, port 5432 via proxy), `mr0g89xhdrvveh8fh8j0b242` (pg16), `pl3chne8isr6e3da9ndlov6j` (pg16, port 5439 via proxy), `r7exd9hbq7t83hpablgdryg4` (pg16), `tqni3q2bdghvgcay9zgzo3k1` (pg16, port 54320 via proxy), `uinn92p323dmlurdzw2rnfs4` (pg16, port 5433 via proxy), `vs27189vuux465w80katpssv` (redis 7.2), `ouz5whxaov7hf2zyx6wrsbv5` (redis 7.2), plus `postgres-h14…` (Probo), activepieces-db, ssoready-db, coolify-db, infisical db (pg14) & redis
- **Coolify core**: `coolify` (4.1.2), `coolify-db` (pg15-alpine), `coolify-proxy` (traefik v3.7.10, ports 80/443 + 8080), `coolify-realtime` (6001/6002), `coolify-redis`, `coolify-sentinel`
- **Custom platform containers**: `admin-dashboard-admin-dashboard-1` (:8788, genius-admin-dashboard → Mission Control), `secret-access-ui-secret-access-ui-1` (genius-secret-access-ui)
- **Infisical**: `backend-wez37tb6lylw37bs2me0j4ja`, `db-wez37tb6lylw37bs2me0j4ja` (pg14), `redis-wez37tb6lylw37bs2me0j4ja`
- **Misc**: `minio-d1gibd7v3h6z875ym5igxqjh` (9000/9001), `nextcloud-x11opq6rzyxsv7gbxcfm88sm`, `otel-collector-qqou2id6a3nn3i5wr2uxvory` (4317/4318), `tailscale-client-gb8eak51vnthtmncskifsp3p`, `nginx-gb8eak51vnthtmncskifsp3p`, `chrome-h14…`, `seaweedfs-*`, `nginix proxy` containers mapped to host ports 5432/5433/5439/5498/54320

## Host-visible ports

| Port | Owner |
|---|---|
| 80 / 443 | Traefik (coolify-proxy) |
| 8080 | via coolify-proxy (app routing port) |
| 8000 | coolify web UI (on-box) |
| 6001/6002 | coolify-realtime |
| 9000/9001 | MinIO |
| 8788 | Mission Control (admin dashboard) |
| 5432/5433/5439/5498/54320 | DB proxy containers (postgres `:80`-style proxies, tailnet-accessible) |
| 4317/4318 | otel-collector (OTLP) |
| 18787 | sync bridge host service (host, not container) |
| 22 | sshd — UFW `LIMIT` (Tailscale SSH is the entry point) |

## Services & maintenance (host-level)

- **Sync bridge**: systemd `genius-automations-sync-bridge.service` → `/usr/bin/python3 /opt/genius-automations-sync-bridge/sync_bridge.py`, env `SYNC_BRIDGE_PORT=18787`. Logs via journalctl. This bridges Genius OS ↔ platform (automation event sync).
- **Cron (root)**:
  - `0 1 * * *` `/root/scripts/daily_docker_cleanup.sh` → `/var/log/genius-docker-cleanup-cron.log`
  - `0 8 * * 0,3` `/root/scripts/weekly_maintenance.sh` → `/var/log/genius-maintenance-cron.log`
- **mTLS**: `/data/mtls` contains CA + issued client certs; issue scripts in `/root/scripts` (`issue_client_cert.sh`, `issue_developer_cert.sh`). Customers/devices (blockzs, dev-adrian, dev-alfredo, dev-enrique, dev-rosebludd, dev-workspace, genius-os-marketing, geniuzs, vibezs-runner) authenticate with mTLS certs.
- **Infisical machine identity**: `/data/mtls/.infisical-auth` (`INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`, `INFISICAL_PROJECT_ID`, `INFISICAL_ENV`) + `INFISICAL_ACCESS_TOKEN` in Mission Control env.
- **Firewall**: UFW active, `22/tcp LIMIT`, Tailscale networks open. Server intentionally hard to reach publicly except through Traefik services.

## Health & recovery playbook

```bash
# overall pulse
tailscale ssh root@<tailnet-ip> 'uptime; df -h / | tail -1; free -h | head -2; docker ps | wc -l'
# Coolify health
tailscale ssh root@<tailnet-ip> 'docker ps --filter name=coolify --format "{{.Names}} {{.Status}}"'
# app down? fqdn table above → restart that container
tailscale ssh root@<tailnet-ip> 'docker restart <container>'
# logs for a container
tailscale ssh root@<tailnet-ip> 'docker logs --tail 100 <container>'
# sync bridge status
tailscale ssh root@<tailnet-ip> 'systemctl status genius-automations-sync-bridge --no-pager; journalctl -u genius-automations-sync-bridge -n 30 --no-pager'
# disk / old images (cleanup is cron-run; do not manually prune -af)
tailscale ssh root@<tailnet-ip> 'docker system df'
# maintenance page toggles
tailscale ssh root@<tailnet-ip> 'bash /root/scripts/weekly_maintenance.sh'   # see script first
```

**If Traefik/coolify-proxy is unhealthy**: restart `coolify-proxy` (it regenerates from Coolify), then verify a public FQDN resolves.

## Refresh recipes

```bash
# refresh FQDN→container table (Coolify renames on redeploy)
for c in $(tailscale ssh root@<tailnet-ip> 'docker ps --format "{{.Names}}"'); do
  v=$(tailscale ssh root@<tailnet-ip> "docker inspect $c --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^COOLIFY_FQDN=' | cut -d= -f2")
  [ -n "$v" ] && echo "$c => $v"
done
# refresh container inventory
tailscale ssh root@<tailnet-ip> 'docker ps --format "{{.Names}}\t{{.Image}}" | sort'
```

## Change log
- 2026-08-05 — Initial context map captured from live recon (2026-08-05, tailscale ssh root@genius-substrates-host).
