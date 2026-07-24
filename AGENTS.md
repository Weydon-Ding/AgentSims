# PROJECT KNOWLEDGE BASE

**Generated:** 2026-07-24  
**Commit:** a5dca64  
**Branch:** main

## OVERVIEW

AgentSims is a Python 3.9 sandbox for evaluating LLM agents in a simulated town. The backend is a Tornado WebSocket service, state is persisted in MySQL plus `snapshot/`, and the browser client is a prebuilt Unity WebGL bundle under `client/`.

## STRUCTURE

```text
AgentSims/
|-- main.py              # Tornado /ws server entry
|-- app.py               # WebSocket message dispatch + snapshot persistence
|-- tick.py              # external tick-loop WebSocket client
|-- mayor.py             # external mayor-loop WebSocket client
|-- command/             # command.* URI modules; see command/AGENTS.md
|-- model/               # custom MySQL-backed ORM models; see model/AGENTS.md
|-- agent/               # LLM agent, prompt, memory, mayor logic; see agent/AGENTS.md
|-- config/              # runtime/world/eval JSON rules; root-covered
|-- utils/               # MySQL pool, JSON helpers, Tiled conversion; root-covered
|-- client/              # prebuilt Unity WebGL static output; see client/AGENTS.md
|-- docker/              # compose entrypoint + MySQL init; see docker/AGENTS.md
|-- snapshot/            # local runtime state, ignored
`-- logs/                # local logs and prompt traces, ignored
```

## WHERE TO LOOK

| Task | Location | Notes |
|---|---|---|
| WebSocket entry or response envelope | `main.py`, `app.py` | `/ws` only; `App.execute()` wraps `{code,data,uid,msg,uri}` |
| Add or debug a client command | `command/` | URI string must match module path and class name |
| First login/world initialization | `command/auth/login_base.py`, `command/auth/Register.py` | Creates Player, Map, Town, Buildings, Equipments, NPCs, Eval |
| Tick simulation behavior | `tick.py`, `command/timetick/Tick.py` | Drives moving/chat/use/init/cache queues and eval interval |
| Model persistence | `base.py`, `model/single_model_base.py`, `model/game_model_base.py` | Dynamic model import plus custom ORM |
| NPC/LLM behavior | `agent/actor.py`, `agent/agent/agent.py`, `agent/prompt/*.txt` | `Actor.react()` maps observations to plan/act/chat/use/critic/memory |
| LLM API configuration | `agent/utils/llm.py`, `config/api_key.json`, `config/agent.json` | `models` maps in-game names to real API model names |
| Docker run/reset | `docker-compose.yml`, `Dockerfile`, `docker/entrypoint.sh` | Compose starts MySQL, server, nginx client |
| Static web client | `client/index.html`, `client/Build/`, `client/TemplateData/` | Built Unity WebGL output; no Unity source project here |

## CODE MAP

| Symbol | Type | Location | Refs | Role |
|---|---|---|---:|---|
| `WebSocketHandler.on_message` | method | `main.py` | entry | Awaits `App.execute()` for every client frame |
| `App.execute` | method | `app.py` | entry | Parses JSON, maps Mayor uid, dynamic-imports `command.*`, saves snapshot |
| `CommandBase._execute` | method | `command/command_base.py` | central | Token parsing/checking, command call, model flush |
| `Base.get_single_model` | method | `base.py` | 23 | Imports `model.{Name}Model`, caches by `{name}_{id}` |
| `LoginBase.handle_login` | method | `command/auth/login_base.py` | central | First-login world bootstrap and default NPC actor creation |
| `Tick.execute` | method | `command/timetick/Tick.py` | central | Advances game time and consumes runtime NPC queues |
| `Actor.react` | method | `agent/actor.py` | central | Converts observations into Agent plan/act/chat/use/critic/memory calls |
| `Agent.plan/act/use/chat/critic/memory_store` | methods | `agent/agent/agent.py` | central | LLM prompt pipeline and state/cache updates |
| `LLMCaller` | class | `agent/utils/llm.py` | 7 | OpenAI-compatible `/chat/completions` wrapper |
| `SingleModelBase.flush/create/retrieve/update/delete` | methods | `model/single_model_base.py` | central | Custom ORM lifecycle and table creation |
| `EvalModel.eval` | method | `model/EvalModel.py` | 1 | Executes `config/eval.json` measurement expression |
| `Mayor.decision` | method | `agent/agent/mayor.py` | central | LLM mayor action selection for building/NPC creation |

## CONVENTIONS

- Command URI is code structure: `command.foo.Bar` imports `command/foo/Bar.py` and instantiates class `Bar`.
- Model names are dynamic: `get_single_model("NPC")` imports `model/NPCModel.py` and instantiates `NPCModel`.
- `CommandBase._execute()` owns token parsing, token validation, calling `execute()`, flushing cached models, and error wrapping. Do not bypass it for WebSocket commands.
- `App.execute()` calls `save_snapshot()` after every handled message; runtime state belongs in `snapshot/app.json`, not in committed files.
- `Mayor-*` uid is rewritten to matching `Player-*` for command execution, then successful building/NPC creates are pushed back as `mayor.*.Create` messages.
- First login is a world bootstrap path, not a small auth path. Touching registration requires checking default NPCs, map/building/equipment initialization, and eval registration.
- `config/api_key.json`, `logs/`, `snapshot/app.json`, and `snapshot/mayors.json` are local runtime artifacts and ignored.

## ANTI-PATTERNS (THIS PROJECT)

- Do not rename command files/classes casually; dynamic import has no static route table to catch mismatches.
- Do not rename model files/classes casually; dynamic model loading depends on `model.{Name}Model` and `{Name}Model`.
- Treat `model/EvalModel.py:37` dynamic `eval(lambda response: ...)` as trusted-local-config only.
- Treat SQL in `model/single_model_base.py` as string-built legacy behavior; avoid adding new user-controlled interpolation.
- `command/starter/TickStarter.py` and `command/starter/MayorStarter.py` use `nohup python3.9 ... &`; this assumes POSIX shell behavior.
- Do not edit `client/Build/` or `client/TemplateData/` as if Unity source exists in this repo.

## COMMANDS

```bash
pip install -r requirements.txt
mkdir snapshot logs
python -u main.py
python -u client.py
python -u tick.py
python -u tick.py 5
python -u mayor.py
python -u mayor.py 5
docker compose up --build
docker compose down
docker compose down -v
python -m py_compile app.py main.py client.py tick.py mayor.py
```

## NOTES

- `config/api_key.json` must be created locally. `base_url` may be `/v1` root or full `/v1/chat/completions`; `models` maps `config/agent.json` logical names to real API model names.
- Docker entrypoint rewrites database host/port/user/password inside `/app/config/app.json`; it does not modify the host checkout.
- No tests, pytest config, lint config, or CI workflow were found. Use targeted `py_compile` at minimum after Python edits.
- Native Windows PowerShell is not the intended runtime for shell scripts; use Docker, WSL, Git Bash, or Linux/macOS for `restart.sh` and reset scripts.
- `.codegraph/` exists and codegraph can answer symbol/call-path questions for this repository.
