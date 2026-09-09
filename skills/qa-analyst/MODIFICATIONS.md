# Modifications vs upstream @afonsoft/qa-analyst v1.0.0 (MIT)

- Localized to en-US: removed the upstream pt-BR user-facing language requirement and all Portuguese prompt templates.
- Removed afonsoft-harness references (/create-issues command, `diagnose` skill pointer, `.specs/SPEC-*.md` gating) — spec/plan paths are now whatever the active work order provides.
- Aligned verification doctrine with Genius Substrates standards: evidence-carrying verification claims (HTTP responses, logs, DB counts, proofshots), acceptance-criteria re-checks, and the WO manifest verify gate.
