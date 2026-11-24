const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerFileLinks } = require('./file-links');

function fixture() {
  const calls = [];
  const files = new Set(['/work/project/src/a & b (draft).js', '/work/project-other/src/test.js', '/work/project/Makefile', '/work/project/test.js']);
  const uri = path => ({ scheme: 'file', authority: '', path, with: updates => uri(updates.path) });
  let provider;
  const vscode = {
    FileType: { File: 1 },
    window: {
      registerTerminalLinkProvider(value) { provider = value; },
      showErrorMessage(message) { assert.fail(message); }
    },
    workspace: {
      workspaceFolders: [{ uri: uri('/work/project') }],
      getWorkspaceFolder: resource => resource.path.startsWith('/work/project/'),
      fs: { async stat(resource) {
        if (files.has(resource.path)) return { type: 1 };
        if (resource.path === '/work/project/src') return { type: 2 };
        throw new Error('File not found');
      } }
    },
    commands: { executeCommand(...args) { calls.push(args); } },
    Range: class { constructor(...coordinates) { this.coordinates = coordinates; } }
  };
  registerFileLinks(vscode, { subscriptions: [] });
  async function detect(line, cwd = '/work/project') {
    const shellIntegration = cwd ? { cwd: uri(cwd) } : undefined;
    const terminal = { shellIntegration, creationOptions: {} };
    return provider.provideTerminalLinks({ line, terminal }, { isCancellationRequested: false });
  }
  async function click(line, cwd) {
    const links = await detect(line, cwd);
    assert.equal(links.length, 1);
    const [link] = links;
    await provider.handleTerminalLink(link);
    return line.slice(link.startIndex, link.startIndex + link.length);
  }
  return { calls, click, detect };
}

test('opens a file in the current workspace at the requested line and column', async () => {
  const { calls, click } = fixture();
  assert.equal(await click('File (src/a & b (draft).js:12:3)'), 'src/a & b (draft).js:12:3');
  assert.equal(calls[0][0], 'vscode.open');
  assert.equal(calls[0][1].path, '/work/project/src/a & b (draft).js');
  assert.deepEqual(calls[0][2].selection.coordinates, [11, 2, 11, 2]);
});

test('opens the parent folder and file together in a new window', async () => {
  const { calls, click } = fixture();
  assert.equal(await click('/work/project-other/src/test.js:12:3'), '/work/project-other/src/test.js:12:3');
  const [command, [folder, file], options] = calls[0];
  assert.equal(command, '_files.windowOpen');
  assert.equal(folder.folderUri.path, '/work/project-other/src');
  assert.equal(file.fileUri.path, '/work/project-other/src/test.js:12:3');
  assert.deepEqual(options, { forceNewWindow: true, gotoLineMode: true });
});

test('ignores URLs, directories, and missing files and resolves relative paths from the terminal', async () => {
  const { detect } = fixture();
  const links = await detect('https://example.com/file.js (missing.js:1) (.) (../Makefile#L8C2)', '/work/project/src');
  assert.deepEqual(links.map(({ uri, line, column }) => [uri.path, line, column]), [['/work/project/Makefile', 8, 2]]);
});

test('opens a workspace-relative path while the terminal has no working directory', async () => {
  const { calls, click } = fixture();
  await click('Guide (Makefile:8:2)', null);
  assert.equal(calls[0][0], 'vscode.open');
  assert.equal(calls[0][1].path, '/work/project/Makefile');
});

test('uses the full path and location when the visible filename is clicked', async () => {
  const { calls, click } = fixture();
  const selected = await click('See test.js (/work/project-other/src/test.js:12:3) for details.');
  assert.ok(selected.startsWith('test.js'));
  assert.equal(calls[0][0], '_files.windowOpen');
  assert.equal(calls[0][1][1].fileUri.path, '/work/project-other/src/test.js:12:3');
});
