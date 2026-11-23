const { test } = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const { registerProjects } = require('./projects');

function fixture(t, list, select, folder) {
  const calls = [];
  t.mock.method(childProcess, 'execFile', (executable, args, options, callback) => {
    calls.push({ executable, args });
    callback(null, JSON.stringify(list));
  });
  const handlers = new Map();
  const vscode = {
    window: {
      showQuickPick(items, options) {
        calls.push({ items, options });
        return items.find(item => item.label === select);
      }
    },
    workspace: { workspaceFolders: folder && [{ uri: folder }] },
    commands: {
      registerCommand(name, handler) { handlers.set(name, handler); },
      executeCommand(...args) { calls.push(args); }
    },
    Uri: { from: fields => fields }
  };
  registerProjects(vscode, { subscriptions: [] }, action => action());
  return { calls, show: handlers.get('lucasCodex.projects') };
}

const projects = [
  { title: 'Learning', root: '/home/lucas/learning' },
  { title: 'Cooking', root: '/home/lucas/Cooking' }
];

test('Codex Projects reads the WSL registry and opens another project in its own window', async t => {
  const { calls, show } = fixture(t, projects, 'Cooking', {
    path: '/home/lucas/learning', authority: 'wsl+Ubuntu-24.04'
  });
  await show();
  assert.deepEqual(calls[0], {
    executable: 'wsl.exe',
    args: ['--distribution', 'Ubuntu-24.04', '--exec', 'sh', '-c', 'cat "$HOME/.config/codex-projects.json"']
  });
  assert.equal(calls[1].options.title, 'Codex Projects');
  assert.deepEqual(calls[1].items.map(item => item.label), ['Cooking', 'Learning']);
  assert.deepEqual(calls[2], [
    'vscode.openFolder',
    { scheme: 'vscode-remote', authority: 'wsl+Ubuntu-24.04', path: '/home/lucas/Cooking' },
    { forceNewWindow: true }
  ]);
});

test('selecting the current project leaves its window open', async t => {
  const { calls, show } = fixture(t, projects, 'Learning', {
    path: '/home/lucas/learning', authority: 'wsl+Ubuntu'
  });
  await show();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].items.find(item => item.label === 'Learning').detail, 'Carpeta actual');
});

test('canceling the picker leaves VS Code in the current window', async t => {
  const { calls, show } = fixture(t, projects);
  await show();
  assert.equal(calls.length, 2);
  assert.equal(calls[0].args[1], 'Ubuntu');
});

test('a malformed project entry reports the file to fix', async t => {
  const { calls, show } = fixture(t, [{ title: 'Cooking', root: './Cooking' }], 'Cooking');
  await assert.rejects(show, /Check ~\/\.config\/codex-projects\.json\./);
  assert.equal(calls.length, 1);
});
