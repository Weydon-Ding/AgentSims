# Issues — unity-frontend-migration

Problems and gotchas encountered during work on this plan.

_Auto-scaffolded by /start-work. Append new entries below - never overwrite._

---

## T1: Scaffold Issues

### Windows Subprocess Execution
- **Problem**: Direct execution of `node_modules/.bin/tsc` fails on Windows with `WinError 193`
- **Root Cause**: Windows requires `.cmd` wrapper or `npx` for npm binaries
- **Fix**: Use `npx tsc` with `shell=True` in subprocess.run() for cross-platform compatibility
- **Location**: `scripts/run_negative_fixture.py:run_tsc_check()`

### Vitest jsdom Dependency
- **Problem**: Initial test run failed with "Cannot find package 'jsdom'"
- **Root Cause**: jsdom is required for Vitest's browser environment but not in initial package.json
- **Fix**: Added `jsdom: ^24.1.3` to devDependencies
- **Lesson**: Always verify test environment dependencies before first run

### Test Fixture Path Resolution (Round 1)
- **Problem**: Negative fixture test couldn't find fixture files
- **Root Cause**: Path used `../../test-fixtures` from `src/__tests__/negative/` but should be `../../../test-fixtures`
- **Fix**: Corrected relative path in test file
- **Lesson**: Use `path.join(__dirname, ...)` and verify with console.log during debugging

### Vite Dev Server Port
- **Problem**: Initial vite.config.ts used port 3000, but Vite default is 5173
- **Impact**: Playwright E2E tests would fail with wrong baseURL
- **Fix**: Changed server port to 5173 and Playwright baseURL to match

### Playwright webServer.url
- **Problem**: `playwright.config.ts` had `use.baseURL` at 5173 but `webServer.url` still at 3000
- **Impact**: Playwright would wait for wrong URL when starting dev server
- **Fix**: Changed `webServer.url` to `http://localhost:5173`

### tsconfig.node.json Coverage
- **Problem**: Initial config only included `vite.config.ts` and `scripts/*.cjs`
- **Impact**: `tsc -b` would not type-check vitest.config.ts, playwright.config.ts, or .mjs scripts
- **Fix**: Added all config files and changed to `scripts/*.mjs`

### ESLint Ignoring Fixtures
- **Problem**: ESLint reported errors in `test-fixtures/negative/type-error.fixture.ts`
- **Root Cause**: Negative fixtures intentionally contain type errors
- **Fix**: Added `test-fixtures` to ESLint `ignorePatterns`

### Build Artifacts Cleanup
- **Problem**: TypeScript and Vite generated `.tsbuildinfo`, `.js`, `.d.ts` files
- **Fix**: Added to `.gitignore` and cleaned up manually

### Prettier Format Checks
- **Problem**: Initial files didn't match Prettier formatting
- **Fix**: Ran `npx prettier --write` to fix all files

### JSON Fixture Missing tsconfig
- **Problem**: Initial `type-error.fixture.json` referenced non-existent `tsconfig.fixture.json`
- **Impact**: Test would "pass" due to missing file error, not actual type error
- **Fix**: Removed command dependency; runner now uses `run_tsc_check` for TypeScript fixtures

### Vitest __dirname Path Resolution
- **Problem**: Test used `join(__dirname, '../../../test-fixtures/negative')` which resolved incorrectly
- **Root Cause**: `__dirname` in Vitest ESM context doesn't work as expected
- **Fix**: Use `resolve(process.cwd())` to get frontend root, then join from there

### Generated Artifacts in ESLint Scan (Round 3)
- **Problem**: `npm run lint` scanned `playwright.config.d.ts` and reported `@typescript-eslint/no-empty-object-type`
- **Root Cause**: TypeScript/Vite generated `.d.ts` and `.tsbuildinfo` files were not ignored
- **Fix**: 
  1. Added `*.d.ts`, `*.tsbuildinfo`, `*.config.js` to `.eslintrc.cjs` `ignorePatterns`
  2. Changed `tsc -b` to `tsc` in package.json (removes composite mode, no tsbuildinfo)
  3. Removed `composite: true` from tsconfig.node.json
  4. Added comprehensive patterns to `.gitignore`
- **Lesson**: Never let lint scan generated files; use `noEmit` and avoid `composite` for config-only tsconfig

### Tailwind CSS Not Processing (Round 4)
- **Problem**: Build output CSS (`dist/assets/*.css`) contained raw `@tailwind base;@tailwind components;@tailwind utilities;` instead of generated utility classes
- **Root Cause**: `postcss.config.js` and `tailwind.config.js` were deleted during artifact cleanup; Tailwind/PostCSS had no configuration to process directives
- **Fix**: 
  1. Recreated `postcss.config.js` with ESM export: `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }`
  2. Recreated `tailwind.config.js` with proper `content` array: `['./index.html', './src/**/*.{js,ts,jsx,tsx}']`
  3. Added custom `primary` color palette to match App.tsx usage
  4. Created `src/__tests__/tailwind-build.smoke.test.ts` to verify build output contains no raw `@tailwind` and has Tailwind utilities
- **Verification**: CSS file size increased from 0.40 kB (raw) to 6.88 kB (processed); no `@tailwind` in output; smoke test passes
- **Lesson**: Config files are NOT build artifacts - never delete them during cleanup

## T4: Mayor NPC Create Push Shape

- **Problem**: `mayor.npc.Create` 曾被错误建模为 `NPCDTO`，handler 因缺少 `id` 回退写入 `NPC-0`。
- **Root Cause**: `app.py` 转发的是 `command.npc.Create` 的 response，其中有 `uid`、`nickname` 和 camelCase building 字段，没有 DTO `id`。
- **Fix**: 推送协议复用 `RequestResponseData['command.npc.Create']`，并以 `data.uid` 对实体 partial 映射。测试同时断言 `NPC-2` 存在且 `NPC-0` 不存在。

## T4: Known URI Malformed Data Guard

- **Problem**: 仅验证 `data` 是对象会让 `{ uri: 'movePath', data: {} }` 进入 reducer，可能以 undefined key 污染 store。
- **Fix**: 新增按 URI 的字段级 guard；未知输入仅在满足 reducer 读取字段后才会分发，否则记录 `Malformed push frame`。测试锁定空 `movePath` 无异常、无 `paths.undefined` 和日志副作用。
- **Coverage**: `newAction` 的 action state 在 `finishAction` 到来前单独断言，避免后续状态覆盖掩盖 handler 缺失。

## T5: Existing Envelope Constraint

- **Problem**: 初版 fake response 只有 `code`、`uid`、`uri`、`data`，使真实 `WsClient.isEnvelope()` 拒绝它并造成回放超时。
- **Fix**: conformance mock 现在发送与 `ResponseEnvelope` 一致的 `msg: ''`；这让测试经过真实 transport guard 和 correlation FIFO，而不是直接调用内部函数。
- **Scope**: 未修改 T3 transport 行为；这只是使 T5 mock 忠实于既有服务器 envelope 合同。
