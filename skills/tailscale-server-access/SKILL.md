---
name: tailscale-server-access
description: Securely access the Genius Substrates tailnet over Tailscale SSH — the production host (genius-substrates-host, <tailnet-ip>: Coolify/Infisical/mTLS/Probo) AND the Zo computer (genius-zo-computer, 100.117.236.68: Coder, Genius IDE, CADIS gate/adapter, chatd, supermemory, ollama). Use whenever the user says "access the server", "on the server", "ssh to the host", "the genius substrates host", or needs CADIS/Coder/Genius-IDE operations on the Zo computer. Bundles a full server context map so navigation needs no re-discovery.
metadata:
  author: genius.zo.computer
compatibility: Created for Zo Computer
---

# Tailscale SSH — Genius Substrates Host

**Tailscale SSH is THE access path to the user's machines — two tailnet nodes, one pattern.** Neither node has a public SSH entry point (host port 22 is UFW-LIMIT'd for maintenance only); both are reached over the tailnet, and this sandbox is already on it as `genius-zo-computer`. So access is one command:

```bash
tailscale ssh root@<tailnet-ip>     # host (genius-substrates-host)
```

Two tailnet nodes, one pattern — pick the target by task:

| Node | IP | What runs there | When to use |
|---|---|---|---|
| **genius-substrates-host** | `<tailnet-ip>` | Production server: Coolify, Infisical vault, mTLS/Genius DB, Probo compliance, ~77-container substrate | "access the server" / any host task |
| **genius-zo-computer** | `100.117.236.68` | THIS machine. Coder control plane (coderd `:7080`), Genius IDE (`:3088`), CADIS gate (`:7070`), CADIS openai-adapter, chatd, supermemory (`:6767`), ollama (`:11434`), next/frpc stack. Tailscale `RunSSH: true` — inbound SSH works identically to the host | CADIS / Coder / Genius IDE / AI-stack work |

> You (the agent) RUN INSIDE the Zo computer. Do NOT SSH into `100.117.236.68` from a session you're already in — that's self-hopping; operate it directly (root local shell + localhost ports). The node entry exists for inter-node access (e.g. from the host or another tailnet machine): `tailscale ssh root@100.117.236.68` works the same way as the host.

> Hostnames `genius-substrates-host` and `genius-zo-computer` also resolve (use either). Tailscale-only: SSH works when `tailscale status` shows the node online.

## Quick reference (THIS is what "access the server" means)

```bash
# one-liner (preferred for automation — never open a shell)
tailscale ssh root@<tailnet-ip> 'COMMAND...'

# interactive shell if a session is genuinely needed
tailscale ssh root@<tailnet-ip>

# common checks
tailscale ssh root@<tailnet-ip> 'uptime; docker ps | wc -l; docker ps --format "{{.Names}} {{.Status}}" | head -20'
tailscale ssh root@<tailnet-ip> 'docker logs --tail 100 <container>'
tailscale ssh root@<tailnet-ip> 'systemctl status genius-automations-sync-bridge --no-pager'
```

## Before you connect

1. **Always run `tailscale status` first** — confirm the tailnet is up and the target node (`genius-substrates-host` `<tailnet-ip>` or `genius-zo-computer` `100.117.236.68`) is online. If the daemon is down: `tailscale up`; if the node shows `offline`, it's down (do not spam retries).
2. Known hosts are already populated (`~/.ssh/known_hosts`). If a "host key changed" warning appears, do NOT bypass it — stop and report, something changed.
3. The box runs ~77 containers and is chronically busy (load 8+). Prefer targeted single commands over broad sweeps; avoid `docker prune` / destructive ops unless explicitly allowed (platform has cron for that).

## Where to go once you're in (map lives here)

`references/server-context.md` is the canonical orientation file — system spec, directory layout, **FQDN→container table** (ide.geniuzs.com, chat.geniuzs.com, actions.geniuzs.com, analyticzs posthog fleet, socialzs, blastzs, automations/activepieces, secrets/infisical, sso/*, compliance/probo, hub nextcloud, maintenance page, sslip.io dev apps), host services (sync bridge :18787, Mission Control :8788), ports, cron (docker cleanup 1am, weekly maintenance Sun/Wed 8am), mTLS layout, and a health/recovery playbook.

**Read `references/server-context.md` when you first connect in a fresh session** — it replaces re-discovery. Refresh it (dated change-log) whenever the platform materially changes.

## Environment & secrets (use the sibling skill)

`Skills/genius-substrates-environment/SKILL.md` + `references/environment-map.md` index every env var **name** across all containers, the Infisical vault (`secrets.geniussubstrates.com`), Coolify env files (`/data/coolify/applications/<uuid>/.env`), and the storage inventory. **Rules: never persist raw secret values into skills/context/chat; redact with `sed 's/=.*/=<REDACTED>/'`; read values in-session via `docker inspect`; env changes need a Coolify redeploy, not just a file edit.**

## Playbooks

- **Health check** → `tailscale ssh root@<tailnet-ip> 'uptime; free -h | head -2; df -h / | tail -1; docker ps | wc -l'`
- **"Is X app up?"** → look up container in `references/server-context.md` → `docker ps --filter name=<container> --format "{{.Status}}"` → `docker logs --tail 50 <container>`
- **"Fix/restart X"** → restart the mapped container; verify FQDN responds; only touch coolify-proxy if routing is broken.
- **Maintenance/secret access** → Mission Control (`:8788`) and Secret Access UI via their FQDNs; vault via `secrets.geniussubstrates.com`.
- **Never** run `docker system prune -af`, never remove `/data/mtls` certs, never rotate platform tokens without checking every consumer in the env map.

## Change log
- 2026-08-05 — Created with verified connectivity (tailscale 1.102.1, `tailscale ssh root@<tailnet-ip>` OK) + full server context map captured.
- 2026-08-06 — Added the **Zo computer** node (`genius-zo-computer` / `100.117.236.68`): verified `tailscale status` shows it active/direct, `RunSSH: true`, sshd on `:2288` with substrate `authorized_keys`; coderd `:7080`, Genius IDE `:3088`, CADIS gate `:7070`, adapter, chatd, supermemory `:6767`, ollama `:11434` confirmed running locally. Documented the self-access rule (operate the Zo computer directly — you live on it).
