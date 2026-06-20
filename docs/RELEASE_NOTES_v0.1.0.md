# Routebook v0.1.0 / 路书 v0.1.0

First public desktop release of Routebook / 路书.

路书的第一个公开桌面版。

## What It Does / 它做什么

Routebook helps people clarify rough ideas into practical plans and vibe coding briefs. It asks one plain-language question at a time, maintains a live intent document, and can generate:

- a human-readable plan,
- and, for software ideas, a task brief for AI coding tools.

路书帮助普通人把模糊想法问成可执行计划，也能把 vibe coding 前的一团感觉问成任务书。它一次只问一个问题，右侧实时沉淀意图文档，并且可以生成：

- 给人看的计划书
- 软件类想法的 AI 任务书

## Highlights / 亮点

- Multi-window isolation with stable `windowKey`
- Per-window chat history, intent document, plan, and task brief
- Model presets for DeepSeek, MiniMax, mimo, and Ollama
- OpenAI-compatible model support
- Local data storage and backup export
- Chinese, English, Japanese, and Korean UI
- Desktop packages for Windows, macOS, and Linux
- Shared text-free logo mark across languages

## Download / 下载

- Windows installer: `Routebook-Setup-0.1.0.exe`
- Windows portable zip: `Routebook-0.1.0-x64.zip`
- Windows arm64 portable zip: `Routebook-0.1.0-arm64.zip`
- macOS Intel: `Routebook-0.1.0-x64.dmg`
- macOS Apple Silicon: `Routebook-0.1.0-arm64.dmg`
- Linux x64: `Routebook-0.1.0-x86_64.AppImage`
- Linux arm64: `Routebook-0.1.0-arm64.AppImage`

## Notes / 说明

These builds are unsigned. macOS and Windows may show first-run warnings.

这些构建默认不签名。macOS 和 Windows 第一次打开时可能出现系统提醒。

Cloud model providers require your own API key. Local Ollama can be used without a key.

云端模型需要用户自己的 API key。本机 Ollama 可以不填密钥。

## Checks / 检查

Release checks completed:

- `npm run smoke`
- `npm audit --audit-level=high`
- `node --check` for backend, Electron main/preload, screenshot script, and frontend script
- sensitive information scan
- multi-platform packaging
