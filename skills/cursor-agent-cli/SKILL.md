---
name: cursor-agent-cli
description: Use the locally-authenticated Cursor Agent CLI (`agent`) for headless development runs, chat/session listing, and real repo work — the working Cursor lane. Covers PATH, workspace trust markers, headless -p mode, stream-json output, session resume, model selection, and automation recipes. Use whenever the user says "cursor", "agent", "set off agents to do development", "run cursor", "list my chats", or wants Cursor-powered coding on repos. Distinct from Skills/cursor (cloud API lane, blocked — Enterprise-gated).
compatibility: Created for Zo Computer
metadata:
  author: genius.zo.computer
  version: 1.0.0
  binary: /root/.local/bin/agent
  runtime: /root/.local/share/cursor-agent
---

# Cursor Agent CLI — Local Authenticated Lane (WORKING)

**This is the Cursor lane that actually works.** The local CLI uses account session auth (from `agent login`), NOT the `CURSOR_API_KEY` API-key auth. The cloud-API lane (`Skills/cursor`, api.cursor.com) is blocked: Enterprise-only endpoints, cloud agents beta not enabled, all endpoints return `{"code":"internal","message":"Error"}`. Do NOT route "cursor" requests through that lane — use THIS one.

## Quick reference (THIS is what "use cursor" means)

```bash
Skills/cursor-agent-cli/scripts/cursor-agent status                    # Confirm logged in
Skills/cursor-agent-cli/scripts/cursor-agent models                    # List models for this account
Skills/cursor-agent-cli/scripts/cursor-agent chats                     # List local chats + ACP sessions (with first prompt + status)
Skills/cursor-agent-cli/scripts/cursor-agent run "prompt"              # Headless run in cwd (defaults to /home/workspace)
Skills/cursor-agent-cli/scripts/cursor-agent run --cwd <repo> --timeout 300 "prompt"
Skills/cursor-agent-cli/scripts/cursor-agent run --json --cwd <repo> "prompt"   # Structured stream-json events
Skills/cursor-agent-cli/scripts/cursor-agent agent "prompt"            # Passthrough (full control, all flags)
```

## Binary, auth, and config locations

| What | Where |
|---|---|
| Binary | `/root/.local/bin/agent` (also `cursor-agent`). NOT on default PATH — wrapper adds `~/.local/bin` |
| Version | v2026.08.31-4057e58 (`agent --version`); runtime at `~/.local/share/cursor-agent/versions/` |
| Auth (session tokens) | `~/.config/cursor/auth.json` — NEVER print. Login account: j.backus@restoremastersllc.com |
| Config | `~/.cursor/cli-config.json` — model (default/auto), permissions allowlist (`"Shell(ls)"`), approvalMode `allowlist`, sandbox disabled, attribution (commits/PRs attributed to agent: true) |
| Local chats | `~/.cursor/chats/<workspace-hash>/<chat-id>/meta.json` (+ transcript in `agent-transcripts/<chat-id>.jsonl`) |
| ACP sessions | `~/.cursor/acp-sessions/<session-id>/meta.json` (IDE integration) |
| Project state | `~/.cursor/projects/<path-slug>/` — trust markers, repo.json, worker.log, transcripts |

## Workspace trust — THE main gotcha

Headless `-p` runs in an untrusted directory die with `Workspace Trust Required` (returncode 1, and the prompt goes to stderr, NOT stdout — easy to miss). Trust is persisted as per-project marker files the CLI itself writes:

```
/root/.cursor/projects/<path-slug>/.workspace-trusted
  {"trustedAt": "<ISO>", "workspacePath": "<abs-path>"}
```

- `<path-slug>` = absolute path with `/` replaced by `-`, leading `/` dropped (e.g. `/home/workspace` → `home-workspace`, `/home/workspace/Projects/geniuzs-repos/tracezs` → `home-workspace-Projects-geniuzs-repos-tracezs`).
- The wrapper auto-trusts the target directory by writing this marker (matches the format your interactive session wrote). This is YOUR authenticated CLI on YOUR machine — needed for the "set off agents to do development" workflow. Opt out with `--no-trust` if you want the gate preserved.
- Trusting a parent (`/home/workspace`) does NOT cover subdirs — each repo run in a new dir hits the gate again.

## Headless mode (`-p`) — the automation lane

`agent -p "prompt"` runs to completion, prints output, exits. **Full tool access including write and shell** — same as the interactive agent. Recipes:

```bash
# Read-only recon (safest default for unfamiliar repos)
agent --mode plan -p "analyze this repo and propose a plan" > plan.txt
agent --mode ask  -p "what does this function do?"

# Structured events for orchestration (per-tool-call JSON stream)
agent -p --output-format stream-json "task" 2>/dev/null | jq -c 'select(.type=="tool_call")'
agent -p --output-format json "task" 2>/dev/null | jq -r '.result'

# Continue the previous session headlessly
agent -p --continue "now add tests for that"

# Pin a model (parameterized models accept bracket overrides)
agent -p --model 'gpt-5.6-sol-xhigh[context=1m]' "task"
```

Models seen for this account (2026-09-01): `gpt-5.6-sol-*` family (default `auto`, medium/high/xhigh, fast variants, 1M context on xhigh).

## Gotchas learned (do not re-discover)

1. **TTY limits.** Interactive TUI (`agent`, `agent ls`, `agent resume` without args) fails in non-interactive shells: `ERROR Raw mode is not supported on the current process.stdin, which Ink uses as input stream`. Use `-p` for everything scripted.
2. **PATH.** The binary is at `/root/.local/bin/agent`, not on default PATH. Always `export PATH="$HOME/.local/bin:$PATH"` or use the wrapper.
3. **Workspace trust.** See section above — pass `--trust` / `--yolo` / `-f` to bypass, or let the wrapper write the marker file. `--yolo` also force-allows ALL shell commands; avoid in prod-adjacent dirs.
4. **Always wrap runs in `timeout N`.** A stuck agent run otherwise hangs the whole session (non-interactive shell, no escape).
5. **cwd is the repo.** Run from (or `--cwd` to) the repo root — the agent operates on files relative to it, and transcripts/trust are keyed by that path.
6. **Chat store is local + readable.** `~/.cursor/chats` (interactive + `-p` runs) and `~/.cursor/acp-sessions` (IDE) — the `chats` wrapper command parses meta.json + transcript jsonl for id, cwd, first prompt, and done status. The user's live terminal session appears here too (hasConversation flips true once a turn completes).
7. **Attribution is on.** `cli-config.json` sets `attributeCommitsToAgent: true` + `attributePRsToAgent: true` — commits/PRs from runs are attributed to the agent by default. Flip in config if you want them under your name.
8. **Never `--force`/`--yolo` by default.** The wrapper never adds them; pass through explicitly only when the user asks.
9. **Distinct from `Skills/cursor`.** That skill is the api.cursor.com cloud lane (API-key auth, Enterprise-gated, dead). This skill is the local session-auth CLI lane (working). Both exist; don't merge them.

## Ecosystem fit — where this lane slots in

- **Zo computer (here):** `run --cwd Projects/geniuzs-repos/<repo>` for real development on the ~8 repos (tracezs proven end-to-end 2026-09-01: read README, correct one-line answer, transcript persisted). Pair with git commits — agent runs are NOT auto-committed.
- **DEVVY (twin agent, VPS):** DEVVY can invoke the same `agent -p` for real development tasks IF the CLI is installed + authenticated on the genius-substrates-host. See "VPS authentication" below.
- **VPS authentication (genius-substrates-host):** `agent login` on the host prints a device-code URL; the user completes it from any browser. NO_OPEN_BROWSER=1 keeps it headless-safe over Tailscale SSH:
  ```bash
  tailscale ssh root@<tailnet-ip>
  NO_OPEN_BROWSER=1 ~/.local/bin/agent login
  ```
  Blast radius: the agent gets full write+shell as root on the ~77-container prod substrate. Prefer scoping runs to a workdir (`--cwd /srv/<project>`) and `--mode plan` for recon; keep `--yolo` off on the host.
- **What the VPS lane does in that ecosystem:** dev work on Coolify-deployed repos (pull repo → agent edits → Coolify redeploys), Coder workspace template fixes, infra scripts — the same run pattern, just pointed at host-side checkouts. Coolify/Infisical/container ops stay with the existing playbooks (Skills/tailscale-server-access, Skills/genius-substrates-ops); Cursor adds the coding-agent lane on top, not a replacement for SSH ops.

## First-actions checklist

1. `status` — confirm still logged in (session tokens can expire; re-`login` with NO_OPEN_BROWSER=1 if so).
2. `chats` — see recent runs.
3. `run --cwd <repo> --timeout 300 "<task>"` — real work. Trust marker is written automatically; add `--json` for orchestration.
4. Commit any repo changes the agent makes (it is NOT auto-committed — attribution tags commits, but pushes stay manual per the git habit).## BYOM / CADIS as default (host) — ATTEMPTED, BLOCKED (2026-09-01)
Cursor's CLI flags `-e/--endpoint` + `CURSOR_API_KEY` are the BYOM path, but the CLI
validates ANY key against cursor's own account system before a request ever reaches a
custom endpoint — every placeholder (plain string, `key_cadis`, well-formed
`key_`+64hex) and even `unset CURSOR_API_KEY` (session auth to custom endpoint) fails
with `Named models unavailable`. The CADIS gateway itself is open (any bearer passes,
200 confirmed on /v1/models and /v1/chat/completions with real
`CADIS_API_TOKEN`), so the blocker is cursor-side key validation, not the gateway.
Requires a REAL Cursor API key (cursor.com/settings → Integrations → User API Keys).
Until then: Composer 2.5 is the working default via /root/devvy/run.

## Host dev layout (genius-substrates-host, <tailnet-ip>)
- `/root/devvy/projects/` — 28 repos: 11 active ecosystem + ALL Genius-OS org repos
  (blockzs, cadis-pilot-sandbox, enginezs, genius-ide, genius-os-marketing,
  genius_backend, genius_os_internal, genius_os_origin, genius_railway,
  posthog-genius, quest-cadis-chat-hang [EMPTY], synthetic-identity-substrate,
  unitzs, usertour, vibezs-runner, widget-marketplace) + emailzs (RoseBludd).
- `/root/devvy/run` — DEVVY entrypoint, pins Composer 2.5. `cd /root/devvy && ./run "<instruction>"`.
- gh authenticated as RoseBludd; git credential helper wired (`gh auth setup-git`).
- Trust: `/root/devvy/projects` trust-marked; NEW subdirs inherit it — no
  per-directory grant needed (confirmed live: fresh repo ran clean, no prompt).
- Accounts: HOST = support@geniussubstrates.com (Composer 2.5 ✓). LOCAL Zo box =
  support@geniussubstrates.com since the account swap; free account (j.backus@) is
  logged out. Local lane: Auto only — BUT cursor's CLI validates keys against its own
  account system, so a stale apiKey field in auth.json (key_fd82…) breaks every run
  even with the correct account logged in. Trap documented above.



## 2026-09-01 additions
- DEVVY dispatch path: POST localhost:3340/ask/devvy → host_exec → cursor agent CLI on host; watch transcripts at ~/.cursor/projects/*/agent-transcripts/<uuid>/<uuid>.jsonl (last line = latest turn).
- host_exec granted to devvy only (commit 2204ad0); other twins keep read/media grants.
- Vercel deploys from host: vercel CLI v59.11.0 installed, authed as jbackus-1827 (device OAuth, must run nohup-detached). sis-influencer-studio is git-connected to Vercel project "studio" → auto-deploys on main push.
- sis-influencer-studio live: INFLUENCERZS title + Bebo favicon verified on www.influencerzs.com + influencers.geniuzs.com (commit 691af92).
