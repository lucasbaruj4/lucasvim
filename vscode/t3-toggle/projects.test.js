const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerProjects } = require('./projects');

function fixture(pending, browserUrl) {
  const state = new Map(pending ? [['t3.pendingProject', pending]] : []);
  const calls = [];
  const browser = browserUrl ? { url: browserUrl } : undefined;
  const window = {
    browserTabs: browser ? [browser] : [], activeBrowserTab: browser,
    async openBrowserTab(url) { const tab = { url }; window.browserTabs.push(tab); calls.push(['open', url]); return tab; }
  };
  const vscode = { window,
    workspace: { workspaceFolders: [{ uri: { path: '/home/lucas/learning' } }] },
    commands: { registerCommand() { return { dispose() {} }; } }
  };
  const context = { subscriptions: [], globalState: { get: key => state.get(key), update: async (key, value) => state.set(key, value) } };
  const projects = registerProjects(vscode, context, {
    enqueue: fn => fn(), showT3: async () => calls.push(['t3']),
    externalLinks: { ready: async () => ({ sessionId: 'page', client: { send: async (...args) => calls.push(args) } }) }
  });
  return { projects, calls, state };
}

test('folder switch restores the same conversation in an existing T3 tab', async () => {
  const current = 'https://app.t3.codes/env/current-thread';
  const app = fixture({ root: '/home/lucas/learning', url: current, view: 't3' }, 'https://app.t3.codes/env/old-thread');
  await app.projects.resume();
  assert.deepEqual(app.calls, [['Page.navigate', { url: current }, 'page'], ['t3']]);
  assert.equal(app.state.get('t3.pendingProject'), undefined);
});

test('new project folder always reveals T3 even after switching from files', async () => {
  const url = 'https://app.t3.codes/env/current-thread';
  const app = fixture({ root: '/home/lucas/learning', url, view: 'files' });
  await app.projects.resume();
  assert.deepEqual(app.calls, [['open', url], ['t3']]);
});

test('unrelated folders and external URLs cannot trigger automatic navigation', async () => {
  for (const pending of [
    { root: '/somewhere/else', url: 'https://app.t3.codes/thread' },
    { root: '/home/lucas/learning', url: 'https://evil.test' }
  ]) {
    const app = fixture(pending);
    await app.projects.resume();
    assert.deepEqual(app.calls, []);
  }
});
