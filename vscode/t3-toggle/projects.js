const { isT3 } = require('./external-links');

function readProjects(vscode, context) {
  const script = require('node:fs').readFileSync(require('node:path').join(context.extensionPath, 'list-projects.py'), 'utf8');
  const authority = vscode.workspace.workspaceFolders?.[0]?.uri.authority;
  const distribution = authority?.toLowerCase().startsWith('wsl+') ? authority.slice(4) : 'Ubuntu';
  return new Promise((resolve, reject) => {
    require('node:child_process').execFile('wsl.exe', ['--distribution', distribution, '--exec', 'python3', '-c', script],
      { timeout: 10000, windowsHide: true, encoding: 'utf8' }, (error, stdout) => {
        if (error) return reject(error);
        try { resolve(JSON.parse(stdout)); } catch (parseError) { reject(parseError); }
      });
  });
}

function registerProjects(vscode, context, { enqueue, showT3, externalLinks }) {
  const { window, workspace, commands, Uri } = vscode;
  const currentFolder = () => workspace.workspaceFolders?.[0]?.uri;
  const currentT3 = () => (isT3(window.activeBrowserTab?.url) ? window.activeBrowserTab : window.browserTabs.find(tab => isT3(tab.url)));

  async function reveal(url) {
    let browser = currentT3();
    if (browser && browser.url !== url) {
      const connection = await externalLinks.ready(browser);
      await connection.client.send('Page.navigate', { url }, connection.sessionId);
    } else if (!browser) {
      browser = await window.openBrowserTab(url);
    }
    await externalLinks.ready(browser);
    await showT3();
  }

  async function show() {
    const projects = await readProjects(vscode, context);
    const selected = await window.showQuickPick(projects.map(project => ({
      label: project.title, description: project.root, project,
      ...(project.root === currentFolder()?.path ? { detail: 'Carpeta actual' } : {})
    })), { title: 'Proyectos de T3', placeHolder: 'Elegí un proyecto para abrir su carpeta en WSL', matchOnDescription: true });
    if (!selected) return;
    const url = currentT3()?.url || 'https://app.t3.codes';
    const folder = currentFolder();
    if (selected.project.root === folder?.path) return reveal(url);
    const authority = folder?.authority?.toLowerCase().startsWith('wsl+') ? folder.authority : 'wsl+Ubuntu';
    const uri = Uri.from({ scheme: 'vscode-remote', authority, path: selected.project.root });
    await context.globalState.update('t3.pendingProject', { root: uri.path, url });
    try { await commands.executeCommand('vscode.openFolder', uri, { forceReuseWindow: true }); }
    catch (error) {
      await context.globalState.update('t3.pendingProject', undefined);
      throw error;
    }
  }

  async function resume() {
    const pending = context.globalState.get('t3.pendingProject');
    if (!pending) return;
    await context.globalState.update('t3.pendingProject', undefined);
    if (pending.root !== currentFolder()?.path || !isT3(pending.url)) return;
    await reveal(pending.url);
  }

  context.subscriptions.push(commands.registerCommand('lucasT3.projects', () => enqueue(show)));
  return { show, resume };
}
module.exports = { registerProjects, readProjects };
