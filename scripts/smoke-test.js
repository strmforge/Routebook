const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lushu-smoke-'));
process.env.LUSHU_CONFIG_DIR = tempDir;

const server = require('../server');

function createFakeBrain() {
  const requests = [];
  const srv = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      requests.push({ headers: req.headers, body: parsed });
      let content;
      if (String(parsed.messages?.[0]?.content || '').includes('计划书 Markdown')) {
        content = '# 测试计划\n\n## 这是什么\n\n这是一个冒烟测试。';
      } else if (String(parsed.messages?.[0]?.content || '').includes('任务书 Markdown')) {
        content = '# 测试任务书\n\n- 可以交给 AI 编程工具。';
      } else {
        content = '<think>{"noise":true}</think>\n' + JSON.stringify({
          say: '我先确认一下，你想做的是一个喝水记录工具，对吗？',
          intent: {
            标题: '喝水记录工具',
            类型: '软件工具',
            目标: [{ 内容: '记录每天喝水次数', 状态: '已确认' }],
            成功标准: [{ 内容: '能看到当天喝水次数', 状态: '推测' }],
            约束: [],
            资源: [],
            风险: [],
            依赖: [],
            非目标: [],
          },
          done: true,
        });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        choices: [{ message: { content } }],
      }));
    });
  });

  return new Promise(resolve => {
    srv.listen(0, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${srv.address().port}/v1`,
        close: () => new Promise(done => srv.close(done)),
        requests,
      });
    });
  });
}

async function main() {
  const fakeBrain = await createFakeBrain();
  try {
    const saved = server.saveModelConfig({
      activeId: 'fake-ollama',
      profiles: [{
        id: 'fake-ollama',
        name: 'Fake Ollama',
        provider: 'openai-compatible',
        baseUrl: fakeBrain.url,
        model: 'fake-model',
        apiKey: '',
      }],
    });
    assert.equal(saved.activeId, 'fake-ollama');
    assert.equal(saved.profiles[0].hasApiKey, false);

    const info = server.appInfo();
    assert.equal(info.version, '0.1.0');
    assert.ok(info.configDir.includes(tempDir));
    assert.ok(info.windowsDir.includes(tempDir));

    const firstIndex = server.listWindows();
    assert.equal(firstIndex.windows.length, 1);
    const firstKey = firstIndex.activeWindowKey;
    assert.throws(() => server.loadWindow(''), /窗口|路由/);

    const second = server.createChatWindow('第二个项目').window;
    assert.notEqual(second.windowKey, firstKey);

    const turn = await server.handleTurn({
      windowKey: second.windowKey,
      language: 'zh',
      message: '我想做一个记录喝水次数的小工具',
    });
    assert.equal(turn.window.windowKey, second.windowKey);
    assert.equal(turn.window.history.filter(m => m.role === 'user').length, 1);
    assert.equal(turn.intent.标题, '喝水记录工具');
    assert.equal(fakeBrain.requests[0].headers.authorization, undefined);
    assert.equal(fakeBrain.requests[0].body.max_tokens, 4096);

    const first = server.loadWindow(firstKey);
    assert.equal(first.history.length, 0);

    const plan = await server.handlePlan({ windowKey: second.windowKey, language: 'zh' });
    assert.ok(plan.markdown.includes('测试计划'));

    const spec = await server.handleSpec({ windowKey: second.windowKey, language: 'zh' });
    assert.ok(spec.markdown.includes('测试任务书'));

    const renamed = server.renameChatWindow(second.windowKey, '喝水工具').window;
    assert.equal(renamed.title, '喝水工具');

    const backup = server.exportWindows();
    assert.ok(Array.isArray(backup.windows));
    assert.ok(backup.windows.some(w => w.windowKey === second.windowKey));
    assert.equal(JSON.stringify(backup).includes('apiKey'), false);

    const third = server.importWindows([renamed]);
    assert.equal(third.imported, 1);
    assert.notEqual(third.window.windowKey, renamed.windowKey);

    const afterDelete = server.deleteChatWindow(second.windowKey);
    assert.ok(afterDelete.index.windows.length >= 2);
    assert.throws(() => server.loadWindow(second.windowKey), /不存在|路由/);

    await assert.rejects(() => server.handleTurn({ message: '没有窗口' }), /窗口|路由/);
    console.log('smoke ok');
  } finally {
    await fakeBrain.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
