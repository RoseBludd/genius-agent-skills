# Genius Agent Skills

Ops and infrastructure skills for the Genius Substrates agent fleet (AgentConnect on
`genius-substrates-host`), published as an AgentConnect skill source.

Layout: `skills/<skill-name>/SKILL.md` (Agent Skills spec). Secret values are never stored here —
skills read credentials from environment variables on the host.

| Skill | Purpose |
| --- | --- |
| `tailscale-server-access` | Reaching the production host (Tailscale SSH only; no public SSH) |
| `genius-substrates-environment` | Environment map: services, ports, env var names, Infisical layout |
| `genius-substrates-ops` | Operations playbook: backups, updates, DB access, service checks |
| `agent-twins-ops` | Operating the agent twins (automations, R2 reports, mailbox) |
| `runpod-media-engine` | RunPod GPU lanes (4DGS, ComfyUI) management |
| `cloudflare-cadis-worker` | Cloudflare Workers AI / CADIS worker lane |
| `cursor-agent-cli` | Driving the cursor-agent twin CLI |
| `x64dbg-recon` | x64dbg reverse-engineering relay lane (tailnet-only MCP) |
| `mcp-builder` | Building MCP servers |
| `mcporter` | MCP tooling utilities |

 IPs are placeholders (`<tailnet-ip>`) — resolve via Tailscale by hostname.
