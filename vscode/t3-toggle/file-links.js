const { posix } = require('node:path');

const locationSuffix = /:(\d+)(?::(\d+))?(?:-\d+(?::\d+)?)?$|#L(\d+)(?:C(\d+))?(?:-L\d+(?:C\d+)?)?$/;

function sourceNumber(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

function isWsl(uri) {
  return uri?.scheme === 'vscode-remote' && uri.authority.toLowerCase().startsWith('wsl+');
}

async function provideFileLinks(vscode, { line: text, terminal }, token) {
  const folders = (vscode.workspace.workspaceFolders ?? []).filter(({ uri }) => isWsl(uri));
  const folder = folders[0]?.uri;
  const shellCwd = terminal.shellIntegration?.cwd;
  let cwd = [shellCwd, terminal.creationOptions.cwd].find(isWsl);
  // The Windows extension host receives the WSL shell's working directory as a file URI.
  if (!cwd && folder && shellCwd?.scheme === 'file' && !shellCwd.authority &&
      shellCwd.path.startsWith('/') && !/^\/[a-z]:/i.test(shellCwd.path)) {
    cwd = folder.with({ path: shellCwd.path });
  }
  const base = cwd ?? folder;
  if (!base || token.isCancellationRequested) return [];

  // Codex's inline transcript prints a path directly or after its label in parentheses.
  const candidates = [...text.matchAll(/\(((?:[^()\n]|\([^()\n]*\))+)\)|[^\s()[\]<>`"',;]+/gu)];
  const links = await Promise.all(candidates.map(async (match, index) => {
    const target = match[1] ?? match[0];
    const location = target.match(locationSuffix);
    const file = location ? target.slice(0, location.index) : target;
    if (!file || (!/[/.]/.test(file) && !location && !match[1])) return;
    if (/^(?:[\w+.-]+:|\/\/|~)/.test(file) || /[\u0000-\u001f\u007f]/.test(file)) return;
    if (!posix.isAbsolute(file) && !cwd && folders.length !== 1) return;

    const uri = base.with({ path: posix.resolve(base.path, file), query: '', fragment: '' });
    try {
      const { type } = await vscode.workspace.fs.stat(uri);
      if (!(type & vscode.FileType.File)) return;
    } catch {
      return;
    }
    const label = candidates[index - 1];
    const hasFilenameLabel = match[1] && label && !label[1] &&
      /^\s+$/.test(text.slice(label.index + label[0].length, match.index)) &&
      !/^[\w+.-]+:\//.test(label[0]) &&
      posix.basename(label[0].replace(locationSuffix, '')) === posix.basename(file);
    const targetStart = match.index + (match[1] ? 1 : 0);
    const startIndex = hasFilenameLabel ? label.index : targetStart;
    return {
      startIndex,
      length: targetStart + target.length - startIndex,
      tooltip: 'Open in VS Code',
      uri,
      line: sourceNumber(location?.[1] ?? location?.[3]),
      column: sourceNumber(location?.[2] ?? location?.[4]) ?? 1
    };
  }));
  if (token.isCancellationRequested) return [];
  const resolved = links.filter(Boolean);
  // If the label resolves on its own, prefer the explicit destination that follows it.
  return resolved.filter((link, index) => resolved[index + 1]?.startIndex !== link.startIndex);
}

async function openFileLink(vscode, { uri, line, column }) {
  const { workspace, commands, Range } = vscode;
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
  context.subscriptions.push(window.registerTerminalLinkProvider({
    provideTerminalLinks(linkContext, token) {
      return provideFileLinks(vscode, linkContext, token);
    },
    handleTerminalLink(link) {
      return openFileLink(vscode, link).catch(error => window.showErrorMessage(`Terminal file link: ${error.message}`));
    }
  }));
}

module.exports = { registerFileLinks };
