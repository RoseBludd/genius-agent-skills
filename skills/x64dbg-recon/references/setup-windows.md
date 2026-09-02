# Windows VM Setup — x64dbg + MCP Plugin + Reverse Mode

One-time setup per Windows VM. The VM dials OUT to the relay, so NAT is fine.

## 1. Install x64dbg

1. Download the latest snapshot: https://x64dbg.com → snapshot zip.
2. Extract to e.g. `C:\x64dbg\`.
3. Run `C:\x64dbg\release\x96dbg.exe` once to register shell integration, or launch
   `x64\x64dbg.exe` (64-bit targets) / `x32\x32dbg.exe` (32-bit targets) directly.

## 2. Install the plugin (atericparker remote-MCP build)

Releases: https://github.com/atericparker/x64dbg-remote-mcp/releases
(fork of AgentSmithers/x64DbgMCPServer — extended for reverse-connect + file transfer).

1. Download the release zip.
2. Copy the plugin files into `C:\x64dbg\release\x64\plugins\` (and `x32\plugins\` if you
   debug 32-bit targets).
3. Restart x64dbg. Verify: Log tab shows the MCP plugin loading, and
   `http://127.0.0.1:50300/` answers while a debuggee is loaded (direct/local mode).

## 3. Connect to the relay (reverse mode)

Get the token from the VPS: `tailscale ssh root@<tailnet-ip> 'cat /opt/x64dbg-relay/.env'`
(keep it out of chat/screenshots).

In the x64dbg **command bar** (with a debuggee loaded):

```
StartReverseMode http://<tailnet-ip>:50301 <RELAY_TOKEN>
```

Verify: `ReverseModeStatus` in x64dbg, or from any tailnet machine:
`curl http://<tailnet-ip>:50301/api/status` → `active_sessions` ≥ 1.

To disconnect: `StopReverseMode`.

## 4. Point your MCP client at the relay

Cursor example (`~/.cursor/mcp.json`):

```json
{ "mcpServers": { "x64dbg-recon": { "url": "http://<tailnet-ip>:50301/sse" } } }
```

All standard commands plus remote-mode extras become available:

| Tool | Purpose |
|---|---|
| `StartReverseMode` / `StopReverseMode` / `ReverseModeStatus` | relay session control |
| `UploadAndDebug` | pull a file from the relay's `uploads/` dir and debug it |
| `UploadAndRun` | pull and run without debugging |
| `UploadDllAndInject` | pull a DLL and inject into the target |
| `ScyllaDumpToHost` | Scylla-dump the process, push dump to relay `downloads/` |
| `MemoryDumpToHost` | dump a memory region to the relay `downloads/` |
| `ListHostUploads` / `ListHostDownloads` | browse transferable files |

Standard tools (always available): memory read/write, registers, threads, call stack,
breakpoints, labels, disassembly, module list, raw debugger commands.

## 5. File transfer workflow

- **To VM**: place the binary on the VPS at `/opt/x64dbg-relay/uploads/` (create the dir if
  needed), then call `UploadAndDebug` with the filename.
- **From VM**: agent calls `ScyllaDumpToHost` / `MemoryDumpToHost`; result appears in
  `/opt/x64dbg-relay/downloads/` on the VPS.

## Gotchas

- The MCP server inside x64dbg only serves while a debuggee session exists — load a target
  first, then `StartReverseMode`.
- Keep one active reverse session per relay token at a time (session manager is per-token).
- If the VM sleeps/suspends, the poller drops; re-run `StartReverseMode` after resume.
- Windows Defender/SmartScreen may flag the unsigned plugin DLL — add an exclusion for the
  x64dbg plugins folder on trusted VMs.
