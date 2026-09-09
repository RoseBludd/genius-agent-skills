---
name: skill-security-scan
description: "Security scanner for third-party agent skills (ClawScan-adapted). Use when importing any skill from ClawHub or any external registry into Skills/ or publishing it to AgentConnect — scans for prompt injection, credential exfiltration, dangerous commands, persistence hooks, and obfuscated payloads before the skill is activated. Twin-sec owns this job; any agent can run the script."
compatibility: Genius Substrates agent fleet (AgentConnect genius-skills source); python3 on host
metadata:
  version: "1.0.0"
  author: genius.zo.computer
  source: adapted from openclaw/clawscan concept
---

# Skill Security Scan (ClawScan-adapted)

Standing job owner: **twin-sec** (AgentConnect). Every third-party skill must pass this scan before it lands in `Skills/` or gets published to AgentConnect knowledge. Direct port of an unscanned skill is a security incident, not a convenience.

## Usage

```bash
python3 Skills/skill-security-scan/scripts/skill_security_scan.py <skill-dir> \
  --report Skills/<skill-dir>/security-report.md --severity-threshold medium
```

- Exit `0` = pass (or warnings only below threshold). Exit `1` = blocking findings. Exit `2` = usage error.
- Verdicts: `PASS`, `PASS-WITH-WARNINGS`, `BLOCK`.

## What it checks

- **Prompt injection**: override phrases, jailbreak language, concealment instructions.
- **Credential exfiltration**: env/secret reads forwarded over network, `.env`/SSH/AWS credential access.
- **Dangerous execution**: `curl|bash`, decoded base64 shells, destructive `rm -rf` on system paths, fork bombs.
- **Persistence / lateral movement**: cron hooks, shell rc edits, `authorized_keys` manipulation.
- **Suspicious network**: non-ecosystem external endpoints, raw socket tools.
- **Obfuscation**: large base64 blobs, long hex escapes.
- **Frontmatter sanity**: SKILL.md present, name matches directory, description present.

## Doctrine (SEC standing job)

1. **Scan before activation** — import the skill into a scratch dir (or scan in place before publishing), run the scanner, attach `security-report.md` next to the skill.
2. **Blocking findings** → do not publish to AgentConnect; report to Juelzs with the finding table; quarantine the dir if the source is untrusted.
3. **Medium/low warnings** → allowed if explainable (e.g., a docs skill legitimately referencing external URLs); note the justification in the report.
4. **After a scan passes**, publish the skill to AgentConnect knowledge and record the scan in `Context/Confirmation Results/` (consolidated file when same purpose).
5. Re-scan any skill whose upstream version updates.

## Notes

- Patterns are heuristics, not a sandbox. Anything executing bundled scripts still runs with full workspace access — read the code for anything the scanner flags before running it.
- Ecosystem hosts (zo.computer, geniuzs.com, zo.pub, GitHub/npm/esm.sh, clawhub.ai) are allowlisted for the external-endpoint check; everything else is flagged for review.
