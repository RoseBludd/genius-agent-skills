#!/usr/bin/env bash
# Fleet-facing skill security scan — one-shot wrapper for the twin-sec standing job.
# Scans every skill in the collection, writes a combined markdown report, and pushes
# it to R2 (genius-agent-twins bucket, reports/skill-security-scan/latest.md).
# Detection only — never edits skills, never dispatches executors.
set -uo pipefail

COLLECTION="${1:-/opt/agent-twins/genius-agent-skills/skills}"
SCAN_SCRIPT="$COLLECTION/skill-security-scan/scripts/skill_security_scan.py"
TRUSTED="skill-security-scan"   # first-party scanner skill, self-scan is definitionally trusted
REPORT="/tmp/skill-security-scan-latest.md"

OUT=$(python3 "$SCAN_SCRIPT" --all "$COLLECTION" --severity-threshold medium --trusted-list "$TRUSTED" --report "$REPORT" 2>/dev/null)
RC=$?

python3 - "$OUT" <<'PY' > /tmp/skill-security-scan-summary.txt
import json, sys
d = json.loads(sys.argv[1])
print(f"skills_scanned={d['skills_scanned']} pass={d['pass']} trusted_pass={d['trusted_pass']} warnings={d['pass_with_warnings']} block={len(d['block'])}")
for r in d["results"]:
    if r["verdict"] != "PASS":
        print(f"{r['skill']}: {r['verdict']} ({r['finding_count']} findings)")
        for f in r["findings"]:
            print(f"  - {f['severity'].upper()} {f.get('file','?')}:{f.get('line',0)} {f['title']}")
PY

# Push the report to R2 if creds are available (agent-twins runtime env)
BUN_BIN="$(command -v bun || echo /root/.bun/bin/bun)"
if [ -f /opt/agent-twins/.env ] && [ -x "$BUN_BIN" ]; then
  B64=$(base64 -w0 "$REPORT")
  (cd /opt/agent-twins && set -a && source .env && set +a && "$BUN_BIN" -e '
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "node:fs";
const r2 = new S3Client({ region: "auto", endpoint: process.env.R2_ENDPOINT, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
const body = Buffer.from(process.argv[1], "base64");
await r2.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: "reports/skill-security-scan/latest.md", Body: body, ContentType: "text/markdown" }));
console.log("R2 report pushed: reports/skill-security-scan/latest.md (" + body.length + " bytes)");
' "$B64" 2>&1 | tail -1)
else
  echo "R2 push skipped (no /opt/agent-twins/.env or bun)"
fi

echo "--- summary ---"
cat /tmp/skill-security-scan-summary.txt
exit $RC
