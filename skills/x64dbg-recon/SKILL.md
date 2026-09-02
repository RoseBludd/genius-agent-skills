---
name: x64dbg-recon
description: Operate the x64dbg MCP recon lane — remote Windows debugging via the reverse-connect relay on genius-substrates-host. Use when dispatching recon agents, checking relay health, connecting an MCP client (Cursor / Zo), or setting up a new Windows x64dbg session.
compatibility: Created for Zo Computer
metadata:
  author: genius.zo.computer
---

# x64dbg Recon Lane

Give AI agents eyes inside a running Windows process: read/write memory, registers,
breakpoints, call stacks, disassembly, Scylla dumps, DLL injection — all through MCP.

## Topology (deployed 2026-09-02)

```
Cursor / Zo agents ──MCP/SSE──► Rust relay (VPS <tailnet-ip>:50301) ◄──HTTP poll/push── x64dbg plugin (Windows VM)
```

| Component | Location | Notes |
|---|---|---|
| Relay server (`relay-server`) | VPS `genius-substrates-host` (Tailscale <tailnet-ip>), systemd unit `x64dbg-relay.service` | Built from atericparker/x64dbg-remote-mcp `relay-server/`, binary at `/opt/x64dbg-relay/relay-server/target/release/relay-server` |
| Relay token | VPS `/opt/x64dbg-relay/.env` (`RELAY_TOKEN=`) | **Never print in chat.** Read on the VPS when needed |
| ufw rule | tailnet-only: `allow in on tailscale0 to any port 50301` | Public IP 206.81.14.111:50301 is blocked (verified) |
| Plugin (Windows side) | x64dbg plugin, Windows VM (`genius-ext-001` or any tailnet-joined Windows box) | See `references/setup-windows.md` |

The Windows VM does NOT need to be reachable — it dials OUT to the relay (`StartReverseMode`),
so NAT'd VMs work. The VM must be able to reach `http://<tailnet-ip>:50301` (join tailnet,
or any outbound route to it).

## Health check

```bash
bash Skills/x64dbg-recon/scripts/check_relay.sh
```

Returns relay status JSON (`active_sessions`, `pending_commands`). From this sandbox the
direct 100.x route does not work (userspace tailscale, no tun) — the script uses the
`tailscale ssh` proxy path. Real tailnet nodes (Windows VM, PC with Cursor) connect directly.

## MCP client connection

- Endpoint: `http://<tailnet-ip>:50301/sse/` (SSE) with `POST /message?sessionId=...`
- **Cursor** (`~/.cursor/mcp.json` or project `.cursor/mcp.json`):
  ```json
  { "mcpServers": { "x64dbg-recon": { "url": "http://<tailnet-ip>:50301/sse" } } }
  ```
- The relay forwards to whichever x64dbg session has run `StartReverseMode` (see Windows setup).

## Dispatching a recon task (agent prompt pattern)

1. Verify relay up: `bash Skills/x64dbg-recon/scripts/check_relay.sh`
2. Instruct the client agent (Cursor, or a Zo-dispatched twin) with the recon goal, e.g.:
   "Attach to PID/target, list modules, find the IAT entry for QueryPerformanceCounter,
   set a breakpoint, report call frequency and module base." Tools include:
   memory read/write, registers, threads, breakpoints, disassembly, module list,
   `StartReverseMode`/`StopReverseMode`/`ReverseModeStatus`, `UploadAndDebug`,
   `UploadAndRun`, `UploadDllAndInject`, `ScyllaDumpToHost`, `MemoryDumpToHost`,
   `ListHostUploads`/`ListHostDownloads`.
3. Files staged for the VM go in the relay's uploads dir: VPS `/opt/x64dbg-relay/uploads/`
   (create it if missing); dumps land in `/opt/x64dbg-relay/downloads/`.

## Rules & constraints

- Windows-only plugin (x64dbg/.NET Framework). Everything Linux-side is the relay.
- License: AgentSmithers original has no LICENSE (all rights reserved); the atericparker
  fork relay-server crate is MIT. Integration stays across the MCP protocol boundary —
  do not vendor plugin code into other projects.
- Service ops: `systemctl restart x64dbg-relay`, logs via `journalctl -u x64dbg-relay`.
- Rebuild (after upstream changes): source at VPS `/opt/x64dbg-relay/relay-server/`,
  `docker run --rm -v /opt/x64dbg-relay:/src -w /src/relay-server rust:1-slim cargo build --release`
  then `systemctl restart x64dbg-relay`.

## References

- `references/setup-windows.md` — full Windows VM setup (x64dbg + plugin + reverse mode + file transfer)
