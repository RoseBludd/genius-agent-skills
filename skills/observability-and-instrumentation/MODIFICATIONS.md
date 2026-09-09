# Modifications vs upstream @afonsoft/observability-and-instrumentation v1.0.0 (MIT)

- Ecosystem notes added: logs land in Loki (/dev/shm/<service>.log indexed at http://localhost:3100 on the Genius Substrates host); severity tiers match the intel signal model (page -> needs-decision signals, ticket -> scheduled work).
- No substantive process changes — the upstream methodology was adopted nearly verbatim.
