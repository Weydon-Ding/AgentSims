# DOCKER KNOWLEDGE BASE

## OVERVIEW

`docker/` contains container startup and MySQL initialization logic. The root `Dockerfile` and `docker-compose.yml` are part of this deployment boundary.

## WHERE TO LOOK

| Task | Location | Notes |
|---|---|---|
| Server image | `../Dockerfile` | Python 3.9 slim, installs `requirements.txt`, runs `python -u main.py` |
| Compose stack | `../docker-compose.yml` | Services: `mysql`, `server`, `client` |
| Runtime config injection | `entrypoint.sh` | Rewrites DB fields inside `/app/config/app.json` |
| Initial databases | `mysql/init.sql` | Creates `llm_account`, `llm_game`, `llm_game0001`, `llm_game0002` |
| Static client serving | `../docker-compose.yml` | nginx mounts `./client` at `/usr/share/nginx/html:ro` |

## CONVENTIONS

- Compose exposes WebSocket server on `localhost:8000` and static web client on `localhost:8081`.
- `server` mounts `./logs`, `./snapshot`, and `./config/api_key.json:/app/config/api_key.json:ro`.
- `entrypoint.sh` reads `AGENTSIMS_DB_*` env vars and overwrites database host/port/user/password fields in container-local `/app/config/app.json`.
- `AGENTSIMS_WAIT_FOR_DB=1` makes the entrypoint wait for MySQL before starting the Python server.
- MySQL runs `mysql:8.0.31` with empty root password for local sandbox usage.

## ANTI-PATTERNS

- Do not describe entrypoint config rewrite as modifying the host checkout; it only changes container-local `/app/config/app.json`.
- Do not remove the `api_key.json` bind mount unless another secret injection path replaces it.
- Do not assume `restart.sh` behavior applies inside compose; compose starts `python -u main.py` through the container command.
- Do not add production-hardening claims here; this compose file is a local/dev sandbox stack.
