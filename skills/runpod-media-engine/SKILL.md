---
name: runpod-media-engine
description: Sovereign media engine for SIS/MatrAIx — RunPod serverless ComfyUI pod (FLUX.1 schnell) that replaces OpenArt. Create the scale-to-zero serverless endpoint, resume/pause ("turn on and pause whenever"), and generate stills from shot prompt patterns. Wired to the studio's "Media · ComfyUI (FLUX)" panel via the SIS /media/* routes.
metadata:
  author: genius.zo.computer
  engine: comfyui · flux
---

# RunPod Media Engine (serverless ComfyUI · FLUX)

Sovereign replacement for OpenArt's Director Mode. The studio calls
`SIS /media/generate` → posts a shot's `prompt_pattern` → this RunPod serverless
pod → a FLUX.1 schnell still → `snippet_asset` for the Shot Library / wardrobe.

## Why serverless = "turn on and pause"
RunPod serverless endpoints scale to zero: **idle timeout → paused (no GPU cost),
first request → a worker boots in ~30–60s**. `npm run resume` / `npm run pause`
force either state. This is the on/pause the user asked for.

## Env (Zo Secrets → Settings > Advanced)
- `RUNPOD_ACCOUNT_API_KEY` — **account-level** key. ONLY this can *create* or
  *resume/pause* endpoints. The resource-scoped `RUNPOD_API` (`rpa_…`) **cannot**
  — it only targets existing endpoints (invoke/health).
- `RUNPOD_API` — existing scoped key, used to invoke/health the endpoint.
- `RUNPOD_MEDIA_ENDPOINT_ID` — the serverless ComfyUI endpoint id to invoke.
  Set on the SIS API container so `/media/status` reports `configured:true`.

> **RunPod egress caveat:** API calls from the Zo sandbox can hit a Cloudflare
> WAF block (1010). Prefer `/usr/local/bin/media.ts` via the host:
> `tailscale ssh root@genius-substrates-host 'RUNPOD_API=… node /…/media.ts …'`
> (script is self-contained; copy it to the host if needed).

## CLI — `scripts/media.ts` (zero-dep Bun/Node)
```
bun media.ts status                          # configured endpoint + RunPod health/boot state
bun media.ts create  --template TID --gpu "NVIDIA GeForce RTX 4090" \
                     --min 0 --max 1 --idle 300
bun media.ts create  # defaults: ComfyUI serverless template, RTX 4090, min 0 / max 1, idle 5m
bun media.ts resume  <endpointId>            # boot workers now (turn ON)
bun media.ts pause   <endpointId>            # drop to zero workers (PAUSE)
bun media.ts generate <endpointId> "<prompt>"# runsync a FLUX still, prints the image URL
```

### Create — recommended run (drop-in, on host):
```bash
tailscale ssh root@genius-substrates-host 'RUNPOD_ACCOUNT_API_KEY=… RUNPOD_API=… \
  bun /projects/sis-deploy/synthetic-identity-substrate/scripts/media.ts create'
# prints the new ENDPOINT_ID → set it as RUNPOD_MEDIA_ENDPOINT_ID on the SIS API app env,
# redeploy, then /media/status shows configured:true and the studio "Render still" goes live.
```

## Threat model
One prompt context per job type. Never build arbitrary-user prompt injection into
the ComfyUI workflow; treat each job's prompt as a trusted app-side template.

## Cost (approx)
RTX 4090 serverless ≈ $0.34–1.10/hr, **$0 when idle/paused**. FLUX.1 schnell ~2–5s/still
per worker once warm.
