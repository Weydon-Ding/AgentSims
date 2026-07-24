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
