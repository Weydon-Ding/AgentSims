# CLIENT KNOWLEDGE BASE

## OVERVIEW

`client/` is a prebuilt Unity WebGL client served as static files. This repository does not contain the Unity source project or a frontend build pipeline.

## STRUCTURE

```text
client/
|-- index.html          # WebGL loader page
|-- Build/              # Unity WebGL build artifacts
`-- TemplateData/       # Unity static assets/styles
```

## WHERE TO LOOK

| Task | Location | Notes |
|---|---|---|
| Browser entry | `index.html` | Loads Unity WebGL build and connects to backend behavior |
| WebGL binary/assets | `Build/` | Built output; no source-level editing context here |
| Loader styling/assets | `TemplateData/` | Unity template resources |
| Docker static serving | `../docker-compose.yml` | nginx mounts this directory read-only |
| WebSocket server | `../main.py`, `../app.py` | Backend listens on `/ws` at port 8000 |

## CONVENTIONS

- Treat `Build/` and `TemplateData/` as generated artifacts unless the user explicitly provides Unity rebuild output.
- Client-facing API behavior is controlled by backend WebSocket commands, not by a JavaScript/TypeScript source app in this repo.
- Docker serves this directory via nginx on `http://localhost:8081`.
- Local README also supports opening `client/index.html` directly in a browser/IDE.

## ANTI-PATTERNS

- Do not hand-edit minified/compressed WebGL build files to implement product behavior.
- Do not assume npm, Vite, React, or another frontend toolchain exists here.
- Do not add generated Unity build files to docs as if they were source examples.
