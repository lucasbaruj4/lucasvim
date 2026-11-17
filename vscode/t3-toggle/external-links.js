const { createCdpClient } = require('./cdp-client');
const { installPageLinks } = require('./external-link-page');
const ORIGIN = 'https://app.t3.codes';
const WORLD = 'lucas-t3-external-links';
const BINDING = '__lucasT3OpenExternal';

function isT3(url) {
  try { return new URL(url).origin === ORIGIN; }
  catch { return false; }
}

function openInBrave(vscode, url) {
  const browser = vscode.workspace.getConfiguration('workbench').inspect('externalBrowser')?.globalValue;
  const path = require('node:path');
  if (typeof browser !== 'string' || !path.isAbsolute(browser) || !/^brave\.exe$/i.test(path.basename(browser))) {
    return Promise.reject(new Error('Set workbench.externalBrowser to the full path of brave.exe in your user settings.'));
  }
  return new Promise((resolve, reject) => {
    const child = require('node:child_process').spawn(browser, [url], { detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(true); });
  });
}

async function attachT3Links(tab, openExternal, reportError) {
  const client = createCdpClient(await tab.startCDPSession());
  try {
    const { targetInfos } = await client.send('Target.getTargets');
    const target = targetInfos.find(info => info.type === 'page' && isT3(info.url)) || targetInfos.find(info => info.type === 'page');
    if (!target) throw new Error('The T3 browser page was not found.');
    const { sessionId } = await client.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    const receive = client.onEvent(message => {
      if (message.sessionId !== sessionId || message.method !== 'Runtime.bindingCalled' || message.params.name !== BINDING || !isT3(tab.url)) return;
      let url;
      try { url = new URL(message.params.payload); } catch { return; }
      if (!['http:', 'https:'].includes(url.protocol) || isT3(url.href)) return;
      Promise.resolve().then(() => openExternal(url.href)).catch(reportError);
    });
    await client.send('Runtime.enable', {}, sessionId);
    await client.send('Page.enable', {}, sessionId);
    await client.send('Runtime.addBinding', { name: BINDING, executionContextName: WORLD }, sessionId);
    const source = `(${installPageLinks.toString()})(${JSON.stringify(BINDING)},${JSON.stringify(ORIGIN)})`;
    const { identifier } = await client.send('Page.addScriptToEvaluateOnNewDocument', { source, worldName: WORLD }, sessionId);
    const { frameTree } = await client.send('Page.getFrameTree', {}, sessionId);
    const { executionContextId } = await client.send('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: WORLD }, sessionId);
    const installed = await client.send('Runtime.evaluate', { expression: source, contextId: executionContextId }, sessionId);
    if (installed.exceptionDetails) throw new Error(installed.exceptionDetails.text);
    return {
      client, sessionId,
      async dispose() {
        receive.dispose();
        await client.send('Runtime.evaluate', { expression: 'globalThis.__lucasT3LinkCapture?.abort()', contextId: executionContextId }, sessionId).catch(() => {});
        await client.send('Page.removeScriptToEvaluateOnNewDocument', { identifier }, sessionId).catch(() => {});
        await client.send('Runtime.removeBinding', { name: BINDING }, sessionId).catch(() => {});
        await client.close();
      }
    };
  } catch (error) {
    await client.close();
    throw error;
  }
}

function registerExternalLinks(vscode, context, openExternal = url => openInBrave(vscode, url)) {
  const { window } = vscode;
  const connections = new Map();
  const reportError = error => window.showErrorMessage(`T3 links: ${error.message}`);
  function ensure(tab) {
    if (!isT3(tab.url)) return;
    if (!connections.has(tab)) {
      const promise = attachT3Links(tab, openExternal, reportError);
      connections.set(tab, promise);
      promise.catch(error => { connections.delete(tab); reportError(error); });
    }
    return connections.get(tab);
  }
  function forget(tab) {
    const promise = connections.get(tab);
    connections.delete(tab);
    promise?.then(connection => connection.dispose()).catch(() => {});
  }
  try {
    for (const tab of window.browserTabs) ensure(tab);
    context.subscriptions.push(window.onDidOpenBrowserTab(ensure));
    context.subscriptions.push(window.onDidChangeBrowserTabState(ensure));
    context.subscriptions.push(window.onDidCloseBrowserTab(forget));
    context.subscriptions.push({ dispose() { for (const tab of connections.keys()) forget(tab); } });
  } catch (error) { reportError(error); }
  return { ready: ensure };
}

module.exports = { registerExternalLinks, attachT3Links, isT3 };
