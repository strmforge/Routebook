# Data and Backup / 数据和备份

Routebook stores data locally.

路书的数据默认保存在本机。

## Data Files / 数据文件

Main files:

- `models.json`: model profiles and API keys
- `windows/index.json`: window index
- `windows/<windowKey>.json`: one chat window's history and documents

主要文件：

- `models.json`：模型列表和密钥
- `windows/index.json`：窗口索引
- `windows/<windowKey>.json`：单个窗口的聊天记录和文档

Desktop builds store data under the app user-data folder. Browser development mode stores data in the project folder unless `LUSHU_CONFIG_DIR` is set.

安装版会把数据放在应用用户数据目录里。浏览器开发版默认放在项目目录里，除非设置 `LUSHU_CONFIG_DIR`。

## Export Backup / 导出备份

Open Settings / 设置 and click Export Backup / 导出备份.

The backup includes:

- chat windows,
- intent documents,
- plans,
- AI task briefs.

The backup does not include model API keys.

备份包含聊天窗口、意图文档、计划书和 AI 任务书，但不包含模型密钥。

## Privacy / 隐私

Routebook sends the current window's relevant conversation to the configured model provider. It does not send other windows by default.

路书只把当前窗口相关内容发给你配置的模型服务，不会把其他窗口当作兜底上下文发送。

For local-only use, configure a local or LAN OpenAI-compatible service such as Ollama.

如果希望尽量本地化，可以配置本机或局域网里的 OpenAI-compatible 服务，例如 Ollama。
