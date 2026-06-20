# Model Setup / 模型设置

Routebook uses OpenAI-compatible chat completion APIs.

路书使用兼容 OpenAI 的聊天补全接口。只要服务支持 `/chat/completions`，就可以作为路书的大脑。

## Built-In Presets / 内置预设

- DeepSeek: `https://api.deepseek.com/v1`
- MiniMax: `https://api.minimaxi.com/v1`
- mimo: `https://token-plan-cn.xiaomimimo.com/v1`
- Ollama: `http://127.0.0.1:11434/v1`

Claude is not retained as a default provider in the open-source build.

开源版不保留 Claude 默认项。

## Cloud Models / 云端模型

Cloud model providers normally require an API key.

Open Model / 大脑, choose a preset, and fill:

- name,
- endpoint,
- API key,
- model name.

云端模型通常需要密钥。路书会把密钥保存在本机 `models.json`，不会把密钥写进导出的备份。

## Local Ollama / 本机 Ollama

Ollama is an advanced option. It proves that Routebook is not locked to one cloud vendor, but it is not the default path for ordinary users.

本机 Ollama 是高级选项和开放性证明，不是普通用户主线。

Use:

```text
Endpoint: http://127.0.0.1:11434/v1
API key: leave blank
Model: any installed Ollama chat model
```

If Ollama runs on another machine, use a reachable LAN address or an SSH tunnel.

如果 Ollama 跑在局域网机器上，可以填可访问的局域网地址，也可以用 SSH 隧道。

## Troubleshooting / 排查

- If the model returns empty content, try a faster or more instruction-following model.
- If a cloud model fails, confirm the endpoint includes `/v1`.
- If local Ollama fails, confirm Ollama is running and the model name exists.
- If the key field is blank for a cloud provider, Routebook cannot authenticate.

常见问题：

- 云端模型要填密钥。
- 本机 Ollama 密钥可以留空。
- 推理模型可能更慢，先用速度更稳的模型测试。
- 地址、模型名、密钥任何一个错了，路书都会接不上“大脑”。
