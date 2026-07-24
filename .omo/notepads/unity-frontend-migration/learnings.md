# Learnings — unity-frontend-migration

Conventions, patterns, and successful approaches discovered during work on this plan.

_Auto-scaffolded by /start-work. Append new entries below - never overwrite._

---

## T1: Frontend Scaffold Success Patterns

### Toolchain Selection
- React 18 + Vite 5 + TypeScript 5.5 provides fast HMR and strict type checking
- Vitest 2.x with jsdom for unit testing; Playwright for E2E
- Tailwind CSS 3.4 with PostCSS for utility-first styling
- Zustand for lightweight state management; Pixi.js v8 for WebGL rendering

### Negative Fixture Harness
- Python script (`run_negative_fixture.py`) runs TypeScript compiler on fixtures
- Uses temp directories to avoid polluting source tree
- `--self-test` mode verifies harness detects failures correctly
- Cross-platform: use `npx tsc` with `shell=True` on Windows
- **JSON fixture support**: `--fixture <path>` runs JSON-defined fixtures with `type`, `files`, `expect_fail`, `temp_dir` fields
- **TypeScript fixtures**: Automatically run tsc on each file in `files` array
- **Shell fixtures**: Run arbitrary command when `type=shell`

### Bundle Analysis
- `rollup-plugin-visualizer` generates `test-results/bundle-stats.html`
- `gzip-size` library measures compressed size
- 1.5 MB gzip limit for initial JS bundle

### ESLint Custom Rules
- `lint:no-any` script detects unallowed `any` types
- `lint:no-console` script detects production console.log
- Both support `// allow:*` comments for justified exceptions

### Test Evidence Artifacts
- `test-results/t01-build.txt` - build output
- `test-results/t01-fail.txt` - negative fixture test output
- `test-results/bundle-stats.json` - machine-readable bundle report

### Vite Dev Server Port
- Default port is 5173 (not 3000)
- Playwright baseURL AND webServer.url must both match: `http://localhost:5173`

### tsconfig.node.json
- Include all config files: `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `scripts/*.mjs`
- Scripts use `.mjs` extension for ES modules
- Use `noEmit: true` (remove `composite`) to avoid generating `.tsbuildinfo` files

### Vitest Path Resolution
- Use `resolve(process.cwd())` for reliable path resolution in tests
- `__dirname` may not work as expected in Vitest ESM context

### ESLint Generated File Handling
- Ignore `*.d.ts`, `*.tsbuildinfo`, `*.config.js` in `.eslintrc.cjs`
- Use `tsc` (not `tsc -b`) for typecheck to avoid generating `.tsbuildinfo`
- Add all generated patterns to `.gitignore`

### Tailwind CSS Configuration
- PostCSS config must be in ESM format (`postcss.config.js` with `export default`) for Vite
- Tailwind config must include `content` array pointing to `./index.html` and `./src/**/*.{js,ts,jsx,tsx}`
- Custom colors (like `primary-*`) must be defined in `tailwind.config.js` theme.extend.colors
- Verify Tailwind is working by checking dist CSS does NOT contain raw `@tailwind` directives
- Add smoke test (`src/__tests__/tailwind-build.smoke.test.ts`) to prevent regression

## T2: Typed Protocol Contract

- Keep request identity formats in the per-URI data map: `ChatWithNPC.NPCID` is `NPC-<id>`, while `GetNPCInfo.NPCID` and `GetBuildingInfo.buildingID` are bare numbers.
- A `RequestFrame` discriminated union derived from the URI map preserves URI-to-data pairing for later WebSocket callers.
- Windows Vitest child processes should use `spawnSync(..., { shell: true })` when invoking `npx`; it permits the negative URI fixture to exercise the real TypeScript compiler.
- DTO `id` fields are optional because backend `as_object(False)` deliberately omits them; runtime DTO field tests cover this serialization behavior.
- `command.npc.Create` writes `work_building_` instead of ORM field `work_building`; newly created NPC DTOs therefore legitimately serialize `work_building: null`, which the client contract must preserve as `number | null`.
- Keep request responses in an exhaustive `RequestResponseData` URI map rather than a generic record; this preserves the data contract used by each later WebSocket caller.
- `welcome` is the only verified push without a `data` key, so its optionality belongs in the `PushFrameByUri<'welcome'>` conditional branch rather than in every push frame.

## T3: WebSocket Correlation and Recovery

- Backend responses have no request ID, so correlation must serialize outbound frames by `(normalizedUid, uri)` and only dispatch the queue head; a response may then safely release exactly one caller and send the next queued frame.
- `app.py` rewrites Mayor outbound command UIDs to Player UIDs before emitting the ordinary response. Normalize `Mayor-<id>` to `Player-<id>` only for correlation keys, while preserving the original frame sent to the backend.
- Keep incoming pushes and unmatched envelopes behind client event subscriptions. This lets T4 own state mutation without coupling the transport to Zustand.
- A keepalive needs a remembered active UID after the business queue drains. Otherwise an interval exists but never emits a ping during the idle period it is intended to protect.
- Use injected, event-driven WebSocket fakes plus Vitest fake timers for reconnect and timeout paths; do not depend on a live Tornado/MySQL process.
- The 250 pure-LOC ceiling is a shipping constraint, not a reporting estimate: keep `WsClient` orchestration separate from transport guards/correlation helpers and exported error types, then remeasure every `ws-client*.ts` file before handoff.
- Correlation regression coverage must mix `Mayor-<id>` and `Player-<id>` requests for the same URI: both normalize to one key, so the second frame must remain unsent until the first `Player-<id>` response drains the shared FIFO queue.

## T4: Push Store And Dispatch Patterns

- 每个 Zustand store 暴露 `reset()`，使协议 fixture 在 `beforeEach` 中从确定性空状态开始，不需要测试专用分支。
- 推送处理器以 `satisfies { [U in PushUri]: ... }` 的完整 URI 映射约束覆盖范围；新增 `PushUri` 会在编译期要求补齐 handler。
- `chatWith` 通过 `'chats' in data` 区分历史记录与直接消息；未知或畸形原始帧经 `dispatchIncomingPush(unknown)` 写入日志且不抛出。
- `mayor.npc.Create` 由 `app.py` 原样转发 `command.npc.Create` response，不是 `NPCDTO`：必须以 response 的 `uid` 建实体键，并将 `nickname`、camelCase building 字段显式映射到 NPC partial；回归测试必须断言不会创建 `NPC-0`。
- `dispatchIncomingPush` 是未知 WebSocket 帧的唯一边界，不能只验证 `data` 为对象；按 URI 校验 handler 会读取的字段后才可进入 store，避免 `{ uri: 'movePath', data: {} }` 生成 `paths.undefined`。
- 对会覆写同一 store key 的推送，必须在下一事件分发前断言中间状态；`newAction` 在 `finishAction` 前的单独断言防止其 handler 被后续事件掩盖。
