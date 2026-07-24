# AGENT KNOWLEDGE BASE

## OVERVIEW

`agent/` contains the LLM behavior layer. `Actor` adapts simulation observations into `Agent` plan/act/chat/use/critic/memory calls, while prompt templates and LLM API access live nearby.

## STRUCTURE

```text
agent/
|-- actor.py                 # world observation -> Agent action adapter
|-- agent/agent.py           # main LLM pipeline
|-- agent/mayor.py           # mayor-specific LLM decision loop
|-- agent/components/        # state, cache, prompt, memory, controller
|-- prompt/                  # Prompt loader + *.txt templates
`-- utils/llm.py             # OpenAI-compatible caller
```

## WHERE TO LOOK

| Task | Location | Notes |
|---|---|---|
| Observation handling | `actor.py` | `Actor.react()` switches on `observation["source"]` |
| Plan/act/use/chat/critic | `agent/agent.py` | Core LLM prompt pipeline |
| Memory shape | `agent/components/memory_store.py` | Serialized into snapshots through Actor/Agent state |
| State/cache fields | `agent/components/state.py`, `agent/components/cache.py` | Used across prompts and tick parsing |
| Prompt text | `prompt/*.txt`, `agent/components/prompt.py` | Templates use placeholder replacement |
| LLM API calls | `utils/llm.py` | Reads `config/api_key.json` and maps model names |
| Mayor decisions | `agent/mayor.py`, root `mayor.py` | Mayor sends building/NPC create commands via WebSocket |

## CONVENTIONS

- `Actor.react()` is the boundary from simulation to LLM. Tick code should not call `Agent.plan()`/`act()` directly.
- Observation sources include `inited`, `timetick-finishMoving`, `timetick-finishUse`, `timetick-finishChatting`, `chatted`, `addBuilding`, `timetick-storeMemory`, and `cover-prompt`.
- `Agent` writes prompt traces to `logs/{name}_prompt.txt`; these logs are runtime artifacts.
- Prompt outputs are expected to be JSON-like dicts. `LLMCaller` wraps unparseable responses as `{"response": ...}`.
- `Controller(memorySystem, planSystem)` selects behavior families such as `LongShortTermMemories` and `QAFramework` from config.
- Mayor logic uses `LLMCaller("default")`, validates action choices, then root `mayor.py` sends `command.building.Create` or `command.npc.Create`.

## ANTI-PATTERNS

- Do not edit prompt placeholders without checking every `get_text(..., {...})` call that fills them.
- Do not add silent fallback LLM behavior that hides invalid model/config problems; missing `config/api_key.json` should remain visible.
- Do not mutate `Agent.state` fields from command code directly; route through `Actor.react()` or model state updates.
- Do not treat mayor decisions as player commands. The mayor loop is an external WebSocket client that triggers normal commands.
- Do not commit prompt logs from `logs/`.
