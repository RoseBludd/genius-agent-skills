---
name: genius-substrates-ops
description: Hands-on operations playbook for the Genius Substrates host (genius-substrates-host, <tailnet-ip>) over Tailscale SSH — installing software, inspecting runtime env vars and secrets, managing Docker and Coolify apps, deploying images/services, and running repeatable maintenance. Use whenever the user wants to "install X on the server", "check an env var", "deploy this", "restart/fix a service", "add a DB/volume/domain", or generally DO something (not just look around) on the VPS. Chains onto Skills/tailscale-server-access (how to get in + the server map) and Skills/genius-substrates-environment (env var names + where secrets live) — read those first.
metadata:
  author: genius.zo.computer
compatibility: Created for Zo Computer
---
# Genius Substrates — Host Operations Playbook

> **Language trigger:** when Juelzs says **"on the server"**, **"on the host"**, **"the VPS"**, or **"our server/host"**, he always means the Genius Substrates production host (`genius-substrates-host`, Tailscale IP `<tailnet-ip>` — Coolify + Infisical + the container substrate) — NOT this Zo sandbox. Reach it ONLY via `tailscale ssh root@<tailnet-ip> 'CMD'`. State plainly what you're doing on the host and just do it — don't narrate the ssh step.

The repeatable **doing** layer for the production host. Access-first skill (`tailscale-server-access`) answers "how do I get in and where are things", and `genius-substrates-environment` answers "what env names exist and where". This one answers "how do I actually perform the common operations" without re-discovering them every session.

## Golden rules (never skip)

1. **There is no public SSH** — the host has no open port 22. ALWAYS use `tailscale ssh root@<tailnet-ip> 'CMD'`. Plain `ssh`/`scp` to that IP will time out (`scp` is included — use `tar | tailscale ssh 'tar -x'` instead of `scp`).
2. **Run** `tailscale status` **first.** If `genius-substrates-host` shows `offline`, it's down — don't retry in a loop.
3. The box runs \~60-77 containers and is busy (load 3-8). Prefer **targeted single commands** over broad sweeps. Never `docker system prune -af`, never delete `/data/mtls` certs, never rotate platform tokens without checking every consumer (see environment-map.md).
4. **Never print secret values** into chat/skills/context. Redact with `sed 's/=.*/=<REDACTED>/'`. Read values in-session via `docker inspect` or the app `.env`; pass them by injecting a local `$ENVVAR` into the SSH command string rather than echoing them.
5. **Container env changes need a Coolify deploy/restart**, not just a file edit — env is baked at container create. Editing `/data/coolify/applications/<uuid>/.env` alone does NOT update a running container.
6. **Build where Docker runs.** This sandbox cannot daemonize Docker (gVisor — `Cannot connect to the Docker daemon`). Build images on the HOST, or push from your local `gh` and reference an image in Coolify.
7. `git`: commit locally as soon as a file is in a working state. Never trust an uncommitted file across a sandbox shutdown. `/home/.z/workspaces/` is scratch and not durable.

## 0. The connection recipe (one-liner for automation)

```bash
tailscale status                       # confirm host node online first
tailscale ssh root@<tailnet-ip> 'CMD' # single command (preferred)
tailscale ssh root@<tailnet-ip>       # interactive shell if truly needed
```

Hostname `genius-substrates-host` and IP `<tailnet-ip>` both resolve. For getting local files TO the host without `scp` (which times out), pipe over the SSH session:

```bash
cat ./file.tgz | tailscale ssh root@<tailnet-ip> 'mkdir -p /projects/x && tar xzf - -C /projects/x'
```

## 1. Installing software on the host

The host is Ubuntu 24.04, root, systemd-less control plane (no systemd in this sandbox). Installs are for the host's own OS userspace, or for adding services/containers.

```bash
# apt (host userspace)
tailscale ssh root@<tailnet-ip> 'apt-get update -y && apt-get install -y <pkg>'

# Confirm it landed
tailscale ssh root@<tailnet-ip> 'which <pkg>; <pkg> --version 2>&1 | head -1'

# A CLI tool you need only in one session? Install it ON the host (not locally)
tailscale ssh root@<tailnet-ip> 'curl -fsSL <installer-url> | bash'
```

**Check what's already there** before installing (avoid duplicates / version conflicts):

```bash
tailscale ssh root@<tailnet-ip> 'which <tool>; <tool> --version 2>&1 | head -1; docker ps --format "{{.Names}}"'
```

## 2. Checking / setting runtime env vars (the "NV variables" case)

Env vars live in three places depending on scope:

### a) A running Coolify-managed container

```bash
# NAMES (safe) and VALUES (in-session only) for one container
tailscale ssh root@<tailnet-ip> 'docker inspect <container> --format "{{range .Config.Env}}{{println .}}{{end}}" | sed "s/=.*/=<REDACTED>/"'
# specific key value (read in-session, don't paste to chat)
tailscale ssh root@<tailnet-ip> 'docker inspect <container> --format "{{range .Config.Env}}{{.}}{{println}}{{end}}" | grep ^KEY='
```

### b) Coolify app-level env file

App env files live at `/data/coolify/applications/<cpuuid>/.env`. NOTE: Coolify generates these at container create/start. Read names to confirm wiring:

```bash
tailscale ssh root@<tailnet-ip> 'cut -d= -f1 /data/coolify/applications/<uuid>/.env | grep -vE "^#|^$"'
```

### c) Setting env on a deployed app (the correct way)

Use the Coolify API on-box (`:8000`, `Authorization: Bearer $COOLIFY_API_KEY`) — do NOT hand-edit a `.env`. Set/overwrite via `envs/bulk`:

```bash
tailscale ssh root@<tailnet-ip> 'B="Authorization: Bearer '"$COOLIFY_API_KEY"'"
DATA='"'"'[{"key":"FOO","value":"bar","is_literal":false}]'"'"'
curl -s -X PATCH "http://localhost:8000/api/v1/applications/<cpuuid>/envs/bulk" -H "$B" -H "Content-Type: application/json" -d "{\"data\":$DATA}"'
```

Then trigger a redeploy (session 3 / section 4) so the container picks it up. **Use** `is_literal:false` for clean values — `is_literal:true` wraps the value in literal single quotes (`real_value` becomes `'value'`).

### d) Secrets that are values-only in Infisical / Zo Secrets

Reference env **names** from `file Skills/genius-substrates-environment/references/environment-map.md`. Read values at runtime from the vault via Infisical universal-auth on the host (`/data/mtls/admin-dashboard/.env` → `INFISICAL_CLIENT_ID/SECRET` → `POST /api/v1/auth/universal-auth/login`), or from a container's env. Never persist raw values in this skill.

## 3. Docker management (common ops)

```bash
# inventory
tailscale ssh root@<tailnet-ip> 'docker ps --format "table {{.Names}}\t{{.Status}}"' | head -30

# a container's logs
tailscale ssh root@<tailnet-ip> 'docker logs --tail 100 <container>'

# restart one app (verify FQDN after)
tailscale ssh root@<tailnet-ip> 'docker restart <container>'

# health pulse
tailscale ssh root@<tailnet-ip> 'uptime; free -h | head -2; df -h / | tail -1; docker ps | wc -l'
```

**Never:** `docker system prune -af`, delete `/data/mtls` certs, or rotate platform tokens without checking every consumer.

## 4. Deploying an app via Coolify (image-based)

This is the pattern used to put an app on the production host:

1. **Get the source onto the host** (or build on the host). E.g. piped tar, or clone.

2. **Build + push an image from the host** (host has Docker; sandbox can't daemonize).

   ```bash
   # on the host:
   docker build -t <user>/<app>:latest .
   docker login --username "$(grep ^DOCKER_HUB_USERNAME= <env> | cut -d= -f2-)" --password-stdin
   docker tag <user>/<app>:latest $U/<app>:latest && docker push $U/<app>:latest
   ```

3. **Create the Coolify app** (dockerimage build pack) via on-box API. Requires `project_uuid`, `server_uuid` (= `m13crjk7d6lqibybc7rnbnv7`), `environment_name`, `name`, `ports_exposes`, `domains`, `docker_registry_image_name/tag`.

   ```bash
   curl -s -X POST "http://localhost:8000/api/v1/applications/dockerimage" -H "$B" -H "Content-Type: application/json" -d '{...}'
   ```

4. **Set env vars** (section 2c), **add persistent storage for anything stateful** (`POST /applications/<cpuuid>/storages` with `{"type":"persistent","mount_path":"/path"}`).

5. **Deploy**:

   ```bash
   curl -s -X POST "http://localhost:8000/api/v1/deploy?uuid=<cpuuid>&force=false" -H "$B"
   ```

   > Endpoint is `POST /deploy?uuid=` — NOT `/deployments` (that's the list endpoint).

6. **Verify**: `docker ps` shows a `<cpuuid>-<number>` container; check `docker logs`; curl the public FQDN (HTTPS over the host's Traefik).

For source-linked (git) deploys you'd need a GitHub source key in Coolify — not configured here; image deploys are the working path.

## 5. DNS / public URL pattern

The host's Traefik serves any FQDN. A `*.206.81.14.111.sslip.io` subdomain resolves to the host with no DNS change and gets a Let's Encrypt cert automatically — ideal for a "give me a URL now" deploy (e.g. `https://<name>.206.81.14.111.sslip.io`). For a clean `geniuzs.com` subdomain you must add a Cloudflare DNS record (A → host IP, proxied). The Cloudflare DNS token available here did not authenticate in the last session; locate a valid value (Infisical `genius_substrates` project / Zo Secrets) before attempting clean-domain adds. **Always report the concrete public URL after deploying** so the user can interact with it.

## 6. Files/directories that matter

```bash
/data/coolify                  # every deployed app: /data/coolify/applications/<uuid>/
/data/mtls                     # mTLS certs, Mission Control, studio identities (NEVER delete)
/data/mtls/admin-dashboard/.env # Mission Control platform tokens (Coolify/Infisical/DO/Tailscale)
/data/mtls/.infisical-auth      # Infisical machine identity (CLIENT_ID/SECRET/PROJECT_ID/ENV)
/projects                      # bind-mount source area (this is where I staged sis-deploy)
```

Credentials: see `file Skills/genius-substrates-environment/references/environment-map.md` for names, never values.

## 7. Ops recipe cheat-sheet

| Task | One-liner |
| --- | --- |
| Health pulse | `tailscale ssh root@<tailnet-ip> 'uptime; free -h | head -2; df -h / | tail -1; docker ps | wc -l'` |
| Is app X up | `tailscale ssh root@<tailnet-ip> 'docker ps --filter name=<c> --format "{{.Status}}"'` |
| Logs | `tailscale ssh root@<tailnet-ip> 'docker logs --tail 50 <c>'` |
| Install pkg | `tailscale ssh root@<tailnet-ip> 'apt-get update -y && apt-get install -y <pkg>'` |
| Env names (container) | `tailscale ssh root@<tailnet-ip> 'docker inspect <c> --format "{{range .Config.Env}}{{println .}}{{end}}" | sed "s/=.*/=<REDACTED>/"'` |
| Coolify API version | `tailscale ssh root@<tailnet-ip> 'curl -s http://localhost:8000/api/v1/version -H "Authorization: Bearer '"$COOLIFY_API_KEY"'"'` |
| Create app (dockerimage) | POST `/api/v1/applications/dockerimage` (see §4) |
| Deploy app | `POST /api/v1/deploy?uuid=<cpuuid>` |
| Set env | PATCH `/api/v1/applications/<cpuuid>/envs/bulk` with `is_literal:false` |
| Persistent volume | POST `/api/v1/applications/<cpuuid>/storages` `{"type":"persistent","mount_path":"/…"}` |

## 8. Change log

- 2026-08-16 — Created. Captured the working Tailscale-SSH access (sandbox's plain `ssh`/`scp` to port 22 times out; `tailscale ssh` is the only path), the host-build + Docker-Hub-push + Coolify-`/deploy` image deploy pattern, the `envs/bulk` is_literal quoting gotcha, and the `*.sslip.io` public-URL shortcut — all from the live SIS migration.