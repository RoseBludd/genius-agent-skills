import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
const r2 = new S3Client({ region: "auto", endpoint: process.env.R2_ENDPOINT, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
const BASE = `http://localhost:${process.env.PORT ?? 3340}`;
const cmd = process.argv[2];

async function manifests() {
  const out = await r2.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET, Prefix: "twins/" }));
  const autos = (out.Contents ?? []).filter(o => /automations\/.*automation\.json$/.test(o.Key ?? ""));
  const rows: { twin: string; name: string; enabled: boolean; schedule: string; lastRun: any; prompt: string; key: string }[] = [];
  for (const a of autos) {
    const g = await r2.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: a.Key }));
    const d = JSON.parse(await g.Body!.transformToString());
    const twin = (a.Key ?? "").split("/")[1];
    rows.push({ twin, name: (a.Key ?? "").split("/")[3], enabled: d.enabled !== false, schedule: d.schedule ?? d.trigger ?? "-", lastRun: d.lastRunAt ?? null, prompt: d.prompt ?? "", key: a.Key! });
  }
  return rows;
}

if (cmd === "list") {
  for (const r of await manifests())
    console.log(`${r.twin}/${r.name} | enabled:${r.enabled} | cron:${r.schedule} | lastRun:${typeof r.lastRun === "string" ? r.lastRun : JSON.stringify(r.lastRun)}`);
} else if (cmd === "run-all") {
  const rows = (await manifests()).filter(r => r.enabled);
  const PAR = Number(process.argv[3] ?? 4);
  const results: string[] = [];
  for (let i = 0; i < rows.length; i += PAR) {
    await Promise.all(rows.slice(i, i + PAR).map(async r => {
      try {
        const res = await fetch(`${BASE}/ask/${r.twin}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: r.prompt, session: `automation:${r.name}` }) });
        const d = await res.json() as any;
        results.push(`${r.twin}/${r.name}: ${String(d.output ?? d.error ?? "no-output").slice(0, 160)}`);
      } catch (e: any) { results.push(`${r.twin}/${r.name}: ERROR ${e.message}`); }
    }));
    console.log(`[run-all] batch ${Math.floor(i / PAR) + 1} done`);
  }
  for (const x of results) console.log(x);
} else if (cmd === "reports") {
  const out = await r2.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET, Prefix: "reports/" }));
  for (const o of (out.Contents ?? []).sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0)))
    console.log(o.Key, o.Size, o.LastModified?.toISOString());
} else if (cmd === "mailbox") {
  const out = await r2.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET, Prefix: "mailbox/" }));
  for (const o of (out.Contents ?? []).sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0)).slice(0, 8))
    console.log(o.Key, o.LastModified?.toISOString());
} else {
  console.log("usage: bun twins-ops.ts list | run-all [parallel] | reports | mailbox");
}
