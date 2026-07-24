# unity-frontend-migration - Work Plan

## TL;DR (For humans)
**你会得到什么。** 仓库中会新增一个全新的 `frontend/` 目录：一个 React 18 + Vite + TypeScript 单页应用。它会在**不改变**现有 Tornado WebSocket 协议的前提下工作（`ws://host:8000/ws`，请求帧 `{uid,uri,method,data}` -> 响应信封 `{code,data,uid,msg,uri}`），并以完整功能对等的方式替换闭源 Unity WebGL bundle。2D 的 143×81 格子小镇用 Pixi.js v8（Canvas/WebGL）渲染；面板、聊天、表单用 React DOM；状态管理用 Zustand；样式用 Tailwind + shadcn 风格 primitives。它会通过 nginx 网关与 Unity bundle 共存（`/` -> 新构建，`/legacy` -> 旧 `client/`），因此在对等性证明完成前 Unity 始终是可工作的回退方案，之后再退役。新 SPA 直接连接后端 WebSocket：`ws://host:8000/ws`（与 Unity 一致）——不引入 nginx `/ws` 代理。

**为什么采用这种方案。** Unity 客户端是闭源的（仓库里没有源码，也没有构建管线——见 `client/AGENTS.md`），因此唯一稳定且可验证的契约就是后端 WebSocket 层。保持后端不变，等于把协议固定为契约，让旧 Unity bundle 在整个迁移过程中继续作为黄金回退；也意味着每个前端行为都可以用后端真实帧来证明。所谓“渐进式迁移”采用 strangler-fig（绞杀者）共存，而不是一次性大爆炸替换。完整范围是：20 个 working command URI + 1 个 backend-broken command URI + `ping` = 22 个 request URI，再加 15 个 push URI；这些会拆成 6 个可独立交付的组件（C1-C6），按能交付价值且可独立测试的顺序执行。

**不会做什么。** 不修改后端 Python/MySQL（WS 协议冻结）。不恢复或反编译 Unity 源码。不新增超出现有 Unity demo 对等范围的功能。不做移动原生构建。不做 SSR（纯静态 SPA）。在 Wave 7 证明对等前，不移除 `client/`。Mayor 的 `nohup python3.9` starter 保持 POSIX 行为（后端不变）；前端只负责发送对应 URI。

**工作量。** 8 个 wave，29 个实现 todo（每个都含测试），4 个最终验证器。架构级工作。

**风险。** Unity 是闭源的 -> 帧契约只能从后端代码反推；如果 Unity 依赖某个后端代码中没有显式 push 的帧，就可能漏掉。缓解方式是 Wave 7 的 T26：捕获真实 Unity 会话的 WS 流量作为 golden trace 并做 diff。地图是 143×81 稀疏字典 -> 需要 Pixi culling（T14）。`chatWith` 有两种 data variant（T19）。

**我替你做出的决策。** 我把这个需求视为开放式（UNCLEAR）并选择了默认方案；如果你原本有明确目标，请说明，我会切换到逐项询问模式。已采用：A1 stack = React+Vite+TS —— **你选择的方案**；A2 地图使用 Pixi v8 + React DOM chrome；A3 strangler nginx gateway，`frontend/` 目录，`/legacy` -> Unity，开发环境 `:5173` 代理 `/ws` -> `:8000`；A4 后端冻结为契约；A5 全量对等、分阶段（不是 MVP 缩减）；A6 Zustand；A7 Tailwind + shadcn 风格。除 A4（不改动）外均可逆。因为这是 UNCLEAR + 非 Trivial，请求已自动进入双高精度评审（momus + independent oracle），记录在 `.omo/drafts/unity-frontend-migration.md`。

## Scope
**In scope.** 基于现有后端 WebSocket 契约，构建一个新的 TypeScript 前端，与闭源 Unity demo 达到完整功能对等：
- 精确发送请求帧 `{uid, uri, method, data}`，并处理响应信封 `{code, data, uid, msg, uri}`（`app.py:144-228`）。
- 实现客户端可能发送的 **22 个 request URI case**：`ping` + 20 个 working `command.*` URI + backend-broken `command.npc.ChangePrompt`：`command.auth.Register`、`command.building.{Create,GetBuildings,GetBuildingInfo}`、`command.npc.{Create,GetNPCs,GetNPCInfo}`、`command.npc.ChangePrompt`（backend-broken，见下文）、`command.map.{Navigate,GetMapScene,GetMapTown}`、`command.chat.ChatWithNPC`、`command.player.GetPlayerInfo`、`command.mayor.GetInfo`、`command.config.{GetBuildingsConfig,GetNPCsConfig,GetEquipmentsConfig}`、`command.timetick.Tick`、`command.starter.{TickStarter,MayorStarter}`、`command.gm.FakeSendings`。（`command_base.py` 和 `command/auth/login_base.py` 是基类，不可派发，排除。）
- 处理全部 **15 个 server-push URI**（无请求、服务端主动发入）：`welcome`、`movePath`、`moveTo`、`NPC-React`、`newPlan`、`planToMove`、`chatWith`（两种 data variant）、`interact`、`newAction`、`finishAction`、`changeCash`、`changeRevenue`、`increaseBuildingIncome`、`mayor.npc.Create`、`mayor.building.Create`。
- 渲染 143×81 稀疏瓦片地图（`MapModel`）、建筑、设备、NPC/player 精灵；根据 push 动画化移动与交互。
- 提供 NPC/building/equipment/player inspect 面板、创建流程、聊天、mayor mode、simulation control、dev console。
- 新增 `frontend/` Vite build + nginx gateway，与旧 Unity bundle 共存；开发服务提供 `/ws` proxy。

**Known backend-broken endpoint（已知后端坏端点，修复不在范围内）。** `command.npc.ChangePrompt` —— `command/npc/ChangePrompt.py` 定义的是 `class GetNPCInfo`（复制粘贴错误），因此 `App.execute` 中的 `getattr(module, "ChangePrompt")`（`app.py:182`）会在正常 command error wrapping 之前抛出 `AttributeError`。前端仍然要发送该 URI，以便与 Unity 可能的行为保持对等，但必须把 bounded timeout/no-envelope/socket-close 显示为“feature unavailable”；后端修复是单独的 out-of-scope 任务（Must-NOT-Have 禁止编辑 `command/**`）。Parity matrix 不把 ChangePrompt 计入 working 数量。

- NPC/building/equipment/player inspect 面板 + create flows + chat + mayor mode + sim control + dev console。
- 新 `frontend/` Vite build + nginx gateway 与旧 Unity bundle 共存；开发服务使用 `/ws` proxy。

**Out of scope (Must-NOT-Have).** 不编辑 `main.py`、`app.py`、`command/**`、`model/**`、`agent/**`、`config/**`、`utils/**`、`base.py`、`tick.py`、`mayor.py`、`docker-compose.yml` 的 server/mysql services、`docker/**`。不恢复/反编译 Unity 源码。不新增超出现有 Unity demo 对等范围的功能。在 Wave 7 对等证明完成前不移除 `client/`。不新增后端协议（如果发现缺失 push，只记录为风险，不在本计划添加后端代码）。不做 SSR/Next.js。不做移动原生。不让浏览器直接访问数据库（前端只讲 WS）。

## Verification strategy
**每个 todo 的 agent-executed QA**（零人工介入）：每个 implementation todo 都包含 happy + failure 场景、精确工具调用、以及 `frontend/test-results/` 下的 evidence path。技术栈：Vitest（unit）、Playwright（对运行中后端做 E2E）、MSW/websocket-mock（ framed protocol tests）。

**Protocol-conformance first (T5):** 用 mock WS server 回放 recorded frames 的 Vitest harness，断言每个 URI（20 个 working command URI + 1 个 backend-broken command URI + `ping` = 22 个 request URI，再加 15 个 push URI）要么 round-trip，要么以明确记录的方式失败。这是主干；后续 UI todo 复用其 fixtures。

**Golden-trace parity (T26):** 通过 Playwright/CDP 自动捕获真实 Unity 会话的 WebSocket 流量 -> JSON fixtures；把新前端发出/处理的帧按 URI 与 golden trace 做 diff。这在不手动导出 DevTools 的情况下关闭闭源契约推断风险（R1）。

**Field-shape verification (T28):** 读取每个 model 的 `orm` dict（`model/NPCModel.py`、`MapModel.py`、`BuildingsModel.py`、`EquipmentsModel.py`、`PlayerModel.py`、`TownModel`），并断言 TS types 与 `as_object` 输出（`single_model_base.py:37`）一致。

**TDD posture:** tests-after per todo（实现 + 测试 = 一个 todo）；protocol SDK（Wave 1）tests-first。

**Exact QA invocation convention:** 除非某个 todo 自行覆盖，否则以 `cd frontend && ...` 开头的命令必须把 evidence 写到 `test-results/...`（相对 `frontend/`）；从 repo root 运行的命令必须写到 `frontend/test-results/...`。每个 Vitest QA 使用 `cd frontend && npx vitest run <test-file-or-pattern> --reporter=verbose | tee test-results/<todo>.txt`；每个 Playwright QA 使用 `cd frontend && npx playwright test <spec> --reporter=line --output=test-results/<todo>-artifacts | tee test-results/<todo>.txt`；每个 build/lint QA 使用文中 literal command，并把输出 pipe 到指定 evidence path。Verifier 必须检查 exit code、assertion/test count、非空 artifact，不能只检查文件存在。

**Final verification wave (F1-F4):** 并行、agent-executable，全部必须 APPROVE。

## Execution strategy
8 个 wave，严格按顺序执行；同一 wave 内 todo 可以并行。依赖流：C1（protocol）-> C2（shell/auth）-> C3（map）-> C4（panels）-> C5（chat/mayor）-> C6（sim/build）-> Wave 7（parity/hardening）-> Wave 8（final）。只有当 acceptance + 两个 QA 场景通过且 evidence 已写入时，一个 todo 才算 DONE。每个 todo 原子提交（conventional-commit）。执行者读取引用的精确 command/model 文件（无需再做判断）；已验证契约嵌入如下。

**Verified protocol contract（所有 todo 的权威依据）：**
- 连接后服务端 push `{"code":200,"uri":"welcome","msg":"Welcome"}`（`app.py:100`）。
- 请求帧：`{uid, uri, method, data}`。`method` KEY 必须存在才会派发（`if "uri" in info and "method" in info:`，`app.py:171`）；其值不用，但省略 `method` 会完全阻止派发。`uid` ∈ `Player-<id>` | `Mayor-<id>` | `NPC-<id>`；`Mayor-*` 在 command exec 前会被改写为 `Player-*`（`app.py:163-170`）。
- 响应信封：`{code,data,uid,msg,uri}`；`code` 200=ok，500=`doRefresh` error，501=plain error（`app.py:191-200`）。注意：默认 no-URI error（`app.py:149`）没有 `uri` key；只有 command/ping 已派发时才会 echo `uri`。
- Command dispatch：`uri` == importlib module path == `command.<area>.<Name>`，class == 最后一段，通过 `getattr(module, uri.split('.')[-1])` 获取（`app.py:178-186`）。`command/**` 下有 22 个 `.py` 文件；减去 `command_base.py` 和 `command/auth/login_base.py`（基类，不可派发——`getattr` 会找不到大小写不匹配的 class name）= **21 个 callable command module**，其中 `command.npc.ChangePrompt` backend-broken（class 名为 `GetNPCInfo`），所以 **20 个 working command URI + 1 个 broken command URI + `ping` = 22 个 request URI**。
- **NPCID param format 是按调用变化的：** `command.chat.ChatWithNPC` 要求 `data.NPCID` 是完整 token `"NPC-<id>"`，并解析 `int(NPCID.partition("-")[2])`（`ChatWithNPC.py:15`）；`command.npc.GetNPCInfo` 要求 `data.NPCID` 是裸整数 id，并直接传给 `get_single_model("NPC", id=NPCID)`（`GetNPCInfo.py:11,13`）；`command.building.GetBuildingInfo` 要求 `data.buildingID` 是裸 int，并用 `==` 比较（`GetBuildingInfo.py:11,13`）。Typed params 必须按 URI 编码这种差异。
- `as_object(include_id)` 通过 `getattr` 序列化 `self.orm` 中的每个 key（`single_model_base.py:37`）；当 `include_id=False` 时 `id` 字段会被省略。**id 是否存在也按调用变化：** `command.npc.GetNPCs` 使用 `as_object(True)`（包含 id，`GetNPCs.py:14`）；`command.npc.GetNPCInfo` 和 `command.chat.ChatWithNPC` 使用 `as_object(False)`（不含 id，`GetNPCInfo.py:18`，`ChatWithNPC.py:64`）。DTO 必须声明 `id?` optional，并且 conformance tests 必须按调用断言。
- NPC orm fields（`NPCModel.py:41-71`）：name、server、map、cash、x、y、rotation、asset、model、memorySystem、planSystem、bio、goal、home_building、work_building、reg_time、login_time、refresh_time、timezone、path、act、plan、event、last_move、act_timeout、chats。
- Map orm fields（`MapModel.py:17-23`）：seed、centerX、centerY、width、height、map、name2uid。`map` 是稀疏结构 `{str(x):{str(y):{block,uid,building,equipment}}}`，width 143，height 81，4-neighbour BFS `navigate`。
- Buildings orm（`BuildingsModel.py:38`）：`buildings` array of `{id,n,o,t,lx,ty,rx,by,r,x,y,eI,eE,eT,hL,hC,lL,lC,rI,rT}`。
- Equipments orm（`EquipmentsModel.py:31`）：`equipments` array of `{id,n,d,o,t,lx,ty,rx,by,r,b,fs,m,s}`。
- Player orm（`PlayerModel.py:24-36`）：name、x、y、rotation、revenue、reg_time、login_time、refresh_time、timezone、path、last_move、chats。`get_token` -> `Player-<id>`。
- Push URI -> source + data shape（已验证）：`movePath`{uid,data:{uid,path:[{x,y}]}}（`Tick.py:39`）；`moveTo`{uid,data:{uid,fromX,fromY,toX,toY}}（`Navigate.py:34`）；`NPC-React`{uid,data:{uid,reaction}}（`Tick.py:156`）；`newPlan`{uid,data:{uid,plan}}（`Tick.py:162`）；`planToMove`{uid,data:{uid,targetBuilding,targetBuildingID}}（`Tick.py:187`）；`chatWith` variant-A {uid,data:{sourceID,targetID,content}}（`ChatWithNPC.py:25,48`）以及 variant-B {uid,data:{chats:[{content,speaker,speakerID}]}}（`Tick.py:138`）；`interact`{uid,data:{uid,equipment,operation,continueTime,cost,earn}}（`Tick.py:258`）；`newAction`{uid,data:{uid,...action}}（`NPCModel.py:146`）；`finishAction`{uid,data:{uid,action,startTime,endTime}}（`NPCModel.py:132`）；`changeCash`{uid,data:{uid,cash,amount,effect}}（`NPCModel.py:107`）；`changeRevenue`{uid,data:{uid,revenue,amount,effect}}（`PlayerModel.py:64`）；`increaseBuildingIncome`{uid,data:{uid,building_id,income,amount}}（`BuildingsModel.py:167`）；`mayor.npc.Create`/`mayor.building.Create` 的 payload 中 `uid=Mayor-*`，但目标 socket lookup 使用已改写的 `uid=Player-*`（`app.py:221-226`），所以不能期待 Mayor-only socket 收到它们。

## Todos

- [x] 1. Scaffold `frontend/` Vite React-TS project with toolchain
  References: 新目录 `frontend/`；`client/AGENTS.md`（无现有 pipeline）；`docker-compose.yml:41-48`（nginx 挂载 `./client`）。
  Action: `npm create vite@latest frontend -- --template react-ts`；添加 `typescript` strict、`eslint`、`prettier`、`vitest`、`@playwright/test`、`tailwindcss`、`zustand`、`pixi.js@^8`、`react-router-dom`、`clsx`。在任何 `tee test-results/...` 命令之前创建 `frontend/test-results/.gitkeep`。创建 `frontend/scripts/run_negative_fixture.py` 作为早期可复用 negative-fixture harness（把 fixture temp files 复制到 temp directory，运行命令，然后 restore/clean；绝不改 product source），以及 `frontend/test-fixtures/negative/README.md`。在 `frontend/package.json` 中添加 scripts：`typecheck`=`tsc --noEmit`、`lint`、`format:check`、`test`、`build`、`lint:no-any`（AST/rg-backed script，对 allowlist 外的 `any`/`@ts-ignore` 失败）、`lint:no-console`、`build:analyze`（写 bundle report，如果 initial JS > 1.5 MB gzip 则失败）。添加 `frontend/tsconfig.json` `strict:true`。添加 `frontend/.gitignore`（`node_modules`,`dist`）。确认 `frontend/` 不影响后端运行。
  Acceptance: `cd frontend && npm install && npm run typecheck && npm run build` 成功；`npm run dev` 服务于 `:5173`；`frontend/test-results/` 存在；从 repo root 运行 `python frontend/scripts/run_negative_fixture.py --self-test` 通过；sample Vitest test 可运行；custom lint scripts 和 `build:analyze` 存在。
  QA happy: run `cd frontend && npm run build | tee test-results/t01-build.txt` -> exit 0，`dist/` 存在。QA failure: run `cd frontend && npx vitest run src/__tests__/negative/type-error.fixture.test.ts --reporter=verbose | tee test-results/t01-fail.txt`；fixture 断言 typecheck negative case 在不修改源码的情况下以非零退出。
  Commit: `chore(frontend): scaffold vite react-ts project with toolchain`

- [x] 2. Typed protocol types module from verified contract
  References: 上方 contract；`app.py:144-228`；`command_base.py:24-82`；`single_model_base.py:37`；上方列出的 model orm fields。
  Action: 创建 `frontend/src/protocol/types.ts`，导出：`RequestFrame`、`ResponseEnvelope`、`Uid`、`Uri`（20 个 working command URI + backend-broken `command.npc.ChangePrompt` + `ping` = 22 个 request URI case 的 union）、`PushUri`（全部 15 个 push URI 的 union），以及与 verified shapes 匹配的 per-URI `Params`/`Data` types。编码 **call-dependent NPCID/buildingID format difference**（ChatWithNPC NPCID=`"NPC-<id>"` string；GetNPCInfo NPCID=bare int；GetBuildingInfo buildingID=bare int）。一个 `as const` URI table。导出 `NPCDTO`、`MapDTO`、`BuildingsDTO`、`EquipmentDTO`、`PlayerDTO`、`TownDTO`，与各 model orm fields 匹配，并将 `id?` 声明为 OPTIONAL（`as_object(True)` 时存在，`as_object(False)` 时缺失）。
  Acceptance: `tsc --noEmit` clean；无 `any`；union 中每个 URI 至少被一个 caller stub 引用。
  QA happy: run `cd frontend && npx vitest run src/protocol/__tests__/types.test.ts --reporter=verbose | tee test-results/t02-types.txt`；snapshot 断言 request URI union length == 22（20 working + ChangePrompt + ping）且 push URI length == 15。QA failure: run `cd frontend && npx vitest run src/protocol/__tests__/negative/typo-uri.test.ts --reporter=verbose | tee test-results/t02-fail.txt`；negative fixture 断言 `tsc --noEmit` 或 exhaustive switch validation 在不编辑源码的情况下失败。
  Commit: `feat(protocol): add typed request/push contract types`

- [x] 3. WebSocket client core with correlation + reconnect + ping
  References: `app.py:100`（welcome）；`app.py:173-177`（ping）；`main.py:30,38`（/ws :8000）；`command_base.py:24-42`（_execute）。
  Action: `frontend/src/protocol/ws-client.ts` —— `WsClient.connect(url)`、`send(frame: RequestFrame)`、auto `ping` keepalive（interval 来自 `config/app.json` `ping` 或 20s）、exponential-backoff reconnect、`JSON.parse`、emit envelope or push。因为协议没有 request id，按 `(normalizedUid, uri)` queue 串行化；Mayor requests 的 outbound correlation uid 从 `Mayor-<id>` normalize 为 `Player-<id>`，因为 `app.py:163-170` 会重写 `info["uid"]` 且普通响应使用改写后的 `uid`（`app.py:194-199`）。URL 由 constructor 注入，因此 dev `:5173` 可代理 `/ws` -> `:8000`。
  Acceptance: 对 mock WS server，`ping` frame 得到 `{data:{ping:true}}`；`command.config.GetBuildingsConfig` request 得到 matching `uri` 的 envelope；Mayor request 在 response `uid` 为 `Player-<id>` 时 resolve；相同 `(uid,uri)` 并发调用 FIFO/serialized。
  QA happy: run `cd frontend && npx vitest run src/protocol/__tests__/ws-client.test.ts --reporter=verbose | tee test-results/t03-ws.txt`；mock server 断言 ping、reconnect、Mayor uid normalization、FIFO serialization。QA failure: 同一测试文件的 malformed-JSON case 写 `test-results/t03-fail.txt`，并断言 parse error/no crash。
  Commit: `feat(protocol): add ws client with correlation, ping, reconnect`

- [x] 4. Push-handler registry + Zustand entity stores
  References: 上方全部 15 个 push URI + shapes；`NPCModel.py`、`PlayerModel.py`、`BuildingsModel.py` 的 store fields。
  Action: `frontend/src/protocol/push-handlers.ts` dispatcher，把每个 `PushUri` 映射到 pure reducer，并更新 Zustand stores（`useEntityStore` for NPC/Player/Building/Equipment，`useChatStore`，`useSimStore` for tick/mayor state，`useLogStore` for NPC-React）。处理两种 `chatWith` variant（用是否存在 `data.chats` 区分）。`useConnectionStore` 处理 welcome/uid。
  Acceptance: 分发 15 个 push fixtures 时更新正确 store slice；selector hooks 返回期望值。
  QA happy: run `cd frontend && npx vitest run src/protocol/__tests__/push-handlers.test.ts --reporter=verbose | tee test-results/t04-push.txt`；喂入 15 个 fixtures -> 断言 store deltas。QA failure: 同一命令使用 unknown-uri fixture，断言写入 `useLogStore` 且不 throw（evidence `frontend/test-results/t04-fail.txt`）。
  Commit: `feat(protocol): add push-handler registry and zustand stores`

- [x] 5. Protocol conformance test harness (golden-trace-ready)
  References: 上方 contract；`app.py` envelope；`command/**` 中所有 command `execute()` signatures。
  Action: `frontend/src/protocol/__tests__/conformance.ts` + `frontend/test-fixtures/golden/` —— mock WS server 回放 recorded frames；测试断言：a) 每个 request URI 构造精确 `{uid,uri,method,data}`，并包含 `check_params` 要求的 `data` keys；b) 每个 push URI 被处理且不 throw。提供 `capture.ts` devtool stub，记录如何捕获真实 Unity 会话（T26 填充 fixtures）。
  Acceptance: `npm run test -- conformance` 通过；coverage report 列出所有 20 working + 1 broken（ChangePrompt）request URI + `ping`，以及所有 15 push URI。
  QA happy: run `cd frontend && npx vitest run src/protocol/__tests__/conformance.test.ts --reporter=verbose | tee test-results/t05-conformance.txt`；所有 URI cases green。QA failure: run required-param negative fixture in the same test file，断言 validation 失败（evidence `frontend/test-results/t05-fail.txt`）。
  Commit: `test(protocol): add conformance harness covering all uris`

- [ ] 6. App shell, routing, Tailwind + shadcn-style primitives
  References: `client/AGENTS.md`（Unity 是单页 town UI）；新 `frontend/`。
  Action: `frontend/src/App.tsx` + `react-router-dom` routes（`/` town、`/npc/:id`、`/building/:id`、`/chat`、`/mayor`、`/dev`）；`frontend/src/components/ui/*`（Button、Panel、Input、Modal、Tabs）使用 Tailwind + `clsx`；`Layout` 包含 top bar（player revenue、tick state）+ canvas area + side panel。
  Acceptance: routes 渲染 placeholders；Tailwind classes 生效；`npm run build` clean。
  QA happy: run `cd frontend && npx playwright test e2e/shell.spec.ts --reporter=line --output=test-results/t06-artifacts | tee test-results/t06-shell.txt`；加载 `/` -> title + layout visible。QA failure: 同一 spec 打开 unknown route，断言 404 boundary renders（evidence `frontend/test-results/t06-fail.txt`）。
  Commit: `feat(ui): add app shell, routing, and tailwind primitives`

- [ ] 7. Auth/Register flow (connect->welcome->Register)
  References: `app.py:100`（welcome）；`command/auth/Register.py:14-39`（params `{nickname,email,cryptoPWD}` 在 `data` 中；返回 `{email,nickname,cryptoPWD,uid,buildings[],npcs[]}`）；`login_base.py:56-142`（first-login vs returning）；`command_base.py:162`（no token check）。
  Action: `frontend/src/features/auth/Register.tsx` —— mount 后连接 WS，等待 `welcome`，如果没有 stored uid，则发送 `command.auth.Register`；把 `uid` 存入 `useConnectionStore`；当 `data.register===true`（first bind，`app.py:208-210`）时，从 Register response hydrate buildings/npcs。将 uid 持久化到 `localStorage`。
  Acceptance: 对运行中的后端，register flow 产生 `Player-<id>` uid；首次登录时 buildings/npcs arrays 非空。
  QA happy: run `cd frontend && npx playwright test e2e/register.spec.ts --reporter=line --output=test-results/t07-artifacts | tee test-results/t07-register.txt`；uid stored，layout shows building/npc counts。QA failure: 同一 spec 提交 duplicate email + wrong pwd，并断言 `code 501 msg "user password error"` toast（evidence `frontend/test-results/t07-fail.txt`）。
  Commit: `feat(auth): implement connect-welcome-register bootstrap`

- [ ] 8. Config bootstrap (no-token config endpoints)
  References: `command/config/GetBuildingsConfig.py`、`command/config/GetNPCsConfig.py`、`command/config/GetEquipmentsConfig.py`（都 `is_check_token()==False`）；`config/buildings.json`、`config/agent.json`、`config/equipments.json`。
  Action: `frontend/src/features/config/bootstrap.ts` —— uid ready 后调用三个 `command.config.Get*Config` URI（uid optional），并存入 `useConfigStore`，用于驱动 Create form selectors（asset/model/memorySystem/planSystem lists、building types、equipment functions）。三个端点都禁用 token check：`command/config/GetBuildingsConfig.py:6-7`、`command/config/GetNPCsConfig.py`、`command/config/GetEquipmentsConfig.py`（`is_check_token()==False`）。
  Acceptance: config store populated；selectors render option lists matching `config/buildings.json`、`config/agent.json`、`config/equipments.json` lengths。
  QA happy: run `cd frontend && npx vitest run src/features/config/__tests__/bootstrap.test.ts --reporter=verbose | tee test-results/t08-config.txt`；mock 三个 envelopes -> option counts match。QA failure: 同一 test file 的 empty-config case 断言 selectors disabled with hint（evidence `frontend/test-results/t08-fail.txt`）。
  Commit: `feat(config): fetch and store buildings/npc/equipments configs`

- [ ] 9. World bootstrap sequence (map/town/buildings/npcs/player)
  References: `command/map/GetMapScene.py`、`command/map/GetMapTown.py`、`command/building/GetBuildings.py`、`command/npc/GetNPCs.py`、`command/player/GetPlayerInfo.py`。
  Action: `frontend/src/features/world/bootstrap.ts` —— Register 后发送 5 个 request URI；用 `map`（MapDTO）、`town`、`buildings[]`、`npcs[]`、`player` hydrate `useEntityStore`。与 Register response 中已存在的 buildings/npcs reconcile（避免 double）。
  Acceptance: 5 个 envelopes 都被解析；stores 中 map width=143 height=81；npc count 与 Register 一致。
  QA happy: run `cd frontend && npx vitest run src/features/world/__tests__/bootstrap.test.ts --reporter=verbose | tee test-results/t09-world.txt`；5 fixtures -> store snapshot。QA failure: 同一 test file 的 GetMapScene `code 501 "map not found"` case 断言 retry/error（evidence `frontend/test-results/t09-fail.txt`）。
  Commit: `feat(world): hydrate map/town/buildings/npcs/player on login`

- [ ] 10. Pixi app + viewport/camera + tile layer
  References: `MapModel.py`（143×81 sparse dict、`passable`、`moveEntity`、`setValue`）；`single_model_base.py:37`（`as_object`）。
  Action: `frontend/src/render/PixiStage.tsx` —— 初始化 Pixi v8 Application、camera（pan/zoom）、tile layer，渲染 `mapDTO.map` cells：block -> wall tile，building -> footprint，equipment -> icon，uid -> occupant。tile size 使用常量；对 143×81 做 viewport culling。
  Acceptance: 给定 MapDTO fixture 时能渲染 tiles；camera 可 pan；性能由 T14 的确定性测试约束。
  QA happy: run `cd frontend && npx playwright test e2e/pixi-map.spec.ts --reporter=line --output=test-results/t10-artifacts | tee test-results/t10-pixi.txt`；screenshot artifact + assertion count 证明 tile count matches non-empty cells。QA failure: 同一 spec 的 empty-map fixture 渲染 blank grid 且不 crash（evidence `frontend/test-results/t10-fail.txt`）。
  Commit: `feat(render): add pixi stage, camera, and tile layer`

- [ ] 11. NPC/player sprite layer bound to entity store
  References: `NPCModel.py`（x,y,rotation,asset）；`PlayerModel.py`（x,y,rotation）；`login_base.py:99-101`（player at 71,41；Alan 50,71；Fei 52,73）。
  Action: `frontend/src/render/SpriteLayer.ts` —— 为每个 NPC + player 创建 sprites，按 x/y 定位、rotation 旋转，asset -> sprite-sheet/tint mapping（placeholder assets 放在 `frontend/public/sprites/`）。绑定到 `useEntityStore` deltas。
  Acceptance: sprites 出现在 fixture coords；store coord 变化会移动 sprite；rotation 生效。
  QA happy: run `cd frontend && npx playwright test e2e/sprites.spec.ts --reporter=line --output=test-results/t11-artifacts | tee test-results/t11-sprites.txt`；screenshots/assertions show sprites at 71,41 + 50,71 + 52,73。QA failure: missing asset fixture 断言 fallback colored square + log（evidence `frontend/test-results/t11-fail.txt`）。
  Commit: `feat(render): add npc/player sprite layer`

- [ ] 12. Movement animation from movePath/moveTo/planToMove pushes
  References: `Tick.py:39`（movePath path[]）；`Navigate.py:34`（moveTo single step）；`Tick.py:187`（planToMove target building highlight）；`Tick.py:31-91`（move semantics）。
  Action: `frontend/src/render/movement.ts` —— `movePath` 时让 sprite 沿 `path` tiles tween；`moveTo` 时 tween 单步；`planToMove` 时 highlight target building。新 path 到达时取消旧 tween。
  Acceptance: `movePath` fixture 按顺序动画经过所有 path tiles；`moveTo` 单步；`planToMove` highlight。
  QA happy: run `cd frontend && npx vitest run src/render/__tests__/movement.test.ts --reporter=verbose | tee test-results/t12-move.txt`；timer mocks 证明 sprite visits each path coord。QA failure: 同一 test file 的 empty `movePath` fixture 断言 no tween/no error（evidence `frontend/test-results/t12-fail.txt`）。
  Commit: `feat(render): animate movement from movepath/moveto/plantomove`

- [ ] 13. Interaction visuals from interact/newAction/finishAction/newPlan/NPC-React
  References: `Tick.py:258`（interact: equipment,operation,continueTime,cost,earn）；`NPCModel.py:146`（newAction）；`NPCModel.py:132`（finishAction: action,startTime,endTime）；`Tick.py:162`（newPlan）；`Tick.py:156`（NPC-React reaction）。
  Action: `frontend/src/render/interaction.ts` + overlays —— `interact` 显示 equipment highlight + countdown bar；`newAction` 显示 action label + timer；`finishAction` 清除；`newPlan` 显示 plan label；`NPC-React` 记录到 inspector panel（`useLogStore`）。
  Acceptance: fixtures 正确驱动每个 overlay；timers 基于 `last_game_time` deltas 倒计时。
  QA happy: run `cd frontend && npx playwright test e2e/interaction-overlays.spec.ts --reporter=line --output=test-results/t13-artifacts | tee test-results/t13-interact.txt`；overlays 按 fixtures appear/disappear。QA failure: unknown equipment id fixture 断言 label "unknown" 且不 throw（evidence `frontend/test-results/t13-fail.txt`）。
  Commit: `feat(render): render interaction/action/plan/react overlays`

- [ ] 14. Map performance: culling + dirty-rect delta updates
  References: `MapModel.py`（143×81）；push URIs 只变更少量 cells。
  Action: store deltas 发生时只 redraw changed tiles；viewport cull off-screen sprites；cap Pixi ticker。添加 deterministic performance tests：固定 Chromium 版本、固定 143×81 fixture、20 个 warmup frames、100 次 measured updates、p95 timing。
  Acceptance: 在 CI/container runner 的 headless Chromium 中，200-cell delta p95 update time ≤ 25ms，1000-cell stress delta p95 ≤ 100ms；不使用泛化 FPS 声明。
  QA happy: run `cd frontend && npx playwright test e2e/render-perf.spec.ts --reporter=line --output=test-results/t14-artifacts | tee test-results/t14-perf.txt`；report 包含 p50/p95 和 measured update count。QA failure: 同一 spec 的 10k-delta fixture 断言 bounded failure report/no hang（evidence `frontend/test-results/t14-fail.txt`）。
  Commit: `perf(render): add viewport culling and dirty-rect updates`

- [ ] 15. NPC inspector + Create NPC + ChangePrompt (known-broken)
  References: `command/npc/GetNPCInfo.py`（`{data:{NPCID}}`，NPCID 是 BARE int -> `{npc:npcDTO}` 且通过 `as_object(False)` 不含 `id`）、`command/npc/Create.py:12-153`（完整 `data` params：asset,model,memorySystem,planSystem,homeBuilding,workBuilding,nickname,bio,goal,cash；返回 `{uid,homeBuilding,asset,assetName,model,memorySystem,planSystem,workBuilding,nickname,bio,goal,cash,x,y}`）、`command/npc/ChangePrompt.py`（backend-broken：class 名是 `GetNPCInfo` 而不是 `ChangePrompt`）、`login_base.py`（asset index mapping）。注意 `Create.py:128` 有 `work_building_` typo（后端 bug -> NPC `work_building` 保持 None）；不修后端。
  Action: `frontend/src/features/npc/NpcPanel.tsx` —— GetNPCInfo view（从 NPC 的 `uid` token 解析裸 int NPCID：`int(uid.split('-')[1])`）；create form 由 config store 驱动（asset/model/memorySystem/planSystem selects，home/work building selects，nickname/bio/goal/cash inputs）；发送 `command.npc.Create`；ChangePrompt form 发送 `command.npc.ChangePrompt`，但必须把它当作 backend-dispatch crash，而不是普通 command error：`App.execute()` 在 command error wrapping 前调用 `getattr(module,"ChangePrompt")`，因此客户端可能观察到 request timeout、无 matching envelope、或 socket close。实现 bounded request timeout，并在 timeout/close/no envelope 时显示 “feature unavailable (backend bug)”。验证 required fields（Create.py:25-38）。
  Acceptance: create NPC 返回完整对象；inspector 显示新 NPC（由于后端 typo，work_building null 是预期）；insufficient revenue -> `code 501 "lack of revenue to invite"`（`Create.py:76`）；ChangePrompt 在 5s 内产生 bounded timeout/no-envelope/socket-close 路径并显示 unavailable。
  QA happy: run `cd frontend && npx playwright test e2e/npc.spec.ts --reporter=line --output=test-results/t15-artifacts | tee test-results/t15-npc-create.txt`；new NPC sprite 出现在返回的 x,y；ChangePrompt unavailable state 出现。QA failure: 同一 spec 包含 deterministic checks：a) blank nickname client-side validation prevents send；b) protocol-level fixture/server rejection for blank nickname returns `code 501`；c) ChangePrompt no-envelope/socket-close 不 crash app（evidence `frontend/test-results/t15-fail.txt`）。
  Commit: `feat(npc): add inspector, create form, and broken-changeprompt handling`

- [ ] 16. Building panel + Create building
  References: `command/building/GetBuildingInfo.py`（`{data:{buildingID}}` -> `{building:buildingDTO}`）、`command/building/Create.py:44-145`（`data`: building_type,name,x,y,rotation；block-coord mapping `block_xy_to_tile_xy`）、`command/building/GetBuildings.py`。
  Action: `frontend/src/features/building/BuildingPanel.tsx` —— GetBuildingInfo view（发送 bare-int buildingID）；create form 包含 4×4 block grid selector（x=blockX 1-4，y=blockY 1-4）、building_type select、name、rotation（0/90/180/270）；发送 `command.building.Create`；渲染结果 `{building_id,x,y,building_type,name}` —— 注意这里 `x`,`y` 是 BLOCK coords（bx,by），不是 tile coords。
  Acceptance: create 返回 building_id；map 显示新 building footprint；block occupied -> `code 501 "block already used"`（`Create.py:79,84`）；insufficient revenue -> `code 501 "lack of revenue to invite"`（`Create.py:92`）。
  QA happy: run `cd frontend && npx playwright test e2e/building.spec.ts --reporter=line --output=test-results/t16-artifacts | tee test-results/t16-bldg-create.txt`；building footprint 渲染在 mapped tile。QA failure: 同一 spec 覆盖 occupied block -> toast "block already used"，以及 insufficient revenue -> toast "lack of revenue to invite"（evidence `frontend/test-results/t16-fail.txt`）。
  Commit: `feat(building): add inspector and create form on block grid`

- [ ] 17. Player/economy panel with live pushes
  References: `command/player/GetPlayerInfo.py`（-> `{player:playerDTO}`）、`PlayerModel.py:57-65`（changeRevenue）、`NPCModel.py:107`（changeCash）、`BuildingsModel.py:163-168`（increaseBuildingIncome）。
  Action: `frontend/src/features/player/PlayerPanel.tsx` —— 显示 revenue/x/y；订阅 `changeRevenue`/`changeCash`/`increaseBuildingIncome` pushes；动画化 deltas。
  Acceptance: revenue 根据 pushes 更新；amounts/effects 与 fixtures 一致。
  QA happy: run `cd frontend && npx vitest run src/features/player/__tests__/economy.test.ts --reporter=verbose | tee test-results/t17-econ.txt`；喂入 push fixtures -> revenue label/store changes。QA failure: 同一 test file mock `command.building.Create` response 为 `code:501,msg:"lack of revenue to invite"`，断言 toast + no local revenue decrement（evidence `frontend/test-results/t17-fail.txt`）。
  Commit: `feat(player): add economy panel with live revenue/cash/income pushes`

- [ ] 18. Equipment display (config + map tiles)
  References: `command/config/GetEquipmentsConfig.py`、`EquipmentsModel.py`（`{id,n,d,o,t,lx,ty,rx,by,r,b,fs,m,s}`）、`MapModel.search_sight`（`Tick.py` usage）。
  Action: `frontend/src/features/equipment/EquipmentPanel.tsx` —— 从 config + map 列出 equipments；显示 menu（`m`）和 functions（`fs`）；把 equipment tiles 关联到 buildings（`b`）。
  Acceptance: equipment list 与 config 匹配；选中 equipment 会 highlight 其 map footprint。
  QA happy: run `cd frontend && npx vitest run src/features/equipment/__tests__/equipment-panel.test.ts --reporter=verbose | tee test-results/t18-equip.txt`；equipment count == config equipment types。QA failure: empty `fs` fixture 断言 "no functions"（evidence `frontend/test-results/t18-fail.txt`）。
  Commit: `feat(equipment): add equipment panel driven by config and map`

- [ ] 19. Chat UI handling both chatWith variants + ChatWithNPC command
  References: `command/chat/ChatWithNPC.py:8-64`（`data:{NPCID,content}`；push 两次 `chatWith` variant-A `{sourceID,targetID,content}`；返回 `{npc,player}`）、`Tick.py:138`（variant-B `{chats:[{content,speaker,speakerID}]}`）、`PlayerModel.add_chat`、`NPCModel.add_chat`。
  Action: `frontend/src/features/chat/ChatPanel.tsx` —— input -> 发送 `command.chat.ChatWithNPC`，其中 `data.NPCID` 是完整 token `"NPC-<id>"`（见 `ChatWithNPC.py:15`）；渲染两种 `chatWith` variant（通过 `data.chats` vs `data.content` 区分）；显示 NPC streaming response；通过 `useChatStore` 持久化。
  Acceptance: 一个 ChatWithNPC round-trip 显示 user msg 后显示 NPC response（variant-A push 两次，`ChatWithNPC.py:25,48`）；Tick variant-B burst 渲染 multi-line transcript（`Tick.py:138`）。
  QA happy: run `cd frontend && npx playwright test e2e/chat.spec.ts --reporter=line --output=test-results/t19-artifacts | tee test-results/t19-chat.txt`；backend round-trip 显示 2-turn transcript。QA failure: mock NPC react without `chat.content` 并断言 "no response"（evidence `frontend/test-results/t19-fail.txt`）。
  Commit: `feat(chat): implement chatwithnpc and both chatwith variants`

- [ ] 20. Player<->NPC chat persistence via GetNPCInfo
  References: `command/npc/GetNPCInfo.py`（`npc.chats`）、`NPCModel.add_chat:149-159`。
  Action: 选中 NPC 时，fetch `GetNPCInfo` 并从 `npc.chats` seed `useChatStore`（uid-keyed，last 10）。与 live pushes reconcile。
  Acceptance: 重新打开 NPC panel 时按顺序显示 prior chats。
  QA happy: run `cd frontend && npx vitest run src/features/chat/__tests__/chat-seed.test.ts --reporter=verbose | tee test-results/t20-chatseed.txt`；fixture npc.chats -> transcript seeded。QA failure: empty npc.chats fixture 断言 empty state（evidence `frontend/test-results/t20-fail.txt`）。
  Commit: `feat(chat): seed chat transcript from getnpcinfo`

- [ ] 21. Mayor mode (Mayor-* uid rewrite + mayor.GetInfo + mayor.* pushes)
  References: `app.py:163-170,221-226`（Mayor->Player rewrite；`mayor.npc.Create`/`mayor.building.Create` pushes）、`command/mayor/GetInfo.py`（returns last_game_time,start_time,revenue,buildings[],npcs[],building_types[]）、`agent/agent/mayor.py`。
  Action: `frontend/src/features/mayor/MayorPanel.tsx` —— 以 `Mayor-<id>` 连接；将 request correlation normalize 为 `Player-<id>`（T3）；调用 `command.mayor.GetInfo`；渲染 mayor decision view；复用 npc.Create/building.Create forms（Player-mapped）。对于 `mayor.npc.Create`/`mayor.building.Create`，测试真实后端行为：destination socket lookup 使用已改写的 `Player-<id>`（`app.py:221-226`），而 payload `uid` 是 `Mayor-<id>`；不能假设 Mayor-only socket 会收到 push。
  Acceptance: Mayor GetInfo 在 uid normalization 后工作；当同一 id 同时存在 Player 和 Mayor sockets 时，mayor create 的 `mayor.*` push 会在 Player socket/push bus 上观察到（或记录为 Player-destination），不要求 Mayor-only socket 收到；payload 仍携带 `uid: Mayor-<id>`。
  QA happy: run `cd frontend && npx playwright test e2e/mayor.spec.ts --reporter=line --output=test-results/t21-artifacts | tee test-results/t21-mayor.txt`；GetInfo renders 且测试确认 destination/payload behavior。QA failure: 同一 spec 的 Mayor-only connection case 等待 `mayor.*`，以带说明的 timeout 结束并写 `test-results/t21-fail.txt`。
  Commit: `feat(mayor): implement mayor mode with getinfo and mayor.* pushes`

- [ ] 22. Simulation control (start/stop tick & mayor) + Tick
  References: `command/starter/TickStarter.py`（`nohup python3.9 -u tick.py`；lines 19-23 设置 `tick_state.start=True`）、`command/starter/MayorStarter.py`（不会设置 `mayor_state.start=True` —— 只检查它、运行 subprocess、返回 `{start:True}`；因此重复 MayorStarter 调用不会返回 "already start"）、`command/timetick/Tick.py`、`app.py` tick_state/mayor_state、`config/app.json` tick_cooldown/tick_count_limit/mayor_cooldown/mayor_count_limit。
  Action: `frontend/src/features/sim/SimControl.tsx` —— Start buttons 发送 `command.starter.TickStarter`/`MayorStarter`（`{uid}`）；显示 start/cooldown/already-start errors（`TickStarter.py:13-16`）；发送 `command.timetick.Tick` 以推进；展示 tick_count/last_game_time。UI tooltip 说明 POSIX-host caveat（starter 在服务端运行）。Mayor repeat 时不要断言 "already start"（后端从不标记 started）；改为 client-side cooldown window 禁用按钮，并把任何返回 error 当作 informational。
  Acceptance: TickStarter：Start 返回 `{start:true}`；cooldown 内二次 start -> `code 501 "already start"` 或 `"still cooldown"`。MayorStarter：Start 返回 `{start:true}`；repeat 不可靠返回 "already start"（记录为后端 gap）。
  QA happy: run `cd frontend && npx playwright test e2e/sim.spec.ts --reporter=line --output=test-results/t22-artifacts | tee test-results/t22-sim.txt` against Docker/POSIX stack -> tick state toggles；mayor start returns `{start:true}`。QA failure: 同一 spec mock starter response `code:501,msg:"still cooldown"` 和 network/closed-socket starter failure；断言 error banner + no hang（evidence `frontend/test-results/t22-fail.txt`）。
  Commit: `feat(sim): add tick/mayor starter controls and tick state`

- [ ] 23. Dev console for gm.FakeSendings
  References: `command/gm/FakeSendings.py`（`data:{testName}` ∈ movePath/changeRevenue/changeCash/increaseBuildingIncome）。
  Action: `frontend/src/features/dev/DevConsole.tsx` —— 每个 testName 一个按钮；断言每个按钮触发对应 push renderer（movePath->T12，changeRevenue/changeCash->T17，increaseBuildingIncome->T17）。
  Acceptance: 每个 testName 在 running app 中产生预期可见 push。
  QA happy: run `cd frontend && npx playwright test e2e/dev-console.spec.ts --reporter=line --output=test-results/t23-artifacts | tee test-results/t23-dev.txt`；4 个 testNames 都点亮对应 overlay/label（precondition：backend fixture has NPC-10001 or mock WS supplies equivalent pushes）。QA failure: unknown testName fixture/server response `code 501` -> client shows msg（evidence `frontend/test-results/t23-fail.txt`）。
  Commit: `feat(dev): add fakesendings dev console`

- [ ] 24. Build pipeline + nginx gateway coexistence with Unity
  References: `docker-compose.yml:41-48`（nginx `client` service 是 `nginx:1.25-alpine`，只读挂载 `./client`，端口 8081:80；image 内没有 node build step）、`client/AGENTS.md`、`main.py:38`（/ws :8000）、`app.py:12-14`（CORS open）、README（`ws://localhost:8000/ws` direct）。
  Action: 新增 multi-stage `frontend/Dockerfile`，但 build context 使用 REPO ROOT，这样才能同时 copy `frontend/` 和 sibling `client/`：只更新 `client` docker-compose service 为 `build: { context: ., dockerfile: frontend/Dockerfile }`（不是 `build: ./frontend`）。Stage 1 `node:20-alpine` 运行 `cd /src/frontend && npm ci && npm run build`；stage 2 `nginx:1.25-alpine` 把 `/src/frontend/dist` copy 到 `/usr/share/nginx/html/spa`，把 `/src/client` copy 到 `/usr/share/nginx/html/legacy`。添加 `frontend/nginx/agentsims.conf`：`location / { root /usr/share/nginx/html/spa; try_files $uri $uri/ /index.html; }`，用于 React Router deep links；`location /legacy/ { alias /usr/share/nginx/html/legacy/; try_files $uri $uri/ /legacy/index.html; }`。添加 T24 自有 negative fixture `frontend/test-fixtures/negative/missing-client-copy.json` 用于 failure QA（使用 T1 创建的 `run_negative_fixture.py`）。不要添加 nginx `/ws` proxy —— SPA 直接连接 `ws://host:8000/ws`，与 Unity 相同（已验证）；只改静态网关。
  Acceptance: `docker compose up --build` 在 image 内构建 SPA（host 不需要 node），在 `http://localhost:8081/` 提供新 SPA，deep link `/npc/1` 返回 SPA index，Unity 在 `http://localhost:8081/legacy/` 可达；二者都连接 `ws://localhost:8000/ws`。
  QA happy: run `docker compose up --build -d client && curl -fsS http://localhost:8081/ && curl -fsS http://localhost:8081/npc/1 && curl -fsS http://localhost:8081/legacy/index.html | tee frontend/test-results/t24-gateway.txt`；SPA in browser registers。QA failure: run `python frontend/scripts/run_negative_fixture.py --fixture frontend/test-fixtures/negative/missing-client-copy.json | tee frontend/test-results/t24-fail.txt`；fixture 构建一个不复制 `client/` 的 temp Dockerfile，`/legacy/index.html` 失败，script restore config。
  Commit: `build(frontend): add multi-stage dockerfile and nginx gateway / + /legacy`

- [ ] 25. Dev serving: Vite dev server with /ws proxy
  References: `main.py:38`（:8000）、`app.py:12-14`（CORS open）。
  Action: `frontend/vite.config.ts` 设置 `server.proxy['/ws'] -> ws://localhost:8000`；在 `frontend/README.md` 写 dev instructions（运行后端 `python -u main.py` + `cd frontend && npm run dev`）；HMR。
  Acceptance: dev app at `:5173` 连接 local backend `/ws`；Register works in dev。
  QA happy: run `cd frontend && npx playwright test e2e/dev-server.spec.ts --reporter=line --output=test-results/t25-artifacts | tee test-results/t25-dev.txt`；dev server register round-trip passes。QA failure: 同一 spec 将 `/ws` proxy 指向 closed port，断言 connection error banner + retry（evidence `frontend/test-results/t25-fail.txt`）。
  Commit: `docs(frontend): add dev server with /ws proxy and readme`

- [ ] 26. Golden WS trace capture + parity diff vs Unity
  References: R1 in `.omo/drafts/unity-frontend-migration.md`；`app.py` envelope；all push URIs；T24 `/legacy/` Unity route。
  Depends on: T24（Unity reachable at `/legacy/`）以及一个运行中的后端，且有 `config/api_key.json`。
  Action: 在 `frontend/e2e/capture-unity-ws.spec.ts` 实现 Playwright/CDP capture：打开 `http://localhost:8081/legacy/`，attach page 的 CDP `Network.webSocketFrameSent` / `Network.webSocketFrameReceived` events，执行 Unity 在无源码访问下可以完成的 bootstrap interactions，并把 normalized frames 写入 `frontend/test-fixtures/golden/unity-ws.json`。添加 `frontend/src/protocol/__tests__/golden-diff.test.ts`，按 URI diff 新前端 emitted request frames 与 handled push URIs。
  Acceptance: 自动 capture 写入非空 JSON fixture，包含 sent+received frames；diff 缺失 URI 数为 0；每个 golden request frame 的 `data` keys 被发送；每个 golden push URI 被处理，或明确记录为 Unity-only。
  QA happy: run `cd frontend && npx playwright test e2e/capture-unity-ws.spec.ts --reporter=line --output=test-results/t26-capture-artifacts && npx vitest run src/protocol/__tests__/golden-diff.test.ts --reporter=verbose | tee test-results/t26-golden.txt`；report lists frame counts and 0 missing。QA failure: run `cd frontend && npx vitest run src/protocol/__tests__/negative/golden-only-uri.test.ts --reporter=verbose | tee test-results/t26-fail.txt`；negative fixture 断言 golden-only URI 被列出。
  Commit: `test(protocol): capture golden ws trace and diff against client`

- [ ] 27. Full parity E2E (Playwright) covering 22 request URIs + 15 pushes
  References: all command files；all push URIs；Waves 1-6。
  Depends on: T1-T25 和 T26 golden fixtures。
  Action: `frontend/e2e/parity.spec.ts` —— register->bootstrap->create building->create npc->chat->start tick->observe movePath/newPlan/planToMove/interact/newAction/finishAction/changeCash/changeRevenue/increaseBuildingIncome->mayor mode->gm.FakeSendings；断言 coverage matrix（20 working request URIs + `ping` + `command.npc.ChangePrompt` flagged broken，15×push）。添加 T27 自有 negative fixture `frontend/test-fixtures/negative/missing-push-handler.json` 用于 failure QA（使用 T1 创建的 `run_negative_fixture.py`）。
  Acceptance: 对运行中的后端（POSIX host），coverage matrix 完全 green；ChangePrompt cell 标记为 "broken endpoint — graceful error confirmed"。
  QA happy: run `cd frontend && npx playwright test e2e/parity.spec.ts --reporter=line --output=test-results/t27-artifacts | tee test-results/t27-parity.txt`；matrix 100%，ChangePrompt 标为 broken-graceful。QA failure: run `python frontend/scripts/run_negative_fixture.py --fixture frontend/test-fixtures/negative/missing-push-handler.json | tee frontend/test-results/t27-fail.txt`；fixture 使用一个 mocked missing push handler 运行 parity matrix 并非零退出。
  Commit: `test(e2e): add full parity matrix covering all commands and pushes`

- [ ] 28. as_object field-shape verification across models
  References: `single_model_base.py:37`；`model/NPCModel.py`、`MapModel.py`、`BuildingsModel.py`、`EquipmentsModel.py`、`PlayerModel.py`、`TownModel`（逐个读取）。
  Action: 添加只读 Python manifest generator `frontend/scripts/extract_orm_manifest.py`：在不启动 server 的情况下 import model modules，实例化/检查 model classes 的 `orm` keys（如果 import 有副作用，则 AST-parse `self.orm[...]` assignments），并写入 `frontend/test-fixtures/orm-manifest.json`。添加 Vitest test，把 DTO key lists 与 manifest 比较；当 include_id 变化时允许 `id` optional。
  Acceptance: 每个 DTO 的 keys == model orm keys（允许 optional `id`）；`tsc --noEmit` clean；manifest generation deterministic。
  QA happy: run `python frontend/scripts/extract_orm_manifest.py > frontend/test-results/t28-manifest.txt && cd frontend && npx vitest run src/protocol/__tests__/dto-fields.test.ts --reporter=verbose | tee test-results/t28-fields.txt`；snapshots match。QA failure: run `cd frontend && npx vitest run src/protocol/__tests__/negative/dto-extra-key.test.ts --reporter=verbose | tee test-results/t28-fail.txt`；fixture manifest 包含额外 fake orm key，snapshot test 非零退出。
  Commit: `test(protocol): verify dto fields match model orm keys`

- [ ] 29. Final-verifier helper scripts and negative-fixture harness
  References: F1/F4 verifier requirements；all `frontend/test-results/**` evidence paths；Must-NOT-Have scope。
  Action: 创建 `frontend/scripts/verify_todo_evidence.py`（检查 T1-T29 evidence、acceptance tokens、forbidden diffs，并允许 compose-client exception）和 `frontend/scripts/verify_scope_fidelity.py`（检查 backend untouched、`client/index.html`、nginx `/legacy/`、absence of backend `class ChangePrompt`、route whitelist）。如果 final-verifier fixtures 需要，扩展 T1 创建的 `frontend/scripts/run_negative_fixture.py`；不要把它的首次创建移到这里，因为 T24/T27 已依赖它。创建 T29/F1-F4 使用的 final-verifier negative fixtures：`frontend/test-fixtures/negative/forbidden-backend-edit.json`、`frontend/test-fixtures/negative/missing-evidence-or-forbidden-diff.json`、`frontend/test-fixtures/negative/any-and-console.json`、`frontend/test-fixtures/negative/broken-legacy-route.json`、`frontend/test-fixtures/negative/scope-violation.json`。在每个 script/fixture 中添加 README comments，说明精确调用和 restore guarantees。
  Acceptance: verifier scripts 和五个 final-verifier negative fixtures 存在，可被 `python` 执行/读取，会清理 temp directories，并在 controlled negative fixtures 下返回非零；没有 script 编辑 backend files。`run_negative_fixture.py --self-test` 仍通过。
  QA happy: run `python frontend/scripts/verify_todo_evidence.py --self-test | tee frontend/test-results/t29-evidence-script.txt && python frontend/scripts/verify_scope_fidelity.py --self-test | tee frontend/test-results/t29-scope-script.txt && python frontend/scripts/run_negative_fixture.py --self-test | tee frontend/test-results/t29-negative-fixture.txt`；all self-tests pass。QA failure: run `python frontend/scripts/run_negative_fixture.py --fixture frontend/test-fixtures/negative/forbidden-backend-edit.json | tee frontend/test-results/t29-fail.txt`；它非零退出并 restore repo。
  Commit: `test(frontend): add final verifier scripts and negative-fixture harness`

## Final verification wave
- [ ] F1. Plan compliance audit
  References: todos 1-29；T29 创建的 `frontend/scripts/verify_todo_evidence.py`；`frontend/test-results/**`；`git diff --name-only`；Scope 中的 Must-NOT-Have。
  Acceptance: 每个 implementation todo T1-T29 都有对应非空 evidence file 或 artifact directory；每个 todo 的 acceptance line 都在 test/assertion log 中有对应表示；没有 backend product-code files 被修改。允许修改的 paths：`.omo/**`、`frontend/**`、`docker-compose.yml` 仅限 `client` service build/config、以及 `frontend/nginx/**` 下的 optional static-serving config。禁止修改的 paths：`main.py`、`app.py`、`command/**`、`model/**`、`agent/**`、`config/**`、`utils/**`、`base.py`、`tick.py`、`mayor.py`、`docker/**`。F1 不需要 F2-F4 evidence，因为 final verifiers 独立运行。
  QA happy: run `python frontend/scripts/verify_todo_evidence.py --plan .omo/plans/unity-frontend-migration.md --results frontend/test-results --implementation-only --allow docker-compose-client-service | tee frontend/test-results/f1-plan-compliance.txt`；script reports 29/29 implementation todos checked and no forbidden diff。QA failure: run `python frontend/scripts/run_negative_fixture.py --fixture frontend/test-fixtures/negative/missing-evidence-or-forbidden-diff.json | tee frontend/test-results/f1-fail.txt`；verifier 非零退出，命名 missing evidence/forbidden path，并 restore repo。
  Commit: none（verification-only final gate）

- [ ] F2. Code quality review
  References: T1 中的 `frontend/package.json` scripts；`frontend/src/**`；`/programming` strict TypeScript guidance。
  Acceptance: `tsc --noEmit`、eslint、prettier、tests、build 全部通过；没有 `any`/`@ts-ignore`，除非在 allowlist 且有 inline issue reference；production source 中没有 `console.log`；build output 存在，bundle report 低于 T1 选择的 size threshold。
  QA happy: run `cd frontend && npm run typecheck && npm run lint && npm run format:check && npm test -- --run && npm run build && npm run build:analyze | tee test-results/f2-quality.txt`；再运行 `cd frontend && npm run lint:no-any && npm run lint:no-console | tee -a test-results/f2-quality.txt`。QA failure: run `python frontend/scripts/run_negative_fixture.py --fixture frontend/test-fixtures/negative/any-and-console.json | tee frontend/test-results/f2-fail.txt`；fixture confirms lint commands exit non-zero and restores repo。
  Commit: none（verification-only final gate）

- [ ] F3. Docker/browser E2E QA (agent-executed)
  References: T24 Docker gateway；T25 dev/prod WS URL；T27 parity spec；`docker-compose.yml` client service。
  Depends on: T24 and T27。
  Acceptance: 干净的 `docker compose up --build -d` 在 `/` 提供新 SPA，Unity 在 `/legacy/`，React Router deep links 通过 `try_files` 工作；automated Playwright smoke 覆盖 register->bootstrap->create building->create NPC->chat->tick->mayor，无需人工点击以外的 scripted Playwright actions。
  QA happy: run `docker compose up --build -d && cd frontend && npx playwright test e2e/docker-smoke.spec.ts --reporter=line --output=test-results/f3-artifacts | tee test-results/f3-docker-e2e.txt`；artifacts 包含 `/`、`/npc/1`、`/legacy/`、parity smoke 的 screenshots。QA failure: run `python frontend/scripts/run_negative_fixture.py --fixture frontend/test-fixtures/negative/broken-legacy-route.json | tee frontend/test-results/f3-fail.txt`；Playwright 非零退出，带 screenshot + trace，fixture restores config。
  Commit: none（verification-only final gate）

- [ ] F4. Scope fidelity verifier
  References: Scope Must-NOT-Have；T24 allowed compose-client change；`.omo/drafts/unity-frontend-migration.md` decisions。
  Acceptance: backend 保持 untouched；保留 `client/`；`/legacy/` route 存在；ChangePrompt 没有在 backend 被修复，并在 frontend tests 中作为 known-broken 处理；没有超出计划 route list 的新功能 routes（`/`、`/npc/:id`、`/building/:id`、`/chat`、`/mayor`、`/dev`）。
  QA happy: run `python frontend/scripts/verify_scope_fidelity.py --repo . --plan .omo/plans/unity-frontend-migration.md | tee frontend/test-results/f4-scope.txt`；script 检查 forbidden diffs、`client/index.html` existence、nginx `/legacy/`、absence of backend `class ChangePrompt`、frontend route whitelist。QA failure: run `python frontend/scripts/run_negative_fixture.py --fixture frontend/test-fixtures/negative/scope-violation.json | tee frontend/test-results/f4-fail.txt`；verifier 非零退出，输出 violated invariant，并 restore repo。
  Commit: none（verification-only final gate）

## Commit strategy
每个 todo 一个 atomic conventional-commit（commit line 如上）。分支 `feat/frontend-migration`。可以选择 wave-level PR（每个 wave 一个 PR），但 commit 仍保持 atomic。不要把多个 todo 的 impl+test squash 到一起；每个 todo 的实现和测试归属于该 todo 的单独 commit。F1-F4 通过后再最终 merge。

## Success criteria
- 新 React+Vite+TS SPA 在 `frontend/` 中构建（multi-stage Dockerfile），并通过 docker 运行在 `http://localhost:8081/`，Unity 仍可在 `/legacy/` 访问。
- 不改变现有 WS 协议：20 个 working command URI + backend-broken `command.npc.ChangePrompt` + `ping` = 22 个 request case，再加 15 个 push URI 均被处理；ChangePrompt 作为 known-broken 被 graceful surface；由 parity matrix（T27）和 golden-trace diff（T26）验证。
- 与 Unity demo 达到完整视觉 + 交互对等：town map、NPC/building/equipment/player panels、chat、mayor mode、sim control、dev console。
- Backend（`main.py`,`app.py`,`command/**`,`model/**`,`agent/**`,`config/**`）字节级保持 unchanged，即零编辑。
- Todos 1-29 全部 green 且有 evidence；F1-F4 APPROVE。
