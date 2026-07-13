# AgentSims：用于大语言模型评测的开源沙盒

<p align="center">
🇺🇸 <a href="../README.md">English</a> | 🇨🇳 <a href="./README_zh.md">简体中文</a>
</p>

在 ChatGPT 类大语言模型（LLM）快速发展的背景下，如何评估大语言模型的能力仍然是一个开放问题。现有评测方法通常存在以下不足：（1）评测能力受限；（2）基准容易被污染或攻破；（3）指标不够客观。我们认为，基于任务的评测是一种通用方案：让 LLM Agent 在模拟环境中完成任务，从而评估其能力。

我们提出了 <a href="https://www.agentsims.com/" title="AgentSims">AgentSims</a>，这是一个易用的基础设施，帮助不同学科的研究者测试他们关注的特定能力。研究者可以通过交互式 GUI 添加 Agent 和建筑来构建评测任务，也可以用少量代码部署并测试新的支撑机制，例如记忆系统和规划系统。在线演示地址为：https://agentsims.com/。

***与其他类似系统相比，AgentSims 具备更好的自定义能力，因为它面向开源的自定义任务构建而设计。更多信息请参阅我们的 <a href="https://arxiv.org/abs/2308.04026" title="arXiv">arXiv 论文</a>。***

![Image text](https://github.com/py499372727/AgentSims/blob/main/cover.png)

## 依赖

```text
Python: 3.9.x
MySQL: 8.0.31
```

为了获得更好的稳定性，我们推荐在 macOS 或 Linux 上部署。

## Docker 快速开始

可以使用 Docker 在 Windows/macOS/Linux 的 Linux 容器中运行 AgentSims。Compose 配置会启动 MySQL 8.0.31、Tornado WebSocket 服务，以及用于 Web 客户端静态文件的 nginx 服务。

启动前，请先创建本地运行时文件/目录：

```bash
mkdir -p snapshot logs
```

在本地创建 `config/api_key.json`。该文件会被 git 忽略，并挂载到 server 容器中：

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

启动服务栈：

```bash
docker compose up --build
```

打开 Web 客户端：

```text
http://localhost:8081
```

WebSocket 服务地址：

```text
ws://localhost:8000/ws
```

停止服务栈：

```bash
docker compose down
```

重置 MySQL 数据卷并重新执行数据库初始化：

```bash
docker compose down -v
```

Docker entrypoint 会在容器内部重写 `config/app.json` 中的数据库 host，使其使用 compose 服务名 `mysql`。该重写不会修改宿主机上的源码文件。

## API Key

出于 API Key 安全考虑，仓库中未包含参数文件。请自行创建以下文件，并确保不要将其提交到 git：

```text
config/api_key.json
```

文件参数示例如下：

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

`base_url` 可以填写 OpenAI-compatible 服务的 `/v1` 根地址，也可以填写完整的 `/v1/chat/completions` endpoint。`models` 用于将 `config/agent.json` 中的游戏内模型选项名映射到实际发送给 API 的模型名。

## 创建文件夹

运行前请执行：

```bash
mkdir snapshot
mkdir logs
```

此外，建议在运行前根据实际需求修改 `config/app.json` 中的 ***count_limit***（每次运行的循环次数）和 ***cooldown***（两次运行之间的冷却时间），以平衡 API Key 使用成本与实验运行效率。

如果运行过程中遇到问题，请优先参考 wiki 中的 <a href="https://github.com/py499372727/AgentSims/wiki" title="DOCS">DOCS</a>。如果仍无法解决，请提交 issue 或直接联系我们。

--------------------------------------

请按以下步骤使用本系统：

## 1. MySQL 初始化

服务端使用 MySQL 进行数据存储。安装对应版本的 MySQL 后，启动 SQL 服务并按如下方式初始化：

```sql
use mysql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '';
flush privileges;

create database `llm_account` default character set utf8mb4 collate utf8mb4_unicode_ci;
create database `llm_game` default character set utf8mb4 collate utf8mb4_unicode_ci;
create database `llm_game0001` default character set utf8mb4 collate utf8mb4_unicode_ci;
create database `llm_game0002` default character set utf8mb4 collate utf8mb4_unicode_ci;
```

## 2. 安装

```bash
pip install tornado
pip install mysql-connector-python
pip install websockets
pip install httpx
```

或者：

```bash
pip install -r requirements.txt
```

## 3. 设计任务

此时你可以开始构建任务。如果只是想先试用系统，可以跳过这一步。关于任务构建，请参考 wiki 中的 <a href="https://github.com/py499372727/AgentSims/wiki" title="DOCS">DOCS</a>，或我们的 <a href="https://arxiv.org/abs/2308.04026" title="arXiv">arXiv 论文</a>第 4.2 节 Developer Mode。

## 4. 运行服务端

启动服务端：

```bash
./restart.sh
```

当你在服务端终端看到以下输出时，表示服务端已成功启动：

```text
--------Server Started--------
```

## 5. 运行客户端

服务端成功启动后，请启动客户端。当前版本提供的是 Web 客户端，请在浏览器中打开 ***client/index.html***。

注意：有时 Web 客户端可能无法正确打开。我们建议在你的 Python IDE 中右键点击 ***index.html***，然后选择 ***open in browser***。如果你熟悉 ***nginx***，使用 nginx 也是很好的选择。

当你在服务端终端看到以下输出时，表示客户端已成功启动：

```text
somebody linked.
```

## 6. 创建 agents 和 buildings

此时你可以创建 agents 和 buildings。创建方法请参考 wiki 中的 <a href="https://github.com/py499372727/AgentSims/wiki" title="DOCS">DOCS</a>，或我们的 <a href="https://arxiv.org/abs/2308.04026" title="arXiv">arXiv 论文</a>第 4.1 节 User Mode。

## 7. 设置评测目标与测量方式

在 AgentSims 中，评测以 QA 表单形式进行。系统每隔 k 个 tick 会向目标 Agent 提出一个评测问题。你可以在 `config/eval.json` 中自定义目标 Agent、评测问题以及响应的测量方式。

`config/eval.json` 中的示例展示了一个名为 `know pH` 的实验。该实验会每 1 个 tick 向 Agent Alan 提问 `Are you acquainted with pH`；如果响应中包含 `Yes`，则评测函数返回 `True`。

```json
{
  "id": "know pH", // the human-readable name of evaluation,
  "target_nickname": "Alan", // name of the subject agent
  "query": "Are you acquainted with pH ?", // evaluation qustion
  "measurement": " 'Yes' in response", // measurement,
  "interval": 1 // Evaluate every 1 tick
}
```

## 8. 运行仿真

你可以通过 Web 客户端上的按钮启动 ***tick*** 或 ***mayor***。也可以通过命令启动：

```bash
python -u tick.py
```

```bash
python -u mayor.py
```

关于 ***tick*** 与 ***mayor*** 的区别，请参考我们的 <a href="https://arxiv.org/abs/2308.04026" title="arXiv">arXiv 论文</a>。

## 9. 重启

每次重启时，需要执行以下重置步骤：

```bash
rm -rf snapshot/app.json
```

```bash
sudo mysql
drop database llm_account;
drop database llm_game0001;
create database `llm_game0001` default character set utf8mb4 collate utf8mb4_unicode_ci;
create database `llm_account` default character set utf8mb4 collate utf8mb4_unicode_ci;
```

```bash
./restart.sh
```

-------------------------------

## 作者与引用

***Authors***: Jiaju Lin,<a href="https://twitter.com/zhaohao919041" title="twitter">Haoran Zhao</a>*,Aochi Zhang,Yiting Wu, Huqiuyue Ping,Qin Chen

***About Us***: PTA Studio is a startup company dedicated to providing a better open source architecture for the NLP community and more interesting AI games for players.

***Contact Us***: zhaohaoran@buaa.edu.cn

如果你使用了本仓库中的代码或数据，请引用我们的论文。

```bibtex
@misc{lin2023agentsims,
      title={AgentSims: An Open-Source Sandbox for Large Language Model Evaluation},
      author={Jiaju Lin and Haoran Zhao and Aochi Zhang and Yiting Wu and Huqiuyue Ping and Qin Chen},
      year={2023},
      eprint={2308.04026},
      archivePrefix={arXiv},
      primaryClass={cs.AI}
}
```
