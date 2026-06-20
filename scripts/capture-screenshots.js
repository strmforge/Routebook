const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

const repoRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'routebook-screenshots-'));
process.env.LUSHU_CONFIG_DIR = tempDir;

const server = require('../server');

const demoIntent = {
  标题: '把副业想法问成计划',
  类型: '软件工具',
  目标: [
    { 内容: '确认这个想法服务谁、解决什么具体问题', 状态: '已确认' },
    { 内容: '生成一份别人也能接着执行的计划书', 状态: '已确认' },
  ],
  成功标准: [
    { 内容: '非技术用户能用一句模糊想法开始', 状态: '已确认' },
    { 内容: '每次只问一个问题，避免术语压力', 状态: '已确认' },
  ],
  约束: [
    { 内容: '不同项目必须用独立聊天窗口隔离', 状态: '已确认' },
    { 内容: '模型供应商可替换，不绑定单一服务', 状态: '已确认' },
  ],
  资源: [
    { 内容: '可以调用兼容 OpenAI 的模型服务', 状态: '已确认' },
  ],
  风险: [
    { 内容: '想法太散时容易提前跳到实现细节', 状态: '猜测' },
  ],
  依赖: [
    { 内容: '需要用户提供一个可用模型配置', 状态: '已确认' },
  ],
  非目标: [
    { 内容: '不替用户自动执行整个项目', 状态: '已确认' },
  ],
};

function seedDemoData() {
  server.saveModelConfig({
    activeId: 'deepseek-demo',
    profiles: [
      {
        id: 'deepseek-demo',
        name: 'DeepSeek',
        provider: 'openai-compatible',
        model: 'deepseek-v4-pro',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: '',
      },
      {
        id: 'ollama-demo',
        name: 'Ollama',
        provider: 'openai-compatible',
        model: 'gemma4:e4b-it-q4_K_M',
        baseUrl: 'http://127.0.0.1:11434/v1',
        apiKey: '',
      },
    ],
  });

  server.importWindows([
    {
      title: '副业计划',
      history: [
        { role: 'user', text: '我想搞个副业，但还没想清楚做什么。' },
        { role: 'bot', text: '先从使用场景开始：你希望这个副业主要帮哪一类人解决什么麻烦？' },
        { role: 'user', text: '最好是给普通人用，把一个软件想法问清楚。' },
        { role: 'bot', text: '那这件事成功时，用户手里应该拿到什么结果：计划书、任务书，还是一个能直接运行的工具？' },
      ],
      intent: demoIntent,
      done: true,
      plan: '# 把副业想法问成计划\n\n这是一份演示计划书。',
      spec: '# AI 任务书\n\n这是一份演示任务书。',
    },
    {
      title: '家庭装修',
      history: [
        { role: 'user', text: '我想给爸妈装修老房子。' },
        { role: 'bot', text: '先确认优先级：安全、收纳、舒适度里哪一个最重要？' },
      ],
      intent: {
        ...demoIntent,
        标题: '父母老房改造',
        类型: '生活计划',
      },
      done: false,
    },
  ]);
}

function installIpc() {
  ipcMain.handle('lushu:turn', async (_event, body) => server.handleTurn(body || {}));
  ipcMain.handle('lushu:plan', async (_event, body) => server.handlePlan(body || {}));
  ipcMain.handle('lushu:spec', async (_event, body) => server.handleSpec(body || {}));
  ipcMain.handle('lushu:getModels', async () => server.publicModelConfig());
  ipcMain.handle('lushu:saveModels', async (_event, body) => server.saveModelConfig(body || {}));
  ipcMain.handle('lushu:listWindows', async () => server.listWindows());
  ipcMain.handle('lushu:getWindow', async (_event, windowKey) => ({ window: server.loadWindow(windowKey), index: server.listWindows() }));
  ipcMain.handle('lushu:createWindow', async (_event, body) => server.createChatWindow((body || {}).title));
  ipcMain.handle('lushu:setActiveWindow', async (_event, body) => server.setActiveWindow((body || {}).windowKey));
  ipcMain.handle('lushu:renameWindow', async (_event, body) => server.renameChatWindow((body || {}).windowKey, (body || {}).title));
  ipcMain.handle('lushu:deleteWindow', async (_event, body) => server.deleteChatWindow((body || {}).windowKey));
  ipcMain.handle('lushu:importWindows', async (_event, body) => server.importWindows((body || {}).windows || []));
  ipcMain.handle('lushu:appInfo', async () => server.appInfo());
  ipcMain.handle('lushu:exportWindows', async () => server.exportWindows());
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture(win, fileName) {
  await wait(600);
  const image = await win.capturePage();
  fs.writeFileSync(path.join(repoRoot, 'docs', 'assets', fileName), image.toPNG());
}

async function main() {
  seedDemoData();
  installIpc();

  await app.whenReady();
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    backgroundColor: '#f7f5f0',
    webPreferences: {
      preload: path.join(repoRoot, 'desktop', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadFile(path.join(repoRoot, 'index.html'));
  await win.webContents.executeJavaScript('document.fonts && document.fonts.ready');
  await capture(win, 'main-screen.png');

  await win.webContents.executeJavaScript('openModelView()');
  await capture(win, 'model-settings.png');

  await win.close();
  await app.quit();
}

main().catch((error) => {
  console.error(error);
  app.exit(1);
});
