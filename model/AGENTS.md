# MODEL KNOWLEDGE BASE

## OVERVIEW

`model/` is a custom MySQL persistence layer, not a standard ORM. Models are dynamically loaded by name and persist fields declared in each model's `orm` mapping.

## WHERE TO LOOK

| Task | Location | Notes |
|---|---|---|
| Single-id model lifecycle | `single_model_base.py` | `init`, `retrieve`, `flush`, `create`, `update`, `delete` |
| Global/game tables | `game_model_base.py`, `model_base.py` | Used for non-sharded/global tables |
| Player state/revenue | `PlayerModel.py` | Player account-facing state |
| NPC state/events/chat/cash | `NPCModel.py`, `NPCsModel.py`, `NPCRegisterModel.py` | NPC entity and registry split |
| Map and movement | `MapModel.py` | Positions, names, navigation helpers |
| Buildings/equipment | `BuildingsModel.py`, `EquipmentsModel.py` | World objects and facilities |
| Evaluation | `EvalModel.py` | LLM query plus dynamic measurement expression |

## CONVENTIONS

- Dynamic model loading is strict: `get_single_model("NPC")` imports `model.NPCModel` and class `NPCModel`.
- Every `SingleModelBase` subclass starts with `orm = {'id': INT}` and adds persisted fields in `__init__()`.
- `init()` sets defaults for newly created rows; `retrieve()` loads existing rows; `save()`/modified tracking comes from the base model chain.
- `SingleModelBase.get_db()` shards by `id / config.db_user_per_db` into `game0001`, `game0002`, etc.
- JSON/object fields are stored as `MEDIUMTEXT` after `json.dumps`; string fields are capped at 255 chars.
- Commands rely on cached model instances being flushed by `CommandBase._execute()` after successful command data returns.

## ANTI-PATTERNS

- Do not rename `FooModel.py` or `FooModel` without updating every dynamic loader call.
- Do not add persisted fields without adding both default initialization and an `orm` entry.
- Do not assume SQL is parameterized. `single_model_base.py` builds SQL strings and escapes only by legacy replacements.
- Do not treat `EvalModel` like a normal persisted model; its `retrieve()` is a placeholder for `get_single_model()` compatibility.
- Do not use untrusted `config/eval.json` measurement text; `EvalModel.eval()` executes it through `eval()`.

## HIGH-RISK FILES

- `single_model_base.py`: CRUD SQL string construction, table auto-create, DB shard selection.
- `MapModel.py`: location, uid/name mappings, path and scene state.
- `NPCModel.py`: NPC cash, events, chat history, action pushes to player.
- `EvalModel.py`: LLM answer evaluation via trusted-local dynamic expression.
