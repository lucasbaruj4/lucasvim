const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { installPageLinks } = require('./external-link-page');
const { attachT3Links, isT3, registerTerminalBrowser } = require('./external-links');

function fixture() {
  const handlers = new Map();
  const sent = [];
  class Element {
    constructor(href) { this.href = href; }
    matches(selector) { return selector === 'a[href]'; }
  }
  const page = { location: { origin: 'https://app.t3.codes', href: 'https://app.t3.codes/project/thread' },
    AbortController, Element, URL,
    window: { addEventListener: (type, handler) => handlers.set(type, handler) },
    bridge: url => sent.push(url)
  };
  vm.createContext(page);
  vm.runInContext(`(${installPageLinks.toString()})('bridge','https://app.t3.codes')`, page);
  function click(href, type = 'click', button = 0) {
    const event = { button, prevented: false, stopped: false,
      composedPath: () => [new Element(href)],
      preventDefault() { this.prevented = true; },
      stopImmediatePropagation() { this.stopped = true; }
    };
    handlers.get(type)(event);
    return event;
  }
  return { page, sent, click };
}

test('external click is stopped before a browser tab can open', () => {
  const app = fixture();
  const click = app.click('https://example.com/a?b=1#c');
  assert.equal(click.prevented, true);
  assert.equal(click.stopped, true);
  assert.deepEqual(app.sent, ['https://example.com/a?b=1#c']);
});

test('middle click also opens externally without creating an internal tab', () => {
  const app = fixture();
  assert.equal(app.click('https://example.com', 'auxclick', 1).prevented, true);
  assert.deepEqual(app.sent, ['https://example.com/']);
});

test('T3 navigation and non-web links keep their normal behavior', () => {
  const app = fixture();
  for (const url of ['https://app.t3.codes/other/thread', 'mailto:user@example.com', 'vscode://file/path']) {
    assert.equal(app.click(url).prevented, false);
  }
  assert.deepEqual(app.sent, []);
});

test('a disconnected bridge does not block links', () => {
  const app = fixture();
  delete app.page.bridge;
  assert.equal(app.click('https://example.com').prevented, false);
});

test('only the exact T3 origin is allowed', () => {
  assert.equal(isT3('https://app.t3.codes/project'), true);
  for (const url of ['https://app.t3.codes.evil.test', 'http://app.t3.codes', 'invalid']) assert.equal(isT3(url), false);
});

test('native CDP binding handles external URLs without closing or opening browser tabs', async () => {
  const calls = [];
  const listeners = new Set();
  const sent = [];
  const session = {
    onDidReceiveMessage(listener) { listeners.add(listener); return { dispose: () => listeners.delete(listener) }; },
    onDidClose() { return { dispose() {} }; },
    async sendMessage(message) {
      calls.push(message);
      const results = {
        'Target.getTargets': { targetInfos: [{ type: 'page', targetId: 't3', url: 'https://app.t3.codes/thread' }] },
        'Target.attachToTarget': { sessionId: 'page' },
        'Page.addScriptToEvaluateOnNewDocument': { identifier: 'script' },
        'Page.getFrameTree': { frameTree: { frame: { id: 'root' } } },
        'Page.createIsolatedWorld': { executionContextId: 5 }
      };
      queueMicrotask(() => listeners.forEach(listener => listener({ id: message.id, result: results[message.method] || {} })));
    },
    async close() {}
  };
  const tab = { url: 'https://app.t3.codes/thread', startCDPSession: async () => session };
  const connection = await attachT3Links(tab, async url => sent.push(url), error => { throw error; });
  assert.ok(calls.some(call => call.method === 'Runtime.addBinding' && call.params.executionContextName === 'lucas-t3-external-links'));
  const binding = payload => listeners.forEach(listener => listener({ method: 'Runtime.bindingCalled', sessionId: 'page', params: { name: '__lucasT3OpenExternal', payload } }));
  binding('https://example.com');
  binding('file:///secret');
  binding('https://app.t3.codes/other');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(sent, ['https://example.com/']);
  assert.equal(calls.some(call => /closeTarget|createTarget|navigate/i.test(call.method)), false);
  await connection.dispose();
});

test('a terminal editor tab routes HTTP and HTTPS links directly to Brave', async () => {
  class TabInputTerminal {}
  const group = { activeTab: { input: new TabInputTerminal() } };
  const priority = { None: 0, Preferred: 3 };
  const browserCalls = [];
  let opener;
  registerTerminalBrowser({
    TabInputTerminal,
    ExternalUriOpenerPriority: priority,
    window: {
      tabGroups: { activeTabGroup: group },
      registerExternalUriOpener(_id, provider, { schemes }) {
        assert.deepEqual(schemes, ['http', 'https']);
        opener = provider;
      }
    }
  }, { subscriptions: [] }, { openExternal: async url => browserCalls.push(url) });

  const token = { isCancellationRequested: false };
  const url = 'https://example.com/job?source=terminal&position=7#apply';
  const uri = { scheme: 'https', toString: () => url };
  assert.equal(opener.canOpenExternalUri(uri, token), priority.Preferred);
  await opener.openExternalUri(uri, {}, token);
  await opener.openExternalUri({ scheme: 'file' }, {}, token);
  group.activeTab = { input: {} };
  assert.equal(opener.canOpenExternalUri(uri, token), priority.None);
  assert.deepEqual(browserCalls, [url]);
});
