const { posix } = require('node:path');

function sourceNumber(value) {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

async function openFileLink(vscode, request) {
  if (request.path !== '/open-file') return;
  const params = new URLSearchParams(request.query);
  const distro = params.get('distro');
  const file = params.get('path');
  if (!distro || !/^[\w.-]+$/.test(distro) || !file || !posix.isAbsolute(file) || file.startsWith('//') || file.includes('\0')) {
    throw new Error('Expected an absolute file path in a WSL distribution.');
  }

  const { Uri, workspace, commands, Range } = vscode;
  const authority = `wsl+${distro}`;
  const workspaceAuthority = workspace.workspaceFolders?.find(folder =>
    folder.uri.authority.toLowerCase() === authority.toLowerCase())?.uri.authority;
  const uri = Uri.from({ scheme: 'vscode-remote', authority: workspaceAuthority || authority, path: posix.normalize(file) });
  const line = sourceNumber(params.get('line'));
  const column = sourceNumber(params.get('column')) || 1;

  if (workspace.getWorkspaceFolder(uri)) {
    const options = { preview: false };
    if (line) options.selection = new Range(line - 1, column - 1, line - 1, column - 1);
    await commands.executeCommand('vscode.open', uri, options);
    return;
  }

  const folder = uri.with({ path: posix.dirname(uri.path) });
  const target = line ? uri.with({ path: `${uri.path}:${line}:${column}` }) : uri;
  await commands.executeCommand('_files.windowOpen', [{ folderUri: folder }, { fileUri: target }], {
    forceNewWindow: true,
    gotoLineMode: Boolean(line)
  });
}

function registerFileLinks(vscode, context) {
  const { window } = vscode;
  context.subscriptions.push(window.registerUriHandler({
    handleUri(request) {
      return openFileLink(vscode, request).catch(error => window.showErrorMessage(`Codex file link: ${error.message}`));
    }
  }));
}

module.exports = { registerFileLinks, openFileLink };
