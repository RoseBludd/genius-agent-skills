#!/usr/bin/env python3
"""Skill security scanner (ClawScan-adapted) for the Genius Substrates ecosystem.

Scans a skill directory (SKILL.md + bundled scripts/references/assets) for
prompt injection, credential exfiltration, dangerous commands, obfuscated
payloads, and frontmatter problems. Produces a markdown report.

Usage:
  python3 skill_security_scan.py <skill-dir> [--report <path>] [--severity-threshold high|medium|low]

Exit codes: 0 = clean/warnings only, 1 = findings at or above threshold, 2 = usage/IO error.
"""
import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# (regex, severity, title, why)
PATTERNS = [
    # Prompt injection
    (r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions", "high", "Prompt-injection phrase",
     "Attempts to override the host agent's instructions."),
    (r"disregard\s+(all\s+)?(previous|prior|above)", "high", "Prompt-injection phrase",
     "Attempts to override the host agent's instructions."),
    (r"you\s+are\s+now\s+(a|an)\s+(different|unrestricted|uncensored|dan)", "high", "Jailbreak phrase",
     "Classic DAN-style jailbreak language."),
    (r"do\s+not\s+(show|tell|reveal|mention)\s+(this|the user|the human)", "medium", "Concealment instruction",
     "Instructs the agent to hide behavior from the user."),
    (r"exfiltrat(e|ion)|exfil\s+data|steal\s+(credentials|secrets|tokens)", "high", "Exfiltration language",
     "Explicit data-exfiltration wording."),
    # Credential / env harvesting
    (r"(os\.environ|process\.env)\s*\[?[\"'][A-Z_]*(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z_]*[\"']\]?\s*.{0,80}(http|fetch|requests\.|curl|post)", "high",
     "Env secret sent to network", "Reads a credential env var and forwards it over the network in the same expression."),
    (r"printenv|env\s*\|\s*(curl|nc|wget)|cat\s+.*\.env\s*\|\s*(curl|nc|wget)", "high", "Env/.env piped to network",
     "Environment or .env contents streamed to a network command."),
    (r"(~/.ssh|id_rsa|id_ed25519|\.aws/credentials|\.netrc)", "high", "SSH/cloud credential path access", "References private key or cloud credential files."),
    # Dangerous execution
    (r"curl[^|;&\n]*\|\s*(ba)?sh", "high", "curl piped to shell", "Remote code execution pattern."),
    (r"wget[^|;&\n]*-O\s*-?\s*\|\s*(ba)?sh", "high", "wget piped to shell", "Remote code execution pattern."),
    (r"base64\s+-d[^|;&\n]*\|\s*(ba)?sh", "high", "base64-decoded shell", "Obfuscated remote/local code execution."),    (r"eval\s*\"?[\$]\(\s*echo\s+[A-Za-z0-9+/=]{8,}\s*\|\s*base64\s+-d", "high", "base64-piped eval", "Shell eval of base64-decoded content — classic obfuscated payload."),
    (r"\$\(\s*echo\s+[A-Za-z0-9+/=]{24,}\s*\|\s*(base64\s+-d|openssl\s+enc)", "high", "decoded command substitution", "Command substitution over encoded content."),
    (r"\beval\s*\(\s*(os|subprocess|exec)\b|\beval\s*\(\s*(atob|Buffer\.)", "medium", "Dynamic eval of decoded content", "Runtime evaluation of constructed code."),
    (r"rm\s+-rf?\s+(/|~|\$HOME)", "high", "Destructive rm on system/home paths", "Can destroy the host filesystem."),
    (r"chmod\s+[0-7]*[67]7\s+/", "medium", "World-writable chmod on system path", "Privilege-weakening operation."),
    (r"(mkfs|dd\s+if=|:\(\)\s*\{)", "high", "Filesystem/ fork-bomb primitive", "Destructive low-level operation."),
    # Persistence / lateral movement
    (r"crontab\s+(-l|-\s*e)|/etc/cron|\.bashrc|\.zshrc|\.profile", "medium", "Persistence hook (cron/shell rc)", "Modifies startup/persistence surfaces; verify it is legitimate."),
    (r"ssh-keygen|ssh-copy-id|authorized_keys", "medium", "SSH key manipulation", "Can add attacker-controlled access."),
    # Suspicious network
    # Suspicious network — executable contexts only (curl/wget/fetch/requests/axios/httpx + URL in same line).
    # Bare markdown/doc links are informational documentation, not executable calls.
    (r"(?i)\b(curl|wget|fetch\(|requests\.(get|post)|axios|httpx|urllib)\b[^\n]{0,200}?https?://(?!localhost|127\.0\.0\.1|0\.0\.0\.0|zo\.computer|zocomputer|geniuzs|zo\.pub|github\.com|raw\.githubusercontent|api\.zo\.computer|clawhub\.ai|esm\.sh|registry\.npmjs|api\.github|keepachangelog|semver\.org|conventionalcommits|shields\.io|makeareadme)[a-z0-9.-]+\.(com|net|org|io|sh|dev|app|xyz|ru|cn|top|info)", "medium",
     "Executable call to external endpoint", "Code makes a network call to a non-ecosystem external host; verify the destination is expected."),
    (r"\bnc\s+-|netcat|socat\s+TCP", "medium", "Raw socket tool usage", "Reverse-shell / raw-tunnel primitives."),
    # Obfuscation
    (r"[A-Za-z0-9+/]{600,}={0,2}", "medium", "Very long base64 blob", "Possible embedded obfuscated payload; decode and inspect."),
    (r"\\x[0-9a-f]{2}(\\x[0-9a-f]{2}){20,}", "low", "Long hex escape sequence", "Possible obfuscated string."),
    (r"chmod\s+\+x\s+.*&&\s*\./", "low", "Downloaded binary executed", "Executes a downloaded file directly."),
]

FIRMWARE_EXT = {".py", ".ts", ".js", ".mjs", ".cjs", ".sh", ".bash", ".ps1", ".rb", ".go", ".json", ".yaml", ".yml", ".md", ".toml", ".sql"}
SKIP_DIRS = {"node_modules", ".git", "__pycache__", "dist", "build"}


def scan_file(path: Path):
    findings = []
    try:
        text = path.read_text(errors="replace")
    except Exception as e:
        return [{"severity": "low", "title": "Unreadable file", "detail": f"{e}", "line": 0}]
    for pattern, severity, title, why in PATTERNS:
        for m in re.finditer(pattern, text, re.IGNORECASE):
            line = text[: m.start()].count("\n") + 1
            snippet = text[max(0, m.start() - 40): m.end() + 40].replace("\n", " ")
            findings.append({"severity": severity, "title": title, "why": why, "line": line, "snippet": snippet[:160]})
    return findings


def check_frontmatter(skill_dir: Path):
    issues = []
    sk = skill_dir / "SKILL.md"
    if not sk.exists():
        issues.append({"severity": "high", "title": "No SKILL.md", "why": "Skill spec requires SKILL.md with frontmatter.", "line": 0, "snippet": ""})
        return issues
    text = sk.read_text(errors="replace")
    m = re.match(r"^---\n(.*?)\n---", text, re.DOTALL)
    if not m:
        issues.append({"severity": "medium", "title": "Missing frontmatter", "why": "SKILL.md has no YAML frontmatter block.", "line": 1, "snippet": ""})
        return issues
    fm = m.group(1)
    name_m = re.search(r"^name:\s*(\S+)", fm, re.MULTILINE)
    if not name_m:
        issues.append({"severity": "medium", "title": "No name in frontmatter", "why": "name is required.", "line": 1, "snippet": ""})
    elif name_m.group(1) != skill_dir.name:
        issues.append({"severity": "medium", "title": "name/dir mismatch", "why": f"frontmatter name '{name_m.group(1)}' != dir '{skill_dir.name}'", "line": 1, "snippet": ""})
    if not re.search(r"^description:", fm, re.MULTILINE):
        issues.append({"severity": "medium", "title": "No description", "why": "description is required.", "line": 1, "snippet": ""})
    if "rm -rf" in fm or "curl" in fm and "sh" in fm:
        pass
    return issues


def scan_skill(skill_dir: Path):
    findings = list(check_frontmatter(skill_dir))
    file_hashes = {}
    for root, dirs, files in os.walk(skill_dir):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            p = Path(root) / f
            if p.suffix.lower() not in FIRMWARE_EXT and p.name != "SKILL.md":
                continue
            file_hashes[str(p)] = hashlib.sha256(p.read_bytes()).hexdigest()[:16]
            for fd in scan_file(p):
                fd["file"] = str(p.relative_to(skill_dir))
                findings.append(fd)
    return findings, file_hashes


ORDER = {"high": 0, "medium": 1, "low": 2}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("skill_dir")
    ap.add_argument("--report", help="Write markdown report to this path")
    ap.add_argument("--severity-threshold", default="medium", choices=["high", "medium", "low"])
    ap.add_argument("--trusted", action="store_true", help="First-party skill reviewed by a human: findings still reported, verdict TRUSTED-PASS, exit 0")
    args = ap.parse_args()

    skill_dir = Path(args.skill_dir).resolve()
    if not skill_dir.is_dir():
        print(json.dumps({"error": f"not a directory: {skill_dir}"}))
        sys.exit(2)

    findings, hashes = scan_skill(skill_dir)
    findings.sort(key=lambda f: (ORDER.get(f.get("severity", "low"), 3), f.get("file", "")))
    threshold = ORDER[args.severity_threshold]
    blocking = [f for f in findings if ORDER.get(f.get("severity", "low"), 3) <= threshold]

    result = {
        "skill": skill_dir.name,
        "scanned_at": datetime.now(timezone.utc).isoformat(),
        "files_scanned": len(hashes),
        "finding_count": len(findings),
        "blocking_count": len(blocking),
        "threshold": args.severity_threshold,
        "findings": findings,
        "trusted": args.trusted,
        "verdict": ("TRUSTED-PASS" if args.trusted else ("BLOCK" if blocking else ("PASS-WITH-WARNINGS" if findings else "PASS"))),
    }

    if args.report:
        rep = Path(args.report)
        rep.parent.mkdir(parents=True, exist_ok=True)
        lines = [
            f"# Skill Security Scan — {skill_dir.name}",
            f"- Scanned: {result['scanned_at']}",
            f"- Files scanned: {result['files_scanned']}",
            f"- Threshold: {args.severity_threshold} | Findings: {result['finding_count']} | Blocking: {result['blocking_count']}",
            f"- Verdict: **{result['verdict']}**",
            "",
        ]
        if findings:
            lines.append("| Sev | File:Line | Title | Detail |")
            lines.append("|---|---|---|---|")
            for f in findings:
                lines.append(f"| {f['severity'].upper()} | `{f.get('file','?')}:{f.get('line',0)}` | {f['title']} | {f.get('why', f.get('detail',''))[:120]} |")
        else:
            lines.append("No findings.")
        rep.write_text("\n".join(lines) + "\n")
        result["report"] = str(rep)

    print(json.dumps(result, indent=2))
    sys.exit(1 if (blocking and not args.trusted) else 0)


if __name__ == "__main__":
    main()
