# Window Isolation / 窗口隔离

Routebook supports multiple chat windows so different projects do not pollute each other's context.

路书支持多个聊天窗口，用来隔离不同项目、想法和上下文。

Each window has its own:

- chat history,
- intent document,
- plan,
- AI task brief.

每个窗口都有自己的：

- 聊天记录
- 意图骨架
- 计划书
- AI 任务书

## windowKey

The visible window title is only for humans. The real routing boundary is `windowKey`.

窗口名只给人看，真正的隔离边界是 `windowKey`。

Requests that send messages, generate plans, or generate task briefs must include a valid `windowKey`.

发送消息、生成计划书、生成任务书都必须带有效 `windowKey`。

If the key is missing or the window does not exist, the backend rejects the request instead of falling back to a default window.

如果缺少 `windowKey` 或窗口不存在，后端会拒绝请求，不会默认落到主窗口或最近窗口。

## Why This Matters / 为什么重要

People often use Routebook for several unrelated ideas:

- a side business,
- a home renovation,
- a software tool,
- a learning plan.

These should not share context. Window isolation keeps each route clean.

用户可能同时问副业、装修、软件工具、学习计划。这些事情不能混在一个上下文里。窗口隔离就是路书的核心安全边界。
