const childProcess = require('node:child_process');
const { posix } = require('node:path');

const registry = '~/.config/codex-projects.json';

function readProjects(distribution) {
  return new Promise((resolve, reject) => {
    childProcess.execFile('wsl.exe', [
      '--distribution', distribution, '--exec', 'sh', '-c',
      'cat "$HOME/.config/codex-projects.json"'
    ], { timeout: 10000, windowsHide: true, encoding: 'utf8' }, (error, stdout) => {
      if (error) return reject(new Error(`Could not read ${registry} in WSL (${distribution}).`, { cause: error }));
      try {
        const projects = JSON.parse(stdout);
        if (!Array.isArray(projects) || projects.some(project =>
          typeof project?.title !== 'string' || !project.title.trim() ||
          typeof project.root !== 'string' || !posix.isAbsolute(project.root)
        )) {
          throw new Error('Expected a list of project titles and absolute WSL paths.');
        }
        resolve(projects.sort((left, right) => left.title.localeCompare(right.title)));
      } catch (error) {
        reject(new Error(`Check ${registry}. ${error.message}`, { cause: error }));
      }
    });
  });
}

function registerProjects(vscode, context, enqueue) {
  const { window, workspace, commands, Uri } = vscode;

  async function show() {
    const folder = workspace.workspaceFolders?.[0]?.uri;
    const authority = folder?.authority?.toLowerCase().startsWith('wsl+') ? folder.authority : 'wsl+Ubuntu';
    const projects = await readProjects(authority.slice(4));
    const selected = await window.showQuickPick(projects.map(({ title, root }) => ({
      label: title, description: root,
      ...(root === folder?.path ? { detail: 'Carpeta actual' } : {})
    })), { title: 'Codex Projects', placeHolder: 'Elegí un proyecto para abrir su carpeta en WSL', matchOnDescription: true });
    if (!selected || (selected.description === folder?.path && authority === folder.authority)) return;
    const uri = Uri.from({ scheme: 'vscode-remote', authority, path: selected.description });
    await commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
  }

  context.subscriptions.push(commands.registerCommand('lucasCodex.projects', () => enqueue(show, 'Codex Projects')));
}

module.exports = { registerProjects };
