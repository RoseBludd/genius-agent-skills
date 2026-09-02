# Genius Substrates Environment Map — Env Vars & Secrets Index

> Captured **2026-08-05** via live `docker inspect` on every key container (values stripped server-side; **names only**). Vault = self-hosted Infisical (`secrets.geniussubstrates.com`). Coolify app env files live at `/data/coolify/applications/<uuid>/.env`. Refresh after env migrations; add dated change-log lines at the bottom.

## Cross-cutting roles (the names that wire the platform together)

Use this to know WHICH variable a goal maps to before touching anything.

| Role | Variable names |
|---|---|
| Infisical vault identity (CLI/scripts) | `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`, `INFISICAL_PROJECT_ID`, `INFISICAL_ENV` (host: `/data/mtls/.infisical-auth`); `INFISICAL_ACCESS_TOKEN`, `INFISICAL_DOMAIN` (Mission Control/Secret Access UI) |
| Coolify control | `COOLIFY_API_TOKEN`, `COOLIFY_BASE` (Mission Control) |
| Genius DB layer | `GENIUS_DB` (chat, ide), `VIBEZS_DB` (ai-keys worker), `DATABASE_URL` (actions, postiz, etc.), `DATABASE_MAX_CONNECTIONS`, `POOL_MAX`, `WORKER_*` (actions), `DB_POSTGRESDB_*`, `DB_TYPE` (n8n), `REDIS_URL`, `JWT_SECRET` (postiz) |
| LLM layer | `OPENAI_API_KEY`, `OPENAI_API_BASE_URL`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `LITELLM_MASTER_KEY` (chat, n8n, crewai), `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` (ai-keys worker), `CLAUDE_API_KEY` (actions), `HF_TOKEN`, `OLLAMA_MODEL`, `OLLAMA_FAST_MODEL`, `OLLAMA_EXTENDED_MODEL`, `OLLAMA_BASE_URL`, `AUXILIARY_EMBEDDING_MODEL`, `RAG_EMBEDDING_MODEL`, `RAG_RERANKING_MODEL`, `WHISPER_MODEL`, `WHISPER_MODEL_DIR` (chat), `GEMMA_MODEL` (postiz, n8n, crewai) |
| RunPod GPU lanes | `RUNPOD_API`, `RUNPOD_ENDPOINT_ID`, `RUNPOD_ENDPOINT_ID_FAST`, `RUNPOD_ENDPOINT_ID_EXTENDED`, `RUNPOD_ENDPOINT_ID_IMAGE`, `RUNPOD_FAST_WORKERS_MAX`, `RUNPOD_CHATTERBOX_ENDPOINT_ID`, `RUNPOD_CHATTERBOX_IMAGE`, `RUNPOD_IMAGE_WORKFLOW`, `RUNPOD_COMFYUI_IMAGE`, `RUNPOD_DOCKER_REGISTRY_NAME`, `RUNPOD_DOCKER_REGISTRY_AUTH_ID` (chat, crewai, ide) |
| Analytics (PostHog) | `ANALYTICS_POSTHOG_URL`, `ANALYTICS_POSTHOG_USERNAME`, `ANALYTICS_POSTHOG_PASSWORD`, `POSTHOG_PUBLIC_URL`, `POSTHOG_PUBLIC_HOST`, `POSTHOG_PROJECT_API_KEY`, `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_CAPTURE_URL`, `POSTHOG_RAILWAY_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_KEY` (chat) |
| Email / webhook channels | `GENIUS_SUBSTRATES_RESEND_API_KEY`, `GENIUS-SUBSTRATES-DOMAIN_RESEND_API_KEY` (Mission Control, Secret Access UI), `EMAILZS_BASE_URL`, `EMAILZS_WEBHOOK_TOKEN_BEHAVIORAL`, `EMAILZS_WEBHOOK_TOKEN_POST_DEMO`, `EMAILZS_WEBHOOK_TOKEN_WAITLIST`, `GTM_WEBHOOK_SECRET`, `GTM_BRIDGE_API_KEY` (chat, blastzs, n8n), `GTM_WF_DRAFT_B64`, `GTM_WF_PUBLISH_B64` (n8n) |
| Railway/external hosts | `RAILWAY_TOKEN`, `RAILWAY_DATABASE`, `ACTIONS_RAILWAY_TOKEN`, `GENIUS_IDE_RAILWAY_TOKEN`, `POSTHOG_RAILWAY_TOKEN` (chat, ide, actions, postiz-adjacent) |
| Genius platform | `GENIUS_OS_BASE_URL`, `GENIUS_COCKPIT_API_TOKEN`, `GENIUS_IDE_URL`, `GENIUS_IDE_CLIENT_ID`, `GENIUS_IDE_CLIENT_SECRET`, `GENIUS_IDE_PASSWORD`, `GENIUS_IDE_VERIFY_EMAIL`, `COCKPIT_SSO_SECRET`, `GATEWAY_SERVICE_URL`, `ACTION_EXECUTE_URL`, `AGENTS_CREWAI_URL`, `CHATTERBOX_URL`, `CHATTERBOX_API_KEY`, `ADSPIRER_API`, `MEDIA_IMAGE_API_URL`, `MEDIA_IMAGE_HEALTH_URL`, `WEBUI_URL`, `WEBUI_SECRET_KEY`, `WEBUI_BUILD_VERSION`, `N8N_BASE_URL`, `N8N_API_KEY`, `N8N_ENCRYPTION_KEY`, `POSTIZ_URL`, `POSTIZ_SERVICE_EMAIL`, `POSTIZ_SERVICE_PASSWORD`, `WEBHOOK_URL` |
| Cloud / host ops | `DIGITAL_OCEAN_API`, `TAILSCALE_CLIENT_ID`, `TAILSCALE_CLIENT_SECRET` (Mission Control), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` (ai-keys worker, actions), `VIBEZS_AWS_ACCESS_KEY`, `VIBEZS_AWS_SECRET` (chat) |
| Ops security | `CADIS_API_TOKEN`, `CADIS_ADMIN_TOKEN`, `CADIS_EXTERNAL_API_KEYS` (ide, Mission Control/secured services), `SECRET_ACCESS_ADMIN_TOKEN`, `SECRET_ACCESS_ADMIN_EMAIL`, `SECRET_ACCESS_FROM_EMAIL`, `SECRET_ACCESS_PUBLIC_URL` (Secret Access UI, Mission Control), `MISSION_CONTROL_PUBLIC_URL`, `PROBO_API_KEY`, `DIRECTOR_PASSWORD`, `GPG_KEY` |
| Dev registry | `DOCKER_HUB_USERNAME`, `DOCKER_TOKEN`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `NPM_CONFIG_PRODUCTION`, build-chain vars (`NIXPACKS_*`, `NODE_VERSION`, `YARN_VERSION`, `SOURCE_COMMIT`, `PYTHON_VERSION`, `PYTHON_SHA256`, `BUN_INSTALL`, `UV_LINK_MODE`, `SENTENCE_TRANSFORMERS_HOME`, `TIKTOKEN_CACHE_DIR`, `TIKTOKEN_ENCODING_NAME`, `SCARF_NO_ANALYTICS`, `DO_NOT_TRACK`, `ANONYMIZED_TELEMETRY`, `OTEL_SDK_DISABLED`) |

## Per-app inventory (verified container → full var-name set)

### `ide.geniuzs.com` — `icbgr74fd7omamfa9ryfijzs-184925847896` (Genius IDE / Coder gateway + opencode)
`CODER_URL`, `CODER_SESSION_TOKEN`, `CODER_WORKSPACE_OWNER`, `CODER_IDE_TEMPLATE`, `CADIS_API_TOKEN`, `CADIS_EXTERNAL_API_KEYS`, `OPENCODE_MODEL`, `OPENCODE_SMALL_MODEL`, `OPENCODE_REF`, `OPENCODE_SOURCE_DIR`, `OPENCODE_SERVER_USERNAME`, `OPENCODE_SERVER_PASSWORD`, `OPENCODE_SESSION_SECRET`, `OPENCODE_START_TIMEOUT_MS`, `DEPLOY_GENIUS_CADIS_TIMEOUT_MS`, `SKILLS_UPDATE_ON_START`, `ENABLE_MONITOR`, `ENABLE_OH_MY_OPENCODE`, `ENABLE_DISTRIBUTED_CIRCUIT_BREAKER`, `ENABLE_ENHANCED_CONNECTION_MANAGER`, `GATEWAY_SERVICE_URL`, `ACTION_EXECUTE_URL`, `AUTH_REALM`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GENIUS_DB`, `GENIUS_OS_BASE_URL`, `COCKPIT_SSO_SECRET`, `ACTIONS_RAILWAY_TOKEN`, `RUNPOD_API`, `RUNPOD_ENDPOINT_ID`, `RUNPOD_ENDPOINT_ID_FAST`, `RUNPOD_ENDPOINT_ID_EXTENDED`, `OLLAMA_MODEL`, `OLLAMA_FAST_MODEL`, `OLLAMA_EXTENDED_MODEL`, `NODE_ENV`, `PORT`, `SOURCE_COMMIT`, `SOURCE_MODE`

### `coder-server` (Zoe) — `svc_cZPBQC_vg2s` (Coder control plane, OIDC/SSO enabled 2026-08-07)
`CODER_PG_CONNECTION_URL` (name only; value set in service entrypoint), `CODER_HTTP_ADDRESS`, `CODER_ACCESS_URL`, `CODER_TELEMETRY_ENABLE`, `CODER_PROVISIONER_DAEMON_PSK`, `CODER_MAX_TOKEN_LIFETIME`, `CODER_MAX_ADMIN_TOKEN_LIFETIME`, `CODER_DEFAULT_TOKEN_LIFETIME`, `CODER_OIDC_ALLOW_SIGNUPS` (true), `CODER_OIDC_EMAIL_FIELD` (email)
Sourced at runtime from `/home/.z/environment/coder_oidc.env` (fetched from Infisical via `fetch_coder_oidc.sh`): `CODER_OIDC_CLIENT_ID`, `CODER_OIDC_CLIENT_SECRET`, `CODER_OIDC_ISSUER_URL` (https://www.geniuzs.com/api/hub-auth), `CODER_OIDC_REDIRECT_URI` (https://coder-server-genius.zocomputer.io/api/v2/users/oidc/callback). Stored in Infisical folder `/vercel/genius-os-marketing` (reuses marketing's hub-auth OIDC client).

### `chat.geniuzs.com` — `ynuu6714x5m50f42ok769jiu-225434815138` (Genius chat, webui-lineage)
`GENIUS_DB`, `GENIUS_OS_BASE_URL`, `GENIUS_COCKPIT_API_TOKEN`, `GENIUS_IDE_URL`, `GENIUS_IDE_CLIENT_ID`, `GENIUS_IDE_CLIENT_SECRET`, `GENIUS_IDE_PASSWORD`, `GENIUS_IDE_VERIFY_EMAIL`, `GENIUS_IDE_RAILWAY_TOKEN`, `ACTIONS_RAILWAY_TOKEN`, `POSTHOG_RAILWAY_TOKEN`, `RAILWAY_TOKEN`, `RAILWAY_DATABASE`, `DOCKER_TOKEN`, `DOCKER_HUB_USERNAME`, `OPENAI_API_KEY`, `OPENAI_API_BASE_URL`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `LITELLM_MASTER_KEY`, `OLLAMA_MODEL`, `OLLAMA_FAST_MODEL`, `OLLAMA_EXTENDED_MODEL`, `OLLAMA_BASE_URL`, `AUXILIARY_EMBEDDING_MODEL`, `RAG_EMBEDDING_MODEL`, `RAG_RERANKING_MODEL`, `WHISPER_MODEL`, `WHISPER_MODEL_DIR`, `TIKTOKEN_CACHE_DIR`, `TIKTOKEN_ENCODING_NAME`, `SENTENCE_TRANSFORMERS_HOME`, `HF_TOKEN`, `HF_HOME`, `USE_CUDA_DOCKER`, `USE_CUDA_DOCKER_VER`, `USE_SLIM_DOCKER`, `USE_OLLAMA_DOCKER`, `USE_EMBEDDING_MODEL_DOCKER`, `USE_AUXILIARY_EMBEDDING_MODEL_DOCKER`, `USE_RERANKING_MODEL_DOCKER`, `UV_LINK_MODE`, `RUNPOD_API`, `RUNPOD_ENDPOINT_ID`, `RUNPOD_ENDPOINT_ID_FAST`, `RUNPOD_ENDPOINT_ID_EXTENDED`, `RUNPOD_ENDPOINT_ID_IMAGE`, `RUNPOD_FAST_WORKERS_MAX`, `RUNPOD_CHATTERBOX_ENDPOINT_ID`, `RUNPOD_CHATTERBOX_IMAGE`, `RUNPOD_IMAGE_WORKFLOW`, `RUNPOD_COMFYUI_IMAGE`, `RUNPOD_DOCKER_REGISTRY_NAME`, `RUNPOD_DOCKER_REGISTRY_AUTH_ID`, `CHATTERBOX_URL`, `CHATTERBOX_API_KEY`, `ADSPIRER_API`, `MEDIA_IMAGE_API_URL`, `MEDIA_IMAGE_HEALTH_URL`, `AGENTS_CREWAI_URL`, `N8N_BASE_URL`, `N8N_API_KEY`, `POSTIZ_URL`, `WEBUI_URL`, `WEBUI_SECRET_KEY`, `WEBUI_BUILD_VERSION`, `EMAILZS_BASE_URL`, `EMAILZS_WEBHOOK_TOKEN_BEHAVIORAL`, `EMAILZS_WEBHOOK_TOKEN_POST_DEMO`, `EMAILZS_WEBHOOK_TOKEN_WAITLIST`, `GTM_BRIDGE_API_KEY`, `GTM_WEBHOOK_SECRET`, `ANALYTICS_POSTHOG_URL`, `ANALYTICS_POSTHOG_USERNAME`, `ANALYTICS_POSTHOG_PASSWORD`, `POSTHOG_PUBLIC_URL`, `POSTHOG_PUBLIC_HOST`, `POSTHOG_PROJECT_API_KEY`, `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_CAPTURE_URL`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_KEY`, `VIBEZS_AWS_ACCESS_KEY`, `VIBEZS_AWS_SECRET`, `DIRECTOR_PASSWORD`, `GPG_KEY`, `SCARF_NO_ANALYTICS`, `DO_NOT_TRACK`, `ANONYMIZED_TELEMETRY`, `ENV`, `HOST`, `PORT`, `PYTHONUNBUFFERED`, `PYTHON_SHA256`, `PYTHON_VERSION`, `SOURCE_COMMIT`

### `actions.geniuzs.com` — `juziiacybtmd33myzlyysshp-031326541347` (Genius Actions API)
`CLAUDE_API_KEY`, `MONDAY_API_KEY`, `MONDAY_BOARD_ID_DATA`, `MONDAY_BOARD_ID_USERS`, `MONDAY_MASTER_SALES_BOARD_ID`, `DATABASE_URL`, `DATABASE_MAX_CONNECTIONS`, `POOL_MAX`, `ENABLE_DISTRIBUTED_CIRCUIT_BREAKER`, `ENABLE_ENHANCED_CONNECTION_MANAGER`, `WORKER_BATCH_SIZE`, `WORKER_CONCURRENCY`, `WORKER_POOL_SIZE`, `AWS_S3_BUCKET`, `AWS_SECRET_ACCESS_KEY`, `NODE_ENV`, `PORT`, `SOURCE_COMMIT`

### Mission Control — `admin-dashboard-admin-dashboard-1` (genius-admin-dashboard, :8788)
`COOLIFY_API_TOKEN`, `COOLIFY_BASE`, `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`, `INFISICAL_ACCESS_TOKEN`, `INFISICAL_DOMAIN`, `DIGITAL_OCEAN_API`, `TAILSCALE_CLIENT_ID`, `TAILSCALE_CLIENT_SECRET`, `CADIS_ADMIN_TOKEN`, `PROBO_API_KEY`, `GENIUS_SUBSTRATES_RESEND_API_KEY`, `GENIUS-SUBSTRATES-DOMAIN_RESEND_API_KEY`, `SECRET_ACCESS_ADMIN_TOKEN`, `SECRET_ACCESS_ADMIN_EMAIL`, `SECRET_ACCESS_FROM_EMAIL`, `MISSION_CONTROL_PUBLIC_URL`, `GPG_KEY`, `PORT`

### Secret Access UI — `secret-access-ui-secret-access-ui-1`
`INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`, `INFISICAL_ACCESS_TOKEN`, `INFISICAL_DOMAIN`, `SECRET_ACCESS_ADMIN_TOKEN`, `SECRET_ACCESS_ADMIN_EMAIL`, `SECRET_ACCESS_FROM_EMAIL`, `SECRET_ACCESS_PUBLIC_URL`, `GENIUS_SUBSTRATES_RESEND_API_KEY`, `GENIUS-SUBSTRATES-DOMAIN_RESEND_API_KEY`, `GPG_KEY`, `PORT`

### `www.analyticzs.com` — `kodbwnbdr3epdbhoozkf3w8z-200826374566`
(env inspected; core vars: `COOLIFY_FQDN`, `COOLIFY_URL`, `COOLIFY_BRANCH`, `SOURCE_COMMIT`, `PORT`, `NODE_ENV` + app-specific build env — re-inspect at runtime for full set)

### `www.socialzs.com` — `v34glya4zfzd7jfonktpmfwl-003757048540` (Postiz)
`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `FRONTEND_URL`, `BACKEND_INTERNAL_URL`, `MAIN_URL`, `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_OVERRIDE_BACKEND_URL`, `NEXT_PUBLIC_POSTIZ_OAUTH_DISPLAY_NAME`, `NEXT_PUBLIC_UPLOAD_DIRECTORY`, `NEXT_PUBLIC_VERSION`, `STORAGE_PROVIDER`, `UPLOAD_DIRECTORY`, `OPENAI_API_KEY`, `OPENAI_API_BASE_URL`, `POSTIZ_URL`, `GEMMA_MODEL`, `IS_GENERAL`, `DISALLOW_PLUS`, `NOT_SECURED`, `RUN_CRON`, `ORCHESTRATOR_PORT`, `PORT`, `SOURCE_COMMIT`

### `blastzs.com` — `cfznwgp1pz177q1mgl5t27ob-020310565920`
`GTM_WEBHOOK_SECRET`, `N8N_BASE_URL`, `NODE_ENV`, `PORT`, `SOURCE_COMMIT` (+ build-chain vars)

### n8n — `ttcrdgrqbl70kmqffn5bo4xw-225410594405`
`N8N_BASE_URL`, `N8N_EDITOR_BASE_URL`, `N8N_HOST`, `N8N_PORT`, `N8N_PROTOCOL`, `N8N_ENCRYPTION_KEY`, `N8N_RELEASE_TYPE`, `N8N_PERSONALIZATION_ENABLED`, `N8N_DIAGNOSTICS_ENABLED`, `N8N_RUNNERS_ENABLED`, `N8N_BLOCK_ENV_ACCESS_IN_NODE`, `DB_TYPE`, `DB_POSTGRESDB_HOST`, `DB_POSTGRESDB_PORT`, `DB_POSTGRESDB_USER`, `DB_POSTGRESDB_PASSWORD`, `DB_POSTGRESDB_DATABASE`, `OPENAI_API_KEY`, `OPENAI_API_BASE_URL`, `LITELLM_MASTER_KEY`, `GEMMA_MODEL`, `GENERIC_TIMEZONE`, `PORT`, `NODE_PATH`, `WEBHOOK_URL`, `POSTIZ_URL`, `POSTIZ_SERVICE_EMAIL`, `POSTIZ_SERVICE_PASSWORD`, `EMAILZS_BASE_URL`, `EMAILZS_WEBHOOK_TOKEN_BEHAVIORAL`, `EMAILZS_WEBHOOK_TOKEN_POST_DEMO`, `EMAILZS_WEBHOOK_TOKEN_WAITLIST`, `GTM_WEBHOOK_SECRET`, `GTM_WF_DRAFT_B64`, `GTM_WF_PUBLISH_B64`, `AGENTS_CREWAI_URL`, `RUNPOD_ENDPOINT_ID`

### CrewAI — `wqobxjrim8g09qb4tetju1j9-235240581685`
`CREWAI_MAX_TOKENS`, `CREWAI_STORAGE_DIR`, `CREWAI_TELEMETRY`, `OPENAI_API_KEY`, `OPENAI_API_BASE_URL`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `LITELLM_MASTER_KEY`, `GEMMA_MODEL`, `OTEL_SDK_DISABLED`, `RUNPOD_ENDPOINT_ID`, `RUNPOD_ENDPOINT_ID_FAST`, `RUNPOD_ENDPOINT_ID_EXTENDED`, `RUNPOD_ENDPOINT_ID_IMAGE`, `PORT`, `SOURCE_COMMIT`

### AI-keys worker — `eeedwc9e99xtt5ff6e9aubyt-202913131801`
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `VIBEZS_DB`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `NODE_ENV`, `PORT`, `SOURCE_COMMIT`

### Activepieces — `activepieces-aseh3t5im89kfd1w4xdmeiel` (`automations.geniussubstrates.com`)
Backed by `activepieces-db-aseh3t5im89kfd1w4xdmeiel` (pg16) + `activepieces-redis-aseh3t5im89kfd1w4xdmeiel`; app env via Coolify (re-inspect at runtime).

### Infisical — `backend-wez37tb6lylw37bs2me0j4ja` (`secrets.geniussubstrates.com`)
Vault server; backing pg14 `db-wez37tb6lylw37bs2me0j4ja` + redis. Admin creds/secrets in `/data/infisical/docker-compose.yml` + Coolify env. Machine-identity integration vars: `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`, `INFISICAL_PROJECT_ID`, `INFISICAL_ENV` (used across platform scripts).

### SSOReady, Probo (compliance), Nextcloud (hub), MinIO, PostHog fleet
Deployed with app-specific env via Coolify + custom compose dirs under `/data/mtls`/`/data/coolify/applications`. Re-inspect per container for current var sets.

## Storage inventory (where the values live)

| Path / source | Contains |
|---|---|
| `secrets.geniussubstrates.com` (Infisical) | Vault source of truth — org/project/env secrets (UI via Traefik; CLI binary installed on host, URL base = `INFISICAL_DOMAIN`) |
| `/data/mtls/.infisical-auth` | Machine-identity `INFISICAL_CLIENT_ID/SECRET/PROJECT_ID/ENV` (chmod 600) for CLI/script auth to vault; consumed by Mission Control, Secret Access UI, sync bridge |
| `/root/scripts/infisical_invite_*.sh` | Vault invite/user-provisioning helpers |
| `/data/coolify/applications/<uuid>/.env` | Per-app env files (baked into containers at deploy) |
| Container `Config.Env` | Live merged env (Coolify vars + app vars + build vars) — **read with `docker inspect`, never guess** |
| `/data/mtls/admin-dashboard/` composer env | Mission Control tokens (Coolify API, Infisical, DO, Tailscale, Resend, secret-access) |
| `/data/mtls/developer-db/secret-access-ui/` composer env | Secret Access UI tokens |
| `/data/infisical/docker-compose.yml` (+ `.env.example`) | Infisical instance config |
| `/root/scripts/` + `/data/maintenance/` | Maintenance page htpasswd + helper credentials (host-level) |

## Refresh recipes

```bash
# sweep ALL env names from ALL running containers (values redacted) — refresh the per-app tables
for c in $(tailscale ssh root@<tailnet-ip> 'docker ps --format "{{.Names}}"'); do
  echo "=== $c ==="
  tailscale ssh root@<tailnet-ip> "docker inspect $c --format '{{range .Config.Env}}{{println .}}{{end}}'" | sed 's/=.*/=<REDACTED>/' | sort
done
# targeted: current value in-session only (never echo into chat/docs)
tailscale ssh root@<tailnet-ip> 'docker inspect <container> --format "{{range .Config.Env}}{{println .}}{{end}}"' | grep '^VAR_NAME='
# vault CLI (needs machine identity loaded from /data/mtls/.infisical-auth against INFISICAL_DOMAIN)
```

## Change log
- 2026-08-07 — Added `coder-server` (Zoe) OIDC/SSO env block + Coder OIDC refresh recipe. `CODER_OIDC_*` sourced from `/home/.z/environment/coder_oidc.env`, fetched from Infisical `/vercel/genius-os-marketing`.
- 2026-08-05 — Created. Env-name inventory captured live across all key containers (chat, ide, actions, Mission Control, Secret Access UI, analyticzs, socialzs, blastzs, n8n, crewai, ai-keys worker, activepieces, infisical, sso, probo, nextcloud, minio, posthog fleet). Role table + storage inventory built from verified names.