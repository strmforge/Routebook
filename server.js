// 反问式计划工具 v0.1 —— 本地服务器（“导演”）
// 职责：托管界面、把对话状态交给大模型（“大脑”）、按规矩收回结构化结果。
// 运行：node server.js  然后浏览器打开 http://localhost:3457
// 桌面安装版会直接复用本文件里的业务函数，不启动端口。

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const DEFAULT_PORT = 3457;
const PACKAGE_INFO = loadPackageInfo();

function loadPackageInfo() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  } catch (e) {
    return { version: '0.0.0' };
  }
}

// ---------- 大脑配置 ----------
// 早期版本用 config.json 放一个模型。安装版开始改成“模型列表”，让普通用户
// 能在界面里添加、选择 DeepSeek/Kimi/Ollama/OpenAI-compatible 等大脑。
function getConfigDir() {
  return process.env.LUSHU_CONFIG_DIR || __dirname;
}

function getModelsPath() {
  return path.join(getConfigDir(), 'models.json');
}

function getLegacyConfigPath() {
  return path.join(__dirname, 'config.json');
}

function defaultModelConfig() {
  return { activeId: '', profiles: [] };
}

function loadModelConfig() {
  const modelsPath = getModelsPath();
  try {
    return normalizeModelConfig(JSON.parse(fs.readFileSync(modelsPath, 'utf8')));
  } catch (e) { /* 没有 models.json 就继续看旧配置 */ }

  try {
    const legacy = JSON.parse(fs.readFileSync(getLegacyConfigPath(), 'utf8'));
    if (legacy.provider !== 'openai-compatible') return defaultModelConfig();
    const profile = normalizeProfile({
      ...legacy,
      id: 'custom-openai-compatible',
      name: '自定义大脑',
    }, 0);
    return { activeId: profile.id, profiles: [profile] };
  } catch (e) {
    return defaultModelConfig();
  }
}

function normalizeModelConfig(input) {
  const rawProfiles = Array.isArray(input && input.profiles) ? input.profiles : [];
  const seen = new Set();
  const profiles = rawProfiles
    .map(normalizeProfile)
    .filter((p) => {
      if (!p || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

  const activeId = profiles.some((p) => p.id === input.activeId) ? input.activeId : (profiles[0] ? profiles[0].id : '');
  return { activeId, profiles };
}

function normalizeProfile(profile, index) {
  if (!profile || typeof profile !== 'object') return null;
  if (profile.provider && profile.provider !== 'openai-compatible') return null;
  const id = sanitizeId(profile.id) || 'model-' + (index + 1);
  return {
    id,
    name: String(profile.name || '自定义大脑').trim(),
    provider: 'openai-compatible',
    model: String(profile.model || '').trim(),
    baseUrl: String(profile.baseUrl || '').trim(),
    apiKey: String(profile.apiKey || '').trim(),
  };
}

function sanitizeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function getActiveBrain() {
  const config = loadModelConfig();
  return config.profiles.find((p) => p.id === config.activeId) || config.profiles[0] || null;
}

function publicModelConfig() {
  const config = loadModelConfig();
  return {
    activeId: config.activeId,
    profiles: config.profiles.map((p) => ({
      ...p,
      apiKey: '',
      hasApiKey: !!p.apiKey,
    })),
  };
}

function appInfo() {
  return {
    name: '路书',
    version: PACKAGE_INFO.version || '0.0.0',
    configDir: getConfigDir(),
    windowsDir: getWindowsDir(),
    modelsPath: getModelsPath(),
  };
}

function saveModelConfig(input) {
  const current = loadModelConfig();
  const currentById = new Map(current.profiles.map((p) => [p.id, p]));
  const next = normalizeModelConfig(input || {});

  for (const profile of next.profiles) {
    const old = currentById.get(profile.id);
    if (profile.provider === 'openai-compatible' && !profile.apiKey && old && old.apiKey) {
      profile.apiKey = old.apiKey;
    }
  }

  fs.mkdirSync(getConfigDir(), { recursive: true });
  fs.writeFileSync(getModelsPath(), JSON.stringify(next, null, 2));
  return publicModelConfig();
}

// ---------- 聊天窗口存储：借鉴 OpenClaw 的 sessionKey 思路 ----------
// UI 标题只供人看；真实边界是 windowKey。没有 windowKey 的请求一律拒绝，
// 不默认 main，不默认最近窗口。
function getWindowsDir() {
  return path.join(getConfigDir(), 'windows');
}

function getWindowIndexPath() {
  return path.join(getWindowsDir(), 'index.json');
}

function windowFilePath(windowKey) {
  return path.join(getWindowsDir(), windowKey + '.json');
}

function createWindowKey() {
  return 'window-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function isWindowKey(value) {
  return /^window-[a-z0-9]+-[a-z0-9]+$/.test(String(value || ''));
}

function emptyWindow(title) {
  const now = Date.now();
  const windowKey = createWindowKey();
  return {
    windowKey,
    title: title || '新的窗口',
    createdAt: now,
    updatedAt: now,
    history: [],
    intent: emptyIntent(),
    done: false,
    plan: null,
    spec: null,
  };
}

function normalizeWindow(input) {
  const now = Date.now();
  const windowKey = isWindowKey(input && input.windowKey) ? input.windowKey : createWindowKey();
  return {
    windowKey,
    title: String((input && input.title) || '新的窗口').trim() || '新的窗口',
    createdAt: Number(input && input.createdAt) || now,
    updatedAt: Number(input && input.updatedAt) || now,
    history: Array.isArray(input && input.history) ? input.history : [],
    intent: (input && input.intent) || emptyIntent(),
    done: !!(input && input.done),
    plan: (input && input.plan) || null,
    spec: (input && input.spec) || null,
  };
}

function ensureWindowsReady() {
  fs.mkdirSync(getWindowsDir(), { recursive: true });
  if (fs.existsSync(getWindowIndexPath())) return;
  const first = emptyWindow();
  saveWindow(first);
  saveWindowIndex({ activeWindowKey: first.windowKey, windows: [windowMeta(first)] });
}

function loadWindowIndex() {
  ensureWindowsReady();
  try {
    const index = JSON.parse(fs.readFileSync(getWindowIndexPath(), 'utf8'));
    const windows = Array.isArray(index.windows) ? index.windows.filter((w) => isWindowKey(w.windowKey)) : [];
    if (windows.length) {
      const activeWindowKey = windows.some((w) => w.windowKey === index.activeWindowKey) ? index.activeWindowKey : windows[0].windowKey;
      return { activeWindowKey, windows };
    }
  } catch (e) { /* 损坏时重建 */ }
  const first = emptyWindow();
  saveWindow(first);
  const rebuilt = { activeWindowKey: first.windowKey, windows: [windowMeta(first)] };
  saveWindowIndex(rebuilt);
  return rebuilt;
}

function saveWindowIndex(index) {
  fs.mkdirSync(getWindowsDir(), { recursive: true });
  fs.writeFileSync(getWindowIndexPath(), JSON.stringify(index, null, 2));
}

function windowMeta(win) {
  return {
    windowKey: win.windowKey,
    title: win.intent && win.intent.标题 ? win.intent.标题 : win.title,
    createdAt: win.createdAt,
    updatedAt: win.updatedAt,
    done: !!win.done,
    turns: win.history.filter((m) => m.role === 'user').length,
  };
}

function loadWindow(windowKey) {
  if (!isWindowKey(windowKey)) throw new Error('缺少有效的窗口标识，拒绝路由');
  const fp = windowFilePath(windowKey);
  if (!fs.existsSync(fp)) throw new Error('这个聊天窗口不存在，拒绝路由');
  return normalizeWindow(JSON.parse(fs.readFileSync(fp, 'utf8')));
}

function saveWindow(win) {
  fs.mkdirSync(getWindowsDir(), { recursive: true });
  fs.writeFileSync(windowFilePath(win.windowKey), JSON.stringify(win, null, 2));
}

function touchWindowInIndex(win) {
  const index = loadWindowIndex();
  const nextMeta = windowMeta(win);
  const windows = index.windows.filter((w) => w.windowKey !== win.windowKey);
  windows.unshift(nextMeta);
  saveWindowIndex({ activeWindowKey: win.windowKey, windows });
}

function listWindows() {
  return loadWindowIndex();
}

function createChatWindow(title) {
  const win = emptyWindow(title);
  saveWindow(win);
  touchWindowInIndex(win);
  return { index: listWindows(), window: win };
}

function setActiveWindow(windowKey) {
  const win = loadWindow(windowKey);
  const index = loadWindowIndex();
  saveWindowIndex({ activeWindowKey: win.windowKey, windows: index.windows });
  return { index: listWindows(), window: win };
}

function renameChatWindow(windowKey, title) {
  const win = loadWindow(windowKey);
  win.title = String(title || '').trim() || win.title;
  if (!win.intent.标题) win.intent.标题 = win.title;
  win.updatedAt = Date.now();
  saveWindow(win);
  touchWindowInIndex(win);
  return { index: listWindows(), window: win };
}

function deleteChatWindow(windowKey) {
  const index = loadWindowIndex();
  if (index.windows.length <= 1) throw new Error('至少要保留一个聊天窗口');
  loadWindow(windowKey);
  try { fs.unlinkSync(windowFilePath(windowKey)); } catch (e) {}
  const windows = index.windows.filter((w) => w.windowKey !== windowKey);
  const activeWindowKey = index.activeWindowKey === windowKey ? windows[0].windowKey : index.activeWindowKey;
  saveWindowIndex({ activeWindowKey, windows });
  return { index: listWindows(), window: loadWindow(activeWindowKey) };
}

function importWindows(rawWindows) {
  const incoming = Array.isArray(rawWindows) ? rawWindows : [];
  const imported = [];
  for (const raw of incoming) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const win = normalizeWindow({
      ...source,
      windowKey: createWindowKey(),
      title: source.title || (source.intent && source.intent.标题) || '导入窗口',
    });
    saveWindow(win);
    imported.push(win);
  }
  if (!imported.length) return { index: listWindows(), imported: 0 };
  const existing = listWindows().windows.filter((w) => !imported.some((win) => win.windowKey === w.windowKey));
  const windows = imported.map(windowMeta).concat(existing);
  saveWindowIndex({ activeWindowKey: imported[0].windowKey, windows });
  return { index: listWindows(), window: imported[0], imported: imported.length };
}

function exportWindows() {
  const index = listWindows();
  const windows = index.windows.map((meta) => loadWindow(meta.windowKey));
  return {
    app: appInfo(),
    exportedAt: new Date().toISOString(),
    index,
    windows,
  };
}

// ---------- 规矩：反问协议（写死在产品里的方法论） ----------
const PROTOCOL = `你是一个“反问式计划助手”，服务对象是完全不懂技术、不懂项目管理的普通人。你的任务不是直接给建议，而是通过一次次反问，把用户模糊的想法澄清成一份可实施的计划。

你维护一份“意图骨架”，包含这些格子：
- 标题：这个计划的名字（你来起，随理解加深可以改）
- 目标：用户到底想要什么（成事的画面）
- 成功标准：做到什么样算成了（要可判断）
- 约束：钱、时间、精力等现实限制
- 资源：用户已有的条件、能力、人脉、工具
- 风险：可能让计划失败的事
- 依赖：必须先有别人/别的事配合才能进行的部分
- 非目标：明确不做的事（防止计划膨胀）
- 类型：你来判断填写——"软件工具"（成果是一个软件、网页、小程序这类在电脑或手机上用的东西）或"非软件"（装修、副业、活动、学习这类）

每个格子里的条目都带状态：
- “推测”：你根据对话猜的，还没经用户确认
- “已确认”：用户明确说过的

每一轮你要做三件事：
1. 如果这一轮听到了新信息，用一句话复述你的新理解，自然地向用户求证（不要每轮都机械复述）。
2. 更新意图骨架：用户明说的记为“已确认”，你合理推断的记为“推测”。大胆推测，把格子先填上，错了用户会纠正。
3. 提出下一个问题。

提问的铁律（违反任何一条都算失败）：
- 一次只问一个问题。
- 禁止任何技术术语和行业黑话。问题必须是一个不懂行的人凭生活经验就能回答的。
- 涉及取舍时，把选项翻译成“后果”来问。例：不问“数据存本地还是云端”，要问“换一台电脑打开，还想看到之前的东西吗”。
- 优先问对计划成败影响最大的空缺或矛盾。发现用户的想法自相矛盾时，优先温和地点出矛盾并问怎么取舍。
- 适合的时候给2-3个带说明的选项降低回答成本，但永远允许用户自由回答。
- 纯执行层面的小事不要问，自己拿主意填进骨架（标为“推测”）。
- 用户已经说过的、或能从上文合理推断出来的，绝不再问一遍——那等于让他做重复劳动，会让他觉得你没在听。先把能填的格子都填上（标“推测”），只问真正还空着、又重要的。
- 如果用户一开口就一口气说了很多、给的想法已经挺详细，不要立刻拿一堆问题盘问他——那像在质疑他、否定他刚说的。先尽量按他的话把骨架填满，把你做的假设标成“推测”让他过目，再只挑其中最关键的一两处不确定的问。
- 如果用户是在倾诉烦恼、抱怨或表达情绪（而不是在交代想做的事），先接住他的情绪、回应他这个人，不要急着弹问题。等他情绪稳了、话头转回“想做的事”，再继续问。

收尾判断：当“目标、成功标准、约束”的关键条目都“已确认”，没有未解决的重大矛盾，且你作为一个冷读者拿着这份骨架已经不需要再问任何问题就能写出计划书时，把 done 设为 true，并在 say 里告诉用户：想法已经聊清楚了，可以生成计划书了。

输出格式（严格遵守）：只输出一个 JSON 对象，不要任何其他文字、不要代码块标记。结构如下：
{"say": "你对用户说的话（复述+提问，或收尾语）", "intent": {"标题": "...", "类型": "软件工具", "目标": [{"内容": "...", "状态": "已确认"}], "成功标准": [], "约束": [], "资源": [], "风险": [], "依赖": [], "非目标": []}, "done": false}
intent 必须每次都输出完整的当前状态（不是增量）。say 字符串里如需换行，必须写成 \\n，不得直接换行；引用别人的话时用中文引号「」，绝不要用英文双引号。`;

const PLAN_PROTOCOL = `你是一个计划书撰写者。根据下面的意图骨架和对话记录，写一份完整的计划书，给一个不懂技术的普通人看。

要求：
- 用 Markdown 写，开头是计划标题。
- 结构：这是什么 / 为什么做 / 做成什么样算成功 / 怎么一步步做（具体到第一步今天就能开始）/ 需要什么 / 要花多少（钱和时间，给出合理估计区间）/ 可能出什么岔子、怎么防 / 明确不做什么。
- 通篇生活语言，禁止术语。步骤要具体可执行，不要"调研市场"这种空话，要"本周找3个做过这件事的人，每人问这三个问题"这种实话。
- 只输出计划书 Markdown 本身，不要任何额外说明。`;

// ---------- 软件类计划的产出：给任何 AI 编程工具的任务书 ----------
const SPEC_PROTOCOL = `你是一个任务书撰写者。根据下面的意图骨架和对话记录，写一份交给“AI 编程工具”直接实施的任务书。读它的可能是任何工具（Codex、Kiro、Cursor、DeepSeek、通义灵码、各种 IDE 助手……），所以：

- 任务书必须自足：不依赖任何对话上下文，没参与过对话的实施者拿到就能直接动手
- 开头一句话说清这是什么工具、给谁用、解决什么问题
- 功能清单按重要性排序，只写对话里确认过的和必要的合理推断，不添花哨功能
- 用平实语言描述界面布局和交互，不指定编程语言和技术框架（让实施工具自己选擅长的）
- 默认实现建议：如无更好理由，做成一个双击就能在浏览器打开的单个网页文件，数据存在使用者自己的设备上——因为使用者完全不懂技术，装不了开发环境
- 工具界面必须全中文、说人话
- 列出边界情况和容易出错的地方
- 结尾附一份验收清单，一条一条可勾选
- 最后注明：实施中如有疑问，按本任务书的精神自行决定，不要拿技术问题去为难使用者

只输出任务书 Markdown 本身，不要其他说明。`;

// ---------- 大脑：可插拔，开源版只走兼容 OpenAI 的接口 ----------
function askBrain(prompt, timeoutMs = 180000) {
  const brain = getActiveBrain();
  if (!brain) throw new Error('还没有添加大脑。点右上角“模型”，先填一个兼容 OpenAI 的服务。');
  return askHttpBrain(brain, prompt, timeoutMs);
}

async function askHttpBrain(brain, prompt, timeoutMs) {
  if (!brain.baseUrl) throw new Error('还没有填写大脑地址');
  if (!brain.model) throw new Error('还没有填写模型名');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (brain.apiKey) headers.Authorization = 'Bearer ' + brain.apiKey;
    let r;
    try {
      r = await fetch(brain.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: brain.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 4096,
          stream: false,
        }),
        signal: ctrl.signal,
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('大脑响应超时了。可以稍后重试，或换一个更快的模型。');
      throw new Error('连不上大脑服务。请检查模型设置里的接口地址，或确认本地 Ollama / 局域网服务已经启动。');
    }

    const text = await r.text();
    let d;
    try {
      d = text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error('大脑返回的不是 JSON。请检查接口地址是不是填到了兼容 OpenAI 的 /v1 地址。');
    }
    if (!r.ok) {
      const detail = d && d.error && d.error.message ? '：' + d.error.message : '';
      throw new Error('大脑服务返回 ' + r.status + detail + '。请检查地址、密钥和模型名。');
    }

    const choice = d && d.choices && d.choices[0];
    const answer = choiceText(choice);
    if (!answer.trim()) {
      throw new Error('大脑返回了空内容。推理模型可能把输出额度都用在思考里了，建议换轻一点的模型，或稍后再试。');
    }
    return answer;
  } finally {
    clearTimeout(timer);
  }
}

function choiceText(choice) {
  if (!choice) return '';
  const message = choice.message || {};
  const content = message.content != null ? message.content : choice.text;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === 'string') return part;
      return part && (part.text || part.content || part.output_text) || '';
    }).join('');
  }
  if (content && typeof content === 'object') return content.text || content.content || '';
  return '';
}

// 从模型回复里抠出 JSON（容忍它偶尔加代码块标记）
function extractJSON(text) {
  let t = String(text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();

  const candidates = jsonObjectCandidates(t.replace(/<think>[\s\S]*?<\/think>/gi, '').trim());
  for (const slice of candidates) {
    try {
      return JSON.parse(slice);
    } catch (e) {
      try {
        return JSON.parse(repairJSON(slice));
      } catch (e2) { /* 继续试下一个候选 JSON */ }
    }
  }

      fs.appendFileSync('/tmp/lushu-raw.log', '\n===== ' + new Date().toISOString() + ' =====\n' + text + '\n');
  throw new Error('回复里没有可解析的 JSON');
}

function jsonObjectCandidates(text) {
  const candidates = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    const end = findJSONEnd(text, i);
    if (end !== -1) candidates.push(text.slice(i, end + 1));
  }
  return candidates.sort((a, b) => b.length - a.length);
}

function findJSONEnd(text, start) {
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') depth++;
    if (c === '}') depth--;
    if (depth === 0) return i;
  }
  return -1;
}

// 模型偶尔会在字符串里直接换行（JSON 不允许），逐字符把字符串内的控制字符转义掉
function repairJSON(s) {
  let out = '';
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') { out += c + (s[++i] || ''); continue; }
      if (c === '"') {
        // 只有后面紧跟 , : } ] 或行尾时才算字符串结束，否则是没转义的内嵌引号
        const rest = s.slice(i + 1).match(/^\s*([,:}\]]|$)/);
        if (rest) { inStr = false; out += c; } else { out += '\\"'; }
        continue;
      }
      if (c === '\n') { out += '\\n'; continue; }
      if (c === '\r') { continue; }
      if (c === '\t') { out += '\\t'; continue; }
      out += c;
    } else {
      if (c === '"') inStr = true;
      out += c;
    }
  }
  return out;
}

function emptyIntent() {
  return { 标题: '', 类型: '', 目标: [], 成功标准: [], 约束: [], 资源: [], 风险: [], 依赖: [], 非目标: [] };
}

function normalizeLanguage(value) {
  return ['zh', 'en', 'ja', 'ko'].includes(value) ? value : 'zh';
}

function languageName(code) {
  return {
    zh: '简体中文',
    en: 'English',
    ja: '日本語',
    ko: '한국어',
  }[normalizeLanguage(code)];
}

function languageInstruction(code, mode) {
  const name = languageName(code);
  if (normalizeLanguage(code) === 'zh') return '';
  const shared =
    '\n\n===== 输出语言 =====\n' +
    '当前界面语言是 ' + name + '。所有用户可见的内容都用 ' + name + '：提问、复述、计划书、任务书、软件界面描述和验收清单都要跟随这个语言。';
  if (mode === 'turn') {
    return shared + ' 但是 JSON 字段名、状态值“推测/已确认”、类型值“软件工具/非软件”必须保持中文，方便程序读取。';
  }
  return shared + ' 如果上面的规则里出现“必须全中文”之类的旧要求，以这里的界面语言为准。';
}

function contentTypeFor(fp) {
  if (fp.endsWith('.svg')) return 'image/svg+xml';
  if (fp.endsWith('.png')) return 'image/png';
  if (fp.endsWith('.ico')) return 'image/x-icon';
  if (fp.endsWith('.icns')) return 'image/icns';
  if (fp.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

// ---------- 业务：一轮对话 ----------
async function handleTurn(body) {
  const win = loadWindow(body.windowKey);
  const history = win.history || [];
  const intent = win.intent || emptyIntent();
  const message = (body.message || '').trim();
  const language = normalizeLanguage(body.language);
  if (!message) throw new Error('没有要发送的内容');

  const transcript = history
    .slice(-20)
    .map((m) => (m.role === 'user' ? '用户' : '助手') + '：' + m.text)
    .join('\n');

  const prompt =
    PROTOCOL +
    languageInstruction(language, 'turn') +
    '\n\n===== 当前意图骨架 =====\n' +
    JSON.stringify(intent, null, 1) +
    '\n\n===== 此前对话 =====\n' +
    (transcript || '（这是第一轮）') +
    '\n\n===== 用户这一轮说 =====\n' +
    message +
    '\n\n现在按规矩输出 JSON：';

  const raw = await askBrain(prompt);
  const parsed = extractJSON(raw);
  win.history.push({ role: 'user', text: message });
  win.history.push({ role: 'bot', text: parsed.say || '（我没说上话，再说一遍你的想法？）' });
  win.intent = parsed.intent || intent;
  win.done = !!parsed.done;
  win.updatedAt = Date.now();
  if (win.intent && win.intent.标题 && (win.title === '新的窗口' || win.title === '旧对话' || !win.title)) win.title = win.intent.标题;
  saveWindow(win);
  touchWindowInIndex(win);
  return {
    window: win,
    say: parsed.say || '（我没说上话，再说一遍你的想法？）',
    intent: win.intent,
    done: win.done,
  };
}

// ---------- 业务：生成计划书 ----------
async function handlePlan(body) {
  const win = loadWindow(body.windowKey);
  const history = win.history || [];
  const intent = win.intent || emptyIntent();
  const language = normalizeLanguage(body.language);
  const transcript = history
    .map((m) => (m.role === 'user' ? '用户' : '助手') + '：' + m.text)
    .join('\n');
  const prompt =
    PLAN_PROTOCOL +
    languageInstruction(language, 'plan') +
    '\n\n===== 意图骨架 =====\n' +
    JSON.stringify(intent, null, 1) +
    '\n\n===== 完整对话 =====\n' +
      transcript +
    '\n\n现在输出计划书 Markdown：';
  const markdown = await askBrain(prompt, 300000);
  win.plan = markdown.trim();
  win.updatedAt = Date.now();
  saveWindow(win);
  touchWindowInIndex(win);
  return { markdown: win.plan, window: win };
}

// ---------- 业务：生成给任何 AI 编程工具的任务书 ----------
async function handleSpec(body) {
  const win = loadWindow(body.windowKey);
  const history = win.history || [];
  const intent = win.intent || emptyIntent();
  const language = normalizeLanguage(body.language);
  const transcript = history
    .map((m) => (m.role === 'user' ? '用户' : '助手') + '：' + m.text)
    .join('\n');
  const markdown = await askBrain(
    SPEC_PROTOCOL +
      languageInstruction(language, 'spec') +
      '\n\n===== 意图骨架 =====\n' + JSON.stringify(intent, null, 1) +
      '\n\n===== 完整对话 =====\n' + transcript +
      '\n\n现在输出任务书 Markdown：',
    300000
  );
  win.spec = markdown.trim();
  win.updatedAt = Date.now();
  saveWindow(win);
  touchWindowInIndex(win);
  return { markdown: win.spec, window: win };
}

// ---------- HTTP 服务 ----------
function handleHttpRequest(req, res) {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
    return;
  }
  if (req.method === 'GET' && req.url === '/api/models') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(publicModelConfig()));
    return;
  }
  if (req.method === 'GET' && req.url === '/api/app-info') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(appInfo()));
    return;
  }
  if (req.method === 'GET' && req.url === '/api/export') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="lushu-backup.json"',
    });
    res.end(JSON.stringify(exportWindows(), null, 2));
    return;
  }
  if (req.method === 'GET' && req.url === '/api/windows') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(listWindows()));
    return;
  }
  if (req.method === 'GET' && req.url.startsWith('/assets/')) {
    const rel = decodeURIComponent(req.url.slice('/assets/'.length).split('?')[0]);
    const root = path.join(__dirname, 'assets');
    const fp = path.join(root, rel);
    if (rel.includes('..') || !fp.startsWith(root)) {
      res.writeHead(403); res.end(); return;
    }
    if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
      res.writeHead(200, { 'Content-Type': contentTypeFor(fp) });
      res.end(fs.readFileSync(fp));
      return;
    }
    res.writeHead(404); res.end('Not found'); return;
  }
  if (req.method === 'GET' && req.url.startsWith('/api/windows/')) {
    try {
      const windowKey = decodeURIComponent(req.url.slice('/api/windows/'.length).split('?')[0]);
      const win = loadWindow(windowKey);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ window: win, index: listWindows() }));
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (req.method === 'POST' && (req.url === '/api/turn' || req.url === '/api/plan' || req.url === '/api/spec')) {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', async () => {
      try {
        const body = JSON.parse(data || '{}');
        const result =
          req.url === '/api/turn' ? await handleTurn(body) :
          req.url === '/api/spec' ? await handleSpec(body) :
          await handlePlan(body);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (e) {
        const routingError = /窗口|路由/.test(e.message);
        res.writeHead(routingError ? 400 : 500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: routingError ? e.message : '大脑暂时没接上：' + e.message }));
      }
    });
    return;
  }
  if (req.method === 'POST' && req.url === '/api/windows') {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        const body = JSON.parse(data || '{}');
        const result = createChatWindow(body.title);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  if (req.method === 'POST' && req.url === '/api/windows/active') {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        const body = JSON.parse(data || '{}');
        const result = setActiveWindow(body.windowKey);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  if (req.method === 'POST' && req.url === '/api/windows/rename') {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        const body = JSON.parse(data || '{}');
        const result = renameChatWindow(body.windowKey, body.title);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  if (req.method === 'POST' && req.url === '/api/windows/delete') {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        const body = JSON.parse(data || '{}');
        const result = deleteChatWindow(body.windowKey);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  if (req.method === 'POST' && req.url === '/api/windows/import') {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        const body = JSON.parse(data || '{}');
        const result = importWindows(body.windows || []);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  if (req.method === 'POST' && req.url === '/api/models') {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        const body = JSON.parse(data || '{}');
        const result = saveModelConfig(body);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: '模型设置没保存成功：' + e.message }));
      }
    });
    return;
  }
  res.writeHead(404);
  res.end('Not found');
}

function startServer(port = Number(process.env.PORT) || DEFAULT_PORT) {
  const server = http.createServer(handleHttpRequest);
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && port !== 0) {
      console.log('端口 ' + port + ' 已被占用，正在换一个空闲端口……');
      startServer(0);
      return;
    }
    throw err;
  });

  server.listen(port, () => {
    const actualPort = server.address().port;
    const url = 'http://localhost:' + actualPort;
    console.log('路书已启动：' + url);
    if (process.env.LUSHU_NO_OPEN !== '1') openBrowser(url);
  });
}

function openBrowser(url) {
  const command =
    process.platform === 'darwin' ? 'open' :
    process.platform === 'win32' ? 'cmd' :
    'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  execFile(command, args, () => {});
}

if (require.main === module) {
  startServer();
}

module.exports = {
  askBrain,
  emptyIntent,
  handleTurn,
  handlePlan,
  handleSpec,
  publicModelConfig,
  saveModelConfig,
  appInfo,
  listWindows,
  loadWindow,
  createChatWindow,
  setActiveWindow,
  renameChatWindow,
  deleteChatWindow,
  importWindows,
  exportWindows,
  startServer,
};
