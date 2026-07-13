# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

AgentSims 是一个用于 LLM Agent 评测的 Python 3.9 仿真沙盒。后端通过 Tornado WebSocket 暴露 `/ws`，WebGL/Unity Web 客户端位于 `client/index.html`。核心运行依赖 MySQL 持久化账户、地图、NPC、建筑和装备等状态，并通过 `config/api_key.json` 调用 LLM。

## 常用命令

### 环境准备

```bash
# Python 版本：README 指定 Python 3.9.x
pip install -r requirements.txt

# 首次运行前需要的运行时目录
mkdir snapshot
mkdir logs
```

`config/api_key.json` 不在仓库中，需要本地创建，例如：

```json
{
  "base_url": "https://your-openai-compatible-endpoint/v1",
  "api_key": "your-api-key",
  "timeout": 50,
  "temperature": 0,
  "models": {
    "default": "your-model-name"
  }
}
```

### MySQL 初始化

README 指定使用 MySQL 8.0.31。首次运行前需要创建数据库：

```sql
use mysql;
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '';
flush privileges;

create database `llm_account` default character set utf8mb4 collate utf8mb4_unicode_ci;
create database `llm_game` default character set utf8mb4 collate utf8mb4_unicode_ci;
create database `llm_game0001` default character set utf8mb4 collate utf8mb4_unicode_ci;
create database `llm_game0002` default character set utf8mb4 collate utf8mb4_unicode_ci;
```

数据库连接参数在 `config/app.json` 中配置，默认使用本机 `root` 空密码。

### Docker 运行

仓库提供 `Dockerfile`、`docker-compose.yml`、`docker/entrypoint.sh` 和 `docker/mysql/init.sql`，用于在 Linux 容器中运行服务、MySQL 8.0.31 和 nginx 静态客户端。

```bash
# 首次运行前确保存在本地运行目录，并创建 config/api_key.json
docker compose up --build

# Web 客户端：http://localhost:8081
# WebSocket：ws://localhost:8000/ws

# 停止容器
docker compose down

# 删除 MySQL volume 并重新执行初始化 SQL
docker compose down -v
```

Docker entrypoint 会在容器内把 `config/app.json` 的数据库 host/port/user/password 改成 compose 环境变量（默认 host 为 `mysql`）；不会修改宿主机源码文件。

### 运行服务与仿真

```bash
# 推荐在 macOS/Linux 或支持 POSIX shell 的环境中使用；脚本会重启 main.py 并 tail nohup.log
./restart.sh

# 直接启动 WebSocket 服务，监听 0.0.0.0:8000/ws
python -u main.py

# WebSocket 调试客户端（交互式/脚本化发送命令）
python -u client.py

# 单独推进 tick；可选参数为 tick 次数上限
python -u tick.py
python -u tick.py 5

# 单独运行 mayor 循环；可选参数为循环次数上限
python -u mayor.py
python -u mayor.py 5
```

服务启动后，用浏览器打开 `client/index.html` 作为客户端。看到服务端输出 `somebody linked.` 表示客户端已连接。

### 重置本地运行状态

```bash
# 仓库提供的重置脚本：删除 snapshot/app.json，并重建 llm_account 与 llm_game0001
./preprocess_before_start.sh
```

README 中的手动重置步骤还包括删除 `snapshot/app.json`、重建相关 MySQL 数据库，然后重新运行 `./restart.sh`。

### 验证与测试

仓库当前没有发现测试文件、测试框架配置或 lint 配置。修改 Python 代码后，至少运行语法检查：

```bash
python -m py_compile app.py main.py client.py tick.py mayor.py
```

如需更广泛检查，可对具体改动涉及的 Python 文件运行同一命令。若将来添加测试，请优先记录项目实际采用的测试命令。

## 架构与数据流

### WebSocket 入口与命令分发

- `main.py` 创建 Tornado `Application`，只注册 `/ws` 路由。
- `WebSocketHandler.app_cache` 是进程级共享的 `App` 实例。
- `app.py` 中的 `App.execute()` 解析客户端 JSON 消息，根据 `uri` 动态导入 `command.*` 模块，例如 `command.npc.Create` 会导入 `command/npc/Create.py` 并实例化同名类。
- 命令返回后，`App.execute()` 统一包装 `{code, data, uid, msg, uri}` 响应，并调用 `save_snapshot()` 保存运行时状态到 `snapshot/app.json`。

客户端请求通常形如：

```json
{"uid":"Player-10001","uri":"command.timetick.Tick","method":"POST","data":{}}
```

### Command 与 Model 模式

- 所有命令继承 `command/command_base.py` 的 `CommandBase`。
- `CommandBase._execute()` 负责解析 `uid` token、校验 token、调用 `execute()`、flush 已修改 model，并关闭命令持有的数据库连接。
- `base.py` 提供动态 model 加载：`get_single_model("NPC", id=...)` 会加载 `model.NPCModel.NPCModel`。
- `model/single_model_base.py` 是按 `id` 持久化的简易 ORM，定义 `orm` 字段映射并自动 `create/retrieve/update/delete` MySQL 表。
- `model/game_model_base.py` 用于全局 game 库；`model/AccountModel.py` 和 `model/NPCRegisterModel.py` 管理账户/NPC 注册表。
- `utils/mysql.py` 封装 MySQL connection pool，连接池 key 由 `(host, port, user, pwd, dbname)` 决定。

注意：模型 SQL 多处用字符串拼接构造，改动涉及用户输入时要保持现有行为兼容，并警惕引入新的注入面。

### App 运行时状态

`App` 在内存中维护若干集合/缓存：

- `id_to_ws` / `ws_cache`：WebSocket 与 uid 绑定。
- `actors`：`NPC-xxxx` 到 `agent.actor.Actor` 的映射。
- `inited`、`movings`、`using`、`chatted`、`cache`：tick 循环消费的 NPC 状态队列。
- `tick_state` / `mayor_state`：启动时间、运行标记、tick 计数。
- `eval_configs` / `evals`：从 `config/eval.json` 装载的自动评测配置与运行对象。

这些状态会序列化到 `snapshot/app.json`。`logs/`、`snapshot/app.json`、`snapshot/mayors.json` 和 `config/api_key.json` 都被 `.gitignore` 排除。

### Tick 仿真循环

- `tick.py` 是独立 WebSocket 客户端，会反复向服务端发送 `command.timetick.Tick`。
- `command/timetick/Tick.py` 是仿真推进核心：推进游戏时间、处理 `using/chatted/movings/inited/cache` 队列、驱动 NPC react、发送移动/交互/聊天消息给玩家客户端。
- `Tick.parse_react()` 根据 Actor 返回的 `newPlan`、`chat`、`use` 等结果更新模型、路径、经济收入和 WebSocket 推送。
- `Tick.execute_eval()` 按 tick 间隔执行 `EvalModel`，结果写入 `logs/eval_results.txt`。

`config/app.json` 中的 `tick_cooldown`、`tick_count_limit`、`mayor_cooldown`、`mayor_count_limit` 控制自动启动频率和次数上限。

### LLM Agent 层

- `agent/actor.py` 是仿真世界与 LLM agent 的适配层，`Actor.react()` 根据 observation source 调用 plan/act/chat/use/critic/memory_store 等步骤。
- `agent/agent/agent.py` 组织 Agent 状态、缓存、记忆、prompt 和 LLM 调用。
- prompt 模板位于 `agent/prompt/*.txt`，通过 `agent/agent/components/prompt.py` 加载和填充。
- `agent/utils/llm.py` 读取 `config/api_key.json`，通过 OpenAI-compatible `/chat/completions` endpoint 调用自定义模型；`config/agent.json` 中的模型名会映射到实际 API 模型名。
- LLM 输出会被解析为 JSON；无法解析时包装为 `{"response": ...}`。
- 每个 Agent 的 prompt 日志写入 `logs/{name}_prompt.txt`。

### Mayor 模式

- `mayor.py` 维护 `snapshot/mayors.json` 与 `logs/mayors.log`，循环加载 mayor 状态并通过 WebSocket 代表 `Mayor-*` 发起建筑或 NPC 创建动作。
- `command/starter/MayorStarter.py` 与 `command/starter/TickStarter.py` 通过 `nohup python3.9 ... &` 启动后台循环，这些命令假设 POSIX shell 环境。
- `App.execute()` 中 `Mayor-*` uid 会映射为对应 `Player-*` 逻辑，并在成功创建建筑/NPC 后向玩家发送 `mayor.*.Create` 消息。

### 配置文件

- `config/app.json`：服务、tick/mayor 限制、数据库连接和连接池。
- `config/agent.json`：可选 NPC asset、模型、memory system、plan system。
- `config/buildings.json`、`config/equipments.json`、`config/economics.json`：建筑/装备/经济配置。
- `config/framework.json`：初始地图、建筑、装备布局。
- `config/eval.json`：自动评测目标、问题、measurement 表达式和 tick 间隔。

`config/eval.json` 的 `measurement` 会在 `EvalModel.eval()` 中以 `eval(lambda response: ...)` 执行；修改时必须确保表达式包含 `response` 变量并只用于可信本地配置。

## 当前约束与注意事项

- README 推荐 macOS/Linux，仓库脚本和后台启动命令使用 `nohup`、`ps`、`grep`、`awk`、`tail -f` 等 POSIX 工具；在 Windows 原生 PowerShell 下直接运行可能失败。
- Web 客户端是已构建产物，位于 `client/Build` 和 `client/TemplateData`；仓库内没有 Unity 源工程或前端构建脚本。
- 改动命令名、model 类名或文件路径时要保持动态导入约定：`command.foo.Bar` -> `command/foo/Bar.py` 中的 `Bar` 类，`get_single_model("NPC")` -> `model/NPCModel.py` 中的 `NPCModel` 类。
- `Register`/登录流程会在首次登录时初始化 Player、Map、Town、Buildings、Equipments、NPCs，并创建默认 NPC Actor；修改初始化逻辑时同时检查 `command/auth/login_base.py`、相关 model 的 `init*()` 方法和 `framework` 配置。