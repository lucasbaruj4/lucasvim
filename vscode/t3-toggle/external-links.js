const path = require('node:path');
const childProcess = require('node:child_process');
const { createCdpClient } = require('./cdp-client');
const { installPageLinks } = require('./external-link-page');
const ORIGIN = 'https://app.t3.codes';
const WORLD = 'lucas-t3-external-links';
const BINDING = '__lucasT3OpenExternal';

function isT3(url) {
  try { return new URL(url).origin === ORIGIN; }
  catch { return false; }
}

async function openInBrave(vscode, url, focus = false) {
  const browser = vscode.workspace.getConfiguration('workbench').inspect('externalBrowser')?.globalValue;
  if (typeof browser !== 'string' || !path.isAbsolute(browser) || !/^brave\.exe$/i.test(path.basename(browser))) {
    throw new Error('Set workbench.externalBrowser to the full path of brave.exe in your user settings.');
  }
  if (focus && process.platform === 'win32' && process.env.SystemRoot) {
    const opened = await openFromWindowsDesktop(browser, url).catch(() => false);
    if (opened) return true;
  }

  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(browser, [url], { detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(true); });
  });
}

function openFromWindowsDesktop(browser, url) {
  // The desktop shell can pass foreground activation to an already running Brave.
  const command = `
$ErrorActionPreference = 'Stop'
$shell = New-Object -ComObject Shell.Application
$windowHandle = 0
$desktop = $shell.Windows().FindWindowSW(0, 0, 8, [ref]$windowHandle, 1)
if (!$desktop) { exit 1 }
$desktop.Document.Application.ShellExecute($env:LUCAS_LINK_BROWSER, $env:LUCAS_LINK_ARGUMENT, '', 'open', 1)
`;
  const powershell = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  // ShellExecute accepts one command line, so quote the URL as a single Windows argument.
  const argument = `"${url.replace(/(\\*)"/g, '$1$1\\"').replace(/\\+$/, '$&$&')}"`;

  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(powershell, ['-NoProfile', '-NonInteractive', '-STA', '-Command', command], {
      env: { ...process.env, LUCAS_LINK_BROWSER: browser, LUCAS_LINK_ARGUMENT: argument },
      windowsHide: true,
      stdio: 'ignore'
    });
    child.once('error', reject);
    child.once('exit', code => resolve(code === 0));
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

function registerTerminalBrowser(vscode, context, openExternal = url => openInBrave(vscode, url, true)) {
  const { window, TabInputTerminal, ExternalUriOpenerPriority } = vscode;
  context.subscriptions.push(window.registerExternalUriOpener('lucasT3.terminalBrowser', {
    canOpenExternalUri(_uri, token) {
      const tab = window.tabGroups.activeTabGroup.activeTab;
      return !token.isCancellationRequested && tab?.input instanceof TabInputTerminal
        ? ExternalUriOpenerPriority.Preferred
        : ExternalUriOpenerPriority.None;
    },
    async openExternalUri(uri, _context, token) {
      if (token.isCancellationRequested || !['http', 'https'].includes(uri.scheme)) return;
      await openExternal(uri.toString(true));
    }
  }, { schemes: ['http', 'https'], label: 'Open terminal links in Brave' }));
}

module.exports = { registerExternalLinks, registerTerminalBrowser, attachT3Links, isT3 };
