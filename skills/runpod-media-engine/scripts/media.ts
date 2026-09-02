#!/usr/bin/env bun
/**
 * RunPod serverless ComfyUI media engine CLI (zero-dep).
 * Env: RUNPOD_API (scoped rpa_) invokes AND creates endpoints/volumes via REST v1.
 *      RUNPOD_ACCOUNT_API_KEY (resume/pause of existing endpoints).
 *      RUNPOD_MEDIA_ENDPOINT_ID.
 * Verified 2026-08-23: the scoped key CAN create endpoints + network volumes via
 * REST v1 (only GraphQL api.runpod.* is WAF/account-restricted).
 * Usage: bun media.ts <status|create|resume|pause|generate> [args]
 */
const ACC = process.env.RUNPOD_ACCOUNT_API_KEY ?? "";
const SCOPED = process.env.RUNPOD_API ?? "";
const EP = process.env.RUNPOD_MEDIA_ENDPOINT_ID ?? "";

const GRAPHQL = "https://api.runpod.io/graphql";
const REST = "https://rest.runpod.io/v1";
const INVOKE = "https://api.runpod.ai/v2";

const arg = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
};

async function gql(q: string, key: string) {
  const r = await fetch(GRAPHQL, {
    method: "POST",
    headers: { "content-type": "application/json", "api-key": key },
    body: JSON.stringify({ query: q }),
  });
  return r.json();
}

async function status() {
  const ep = EP || arg("--endpoint") || "";
  console.log(`endpoint    : ${ep || "(none — set RUNPOD_MEDIA_ENDPOINT_ID)"}`);
  console.log(`scoped key  : ${SCOPED ? "set" : "missing"}`);
  console.log(`account key : ${ACC ? "set (can resume/pause)" : "missing (resume/pause unavailable; create works via scoped key)"}`);
  if (ep) {
    const h = await fetch(`${INVOKE}/${ep}/health`, {
      headers: { authorization: `Bearer ${SCOPED}` },
    }).catch((e) => ({ status: 0, json: async () => ({ error: String(e) }) }));
    const body = await (h as any).json();
    const jobs = body?.jobs ?? {};
    const workers = body?.workers ?? {};
    console.log(`health      : ${h.status === 200 ? "UP" : `HTTP ${h.status}`}`);
    if (h.status === 200) console.log(`  running jobs: ${Object.keys(jobs).length} · workers: ${JSON.stringify(workers)}`);
  }
}

async function create() {
  const key = SCOPED || ACC;
  if (!key) return fail("create needs RUNPOD_API (scoped rpa_ — verified able to create endpoints + network volumes via REST v1)");
  const name = arg("--name") ?? "sis-comfyui-flux";
  const templateId = arg("--templateId") ?? "42lk5hlifd"; // runpod/worker-comfyui:5.8.6-flux1-dev-fp8
  const gpu = arg("--gpu") ?? "NVIDIA GeForce RTX 4090";
  const min = Number(arg("--min") ?? 0);
  const max = Number(arg("--max") ?? 1);
  const idle = Number(arg("--idle") ?? 600);
  const volume = arg("--volume") ?? ""; // network volume id → persists /workspace models across cold starts
  const body: Record<string, unknown> = {
    name,
    gpuTypeIds: [gpu],
    templateId,
    workersMin: min,
    workersMax: max,
    idleTimeout: idle,
    flashboot: true,
    scalerType: "QUEUE_DELAY",
    scalerValue: 4,
  };
  if (volume) (body as any).networkVolumeId = volume;
  console.log(`creating serverless endpoint '${name}' (gpu=${gpu}, template=${templateId}, min=${min}, max=${max}, idle=${idle}s${volume ? `, volume=${volume}` : ""})`);
  const r = await fetch(`${REST}/endpoints`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return console.log(`create failed ${r.status}: ${JSON.stringify(j)}`);
  const id = (j as any).id ?? (j as any).data?.id ?? JSON.stringify(j);
  console.log(`created endpoint id: ${id}`);
  if (typeof id === "string") {
    console.log(`\nNext: set RUNPOD_MEDIA_ENDPOINT_ID=${id} (and RUNPOD_API) in the SIS app env, redeploy, then /media/status = configured:true`);
  }
}

async function resume() {
  const ep = arg("--endpoint") ?? EP;
  if (!ep) return fail("resume needs --endpoint or RUNPOD_MEDIA_ENDPOINT_ID");
  if (!ACC) return fail("resume needs RUNPOD_ACCOUNT_API_KEY");
  const r = await fetch(`${REST}/endpoints/${ep}/resume`, {
    method: "POST", headers: { authorization: `Bearer ${ACC}` },
  });
  console.log(`resume ${ep}: ${r.ok ? "OK (workers booting — ON)" : `HTTP ${r.status}`}`);
}

async function pause() {
  const ep = arg("--endpoint") ?? EP;
  if (!ep) return fail("pause needs --endpoint or RUNPOD_MEDIA_ENDPOINT_ID");
  if (!ACC) return fail("pause needs RUNPOD_ACCOUNT_API_KEY");
  const r = await fetch(`${REST}/endpoints/${ep}/pause`, {
    method: "POST", headers: { authorization: `Bearer ${ACC}` },
  });
  console.log(`pause ${ep}: ${r.ok ? "OK (workers → 0 — PAUSED)" : `HTTP ${r.status}`}`);
}

async function generate() {
  const ep = arg("--endpoint") ?? EP;
  const prompt = process.argv[process.argv.length - 1] ?? "";
  if (!ep) return fail("generate needs --endpoint");
  if (!SCOPED) return fail("generate needs RUNPOD_API (scoped)");
  if (!prompt) return fail("generate needs a prompt string as the last argument");
  console.log(`posting prompt to ${ep} (first request boots a worker ~30-60s)…`);
  const r = await fetch(`${INVOKE}/${ep}/runsync`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${SCOPED}` },
    body: JSON.stringify({ input: { prompt } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return console.log(`generate failed ${r.status}: ${JSON.stringify(j)}`);
  const url = j?.output?.image_url ?? j?.output?.[0]?.image_url ?? j?.output?.url;
  console.log(url ? `still: ${url}` : `result: ${JSON.stringify(j)}`);
}

function fail(msg: string) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const commands: Record<string, () => Promise<void>> = { status, create, resume, pause, generate };
const cmd = process.argv[2] ?? "status";
if (!commands[cmd]) fail(`unknown command '${cmd}' (use status|create|resume|pause|generate)`);
await commands[cmd]();
