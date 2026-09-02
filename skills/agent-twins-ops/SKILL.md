---
name: agent-twins-ops
description: Operate the Genius Substrates agent twins on the VPS (genius-substrates-host) — list automations, run them on demand, read R2 reports and mailbox traffic. Use when checking twin automation health, firing automations manually, or verifying twin reports.
compatibility: Requires Tailscale SSH to genius-substrates-host (<tailnet-ip>); host bun at /root/.bun/bin/bun; runtime repo at /opt/agent-twins (systemd agent-twins.service, port 3340).
metadata:
  author: genius.zo.computer
---

# Agent Twins Ops

The twins runtime is host-native systemd `agent-twins.service` (port 3340, cwd `/opt/agent-twins`) hosting 8 twins (archy, devvy, genius, oppi, sec, simmy, sims, vigil). Automations are per-twin manifests in R2 at `twins/<name>/automations/<automation>/automation.json` (cron schedule + prompt). Reports land in R2 `reports/`; agent-to-agent mail in R2 `mailbox/` + `inbox/<twin>/`.

## Usage

Scripts run on the HOST via `bun` with the runtime's env (R2 creds in `/opt/agent-twins/.env`):
```bash
base64 -w0 <script> | tailscale ssh root@<tailnet-ip> 'base64 -d > /tmp/ops.ts && cd /opt/agent-twins && set -a && source .env && set +a && /root/.bun/bin/bun /tmp/ops.ts <cmd>'
```

Subcommands:
- `list` — all automation manifests: twin/automation, enabled, cron, lastRun
- `run-all [parallel=4]` — fire every enabled automation via POST /ask/<twin> (session `automation:<name>`)
- `run <twin> <automation>` — fire one automation by name
- `reports` — newest R2 `reports/` keys with sizes/dates
- `mailbox` — newest R2 `mailbox/` traffic

## Rules
- R2 bucket `genius-agent-twins` is the source of truth; never push twin configs without reading current state first.
- `run-all` fires REAL jobs (repo scans, credit watches, cert hygiene, product sweeps). Confirm with the user before firing outside a test.
- Single-instance invariant: `agent-twins.service` is canonical. Never start the docker compose duplicate (EADDRINUSE crash loop + double scheduler fires).
- The in-process minute-tick scheduler is optimal: schedules are minute-granularity crons, dedupe is via `lastRun`, and a coarser tick would delay schedules like `54 8-23 * * *`.
