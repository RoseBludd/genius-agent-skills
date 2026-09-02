---
name: cloudflare-cadis-worker
description: Cloudflare Workers AI-powered CADIS gateway — serverless replacement for the local CADIS AI stack (ollama + cadis-gate + cadis-openai-adapter). Deploys to cadis.geniuzs.com and provides OpenAI-compatible /v1/chat/completions with model tier routing.
compatibility: Created for Zo Computer
metadata:
  author: genius.zo.computer
---

# Cloudflare CADIS Worker

Serverless AI gateway on Cloudflare Workers AI. Replaces the local CADIS AI stack (ollama, cadis-gate, cadis-openai-adapter, zo.space routes) with one worker at `cadis.geniuzs.com`.

## Model Tiers

| CADIS Model | Cloudflare Model | Use Case |
|---|---|---|
| `cadis-speed` | @cf/meta/llama-3.2-3b-instruct | Fast, cheap responses |
| `cadis-code` | @cf/qwen/qwen2.5-coder-32b-instruct | Code generation, review |
| `cadis-reason` | @cf/deepseek-ai/deepseek-r1-distill-qwen-32b | Reasoning, analysis |
| `cadis-default` | @cf/meta/llama-3.3-70b-instruct-fp8-fast | General purpose (powerful) |
| `cadis-gemma` | @cf/google/gemma-4-26b-a4b-it | Google's latest |
| `cadis-vision` | @cf/meta/llama-3.2-11b-vision-instruct | Image understanding |

## Deployment

```bash
cd Skills/cloudflare-cadis-worker
npx wrangler deploy
```

Requires:
- Cloudflare API token with Workers AI access
- `geniuzs.com` zone in Cloudflare
- DNS: `cadis.geniuzs.com` CNAME → worker

## API

OpenAI-compatible endpoints:
- `POST /v1/chat/completions` — chat completions (streaming supported)
- `POST /v1/embeddings` — text embeddings
- `GET /v1/models` — model list
- `GET /health` — health check

## Gateway Integration

After deploying, update the gateway's CADIS URL:
```
CADIS_BASE_URL=https://cadis.geniuzs.com
```
