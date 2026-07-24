# COMMAND KNOWLEDGE BASE

## OVERVIEW

`command/` is the WebSocket RPC layer. `App.execute()` imports modules by URI string and every command should run through `CommandBase._execute()`.

## STRUCTURE

```text
command/
|-- command_base.py      # token check, model cache, flush, error wrapping
|-- auth/                # Register + first-login world bootstrap
|-- timetick/            # simulation tick command
|-- starter/             # shell-backed tick/mayor process starters
|-- building/, npc/      # create/read entities
|-- map/                 # scene/town/navigation commands
|-- config/              # exposes config JSON to client
`-- chat/, mayor/, player/, gm/
```

## WHERE TO LOOK

| Task | Location | Notes |
|---|---|---|
| Add a WebSocket API | `command/<area>/<Name>.py` | URI must be `command.<area>.<Name>` and class must be `<Name>` |
| Change auth/register flow | `auth/Register.py`, `auth/login_base.py` | First login initializes world, NPC actors, eval models |
| Change command lifecycle | `command_base.py` | `_execute()` owns token parsing, `execute()` call, model flush |
| Tick behavior | `timetick/Tick.py` | Largest command; queues are on `app.inited/movings/using/chatted/cache` |
| Start background loops from UI | `starter/TickStarter.py`, `starter/MayorStarter.py` | Uses POSIX `nohup python3.9 ... &` |
| Config endpoints | `config/Get*.py` | Usually `is_check_token()` returns `False` |

## CONVENTIONS

- File path, module path, URI, and class name must align exactly: `command.npc.Create` -> `command/npc/Create.py` -> class `Create`.
- Commands return plain data from `execute()`. `CommandBase._execute()` wraps errors and flushes modified models.
- Return `False` for command failure after setting `self.error(...)`; return `{'errno': ...}` only when intentionally skipping model flush.
- Use `self.check_params(params, [...])`; it checks both top-level params and `params["data"]`.
- `Register.is_check_token()` and config read endpoints disable token checks; normal player/NPC commands should not.
- Use `self.get_single_model()` / `self.get_model()` so model caching and DB cleanup remain centralized.

## ANTI-PATTERNS

- Do not instantiate model classes directly inside commands unless the dynamic model helper cannot represent the case.
- Do not bypass `_execute()` by calling a command's `execute()` from WebSocket routing.
- Do not assume Mayor has its own model path; `App.execute()` maps `Mayor-*` to `Player-*` before command execution.
- Do not make starter commands Windows-specific; current behavior is POSIX and documented as such.
- Do not silently change response envelope shape. `App.execute()` expects command output under `res["data"]` or `res["error"]`.
