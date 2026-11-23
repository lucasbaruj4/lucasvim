const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openFileLink } = require('./file-links');

function fixture() {
  const calls = [];
  const vscode = {
    Uri: { from: fields => ({ ...fields, with: updates => ({ ...fields, ...updates }) }) },
    workspace: {
      workspaceFolders: [{ uri: { authority: 'wsl+Ubuntu' } }],
      getWorkspaceFolder: uri => uri.authority === 'wsl+Ubuntu' && uri.path.startsWith('/work/project/')
    },
    commands: { executeCommand(...args) { calls.push(args); } },
    Range: class { constructor(...coordinates) { this.coordinates = coordinates; } }
  };
  function open(path) {
    const request = { distro: 'ubuntu', path, line: '12', column: '3' };
    return openFileLink(vscode, { path: '/open-file', query: Buffer.from(JSON.stringify(request)).toString('base64url') });
  }
  return { calls, open };
}

test('opens a file in the current workspace at the requested line and column', async () => {
  const { calls, open } = fixture();
  await open('/work/project/src/a & b.js');
  assert.equal(calls[0][0], 'vscode.open');
  assert.equal(calls[0][1].path, '/work/project/src/a & b.js');
  assert.deepEqual(calls[0][2].selection.coordinates, [11, 2, 11, 2]);
});

test('opens the parent folder and file together in a new window', async () => {
  const { calls, open } = fixture();
  await open('/work/project-other/src/test.js');
  const [command, [folder, file], options] = calls[0];
  assert.equal(command, '_files.windowOpen');
  assert.equal(folder.folderUri.path, '/work/project-other/src');
  assert.equal(file.fileUri.path, '/work/project-other/src/test.js:12:3');
  assert.deepEqual(options, { forceNewWindow: true, gotoLineMode: true });
});
