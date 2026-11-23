const vscode = require('vscode');
const { registerExternalLinks } = require('./external-links');
const { registerProjects } = require('./projects');
const { isT3Tab } = require('./t3-tab');

function activate(context) {
  const { window, commands } = vscode;
  const isT3 = tab => isT3Tab(tab, window.browserTabs);
  const run = (command, ...args) => commands.executeCommand(command, ...args);
  const tabs = () => window.tabGroups.all.flatMap(group => group.tabs);
  const active = () => window.tabGroups.activeTabGroup.activeTab;
  const key = tab => tab?.input?.uri?.toString() || tab?.label;
  let lastFile;
  let mode = isT3(active()) ? 't3' : 'files';
  let pending = Promise.resolve();
  let busy = false;
  let timer;

  function enqueue(action, label = 'T3 switch') {
    const next = pending.then(async () => {
      busy = true;
      try { await action(); }
      finally { busy = false; }
    });
    pending = next.catch(error => window.showErrorMessage(`${label}: ${error.message}`));
    return pending;
  }

  async function singleGroup() {
    await run('workbench.action.unlockEditorGroup');
    if (window.tabGroups.all.length > 1) {
      await run('workbench.action.editorLayoutSingle');
      await run('workbench.action.unlockEditorGroup');
    }
  }

  async function select(tab) {
    const index = window.tabGroups.activeTabGroup.tabs.indexOf(tab);
    if (index < 0) throw new Error('The requested tab is no longer open.');
    await run('workbench.action.openEditorAtIndex', index);
  }

  async function files() {
    await singleGroup();
    const fileTabs = tabs().filter(tab => !isT3(tab));
    const target = fileTabs.find(tab => key(tab) === lastFile) || fileTabs[0];
    if (target) {
      await select(target);
    } else {
      await run('workbench.action.newGroupLeft');
      await run('workbench.action.focusFirstEditorGroup');
      await run('workbench.action.toggleMaximizeEditorGroup');
    }
    lastFile = key(active());
    mode = 'files';
    await run('workbench.view.explorer');
    await run('workbench.action.focusWindow');
    await run('workbench.action.focusActiveEditorGroup');
  }

  async function t3() {
    if (active() && !isT3(active())) lastFile = key(active());
    await singleGroup();
    const tab = tabs().find(isT3);
    if (tab) await select(tab);
    else await run('workbench.action.browser.open', { url: 'https://app.t3.codes' });
    mode = 't3';
    await run('workbench.action.closePanel');
    await run('workbench.action.maximizeEditorHideSidebar');
  }

  async function cycle(direction) {
    if (!active()) return;
    if (isT3(active())) return files();
    await singleGroup();
    const fileTabs = tabs().filter(tab => !isT3(tab));
    if (!fileTabs.length) return files();
    const index = fileTabs.indexOf(active());
    await select(fileTabs[(index + direction + fileTabs.length) % fileTabs.length]);
    lastFile = key(active());
    await run('workbench.action.focusWindow');
    await run('workbench.action.focusActiveEditorGroup');
  }

  const actions = {
    toggle: () => isT3(active()) ? files() : t3(),
    files,
    nextFile: () => cycle(1),
    previousFile: () => cycle(-1),
    explorer: async () => {
      if (isT3(active())) await files();
      else await run('workbench.action.toggleSidebarVisibility');
    },
    terminal: async () => {
      await singleGroup();
      await run('workbench.action.terminal.new');
      mode = 'files';
      lastFile = key(active());
      await run('workbench.view.explorer');
      await run('workbench.action.focusWindow');
      await run('workbench.action.focusActiveEditorGroup');
    },
    closeFile: async () => {
      if (isT3(active())) return files();
      const closing = active();
      if (!closing) return;
      const others = tabs().filter(tab => !isT3(tab) && tab !== closing);
      if (others.length) await select(others[others.length - 1]);
      const closed = await window.tabGroups.close(closing);
      if (!closed) return;
      if (!others.length) {
        if (tabs().some(isT3)) await files();
        lastFile = undefined;
      } else {
        lastFile = key(active());
      }
    }
  };
  for (const [name, action] of Object.entries(actions)) {
    context.subscriptions.push(commands.registerCommand(`lucasT3.${name}`, () => enqueue(action)));
  }

  function changed() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (busy) return;
      const tab = active();
      if (!tab) return;
      if (isT3(tab)) {
        if (mode !== 't3') enqueue(t3);
      } else {
        lastFile = key(tab);
        if (mode === 't3') enqueue(files);
      }
    }, 60);
  }
  context.subscriptions.push(window.tabGroups.onDidChangeTabs(changed));
  context.subscriptions.push(window.tabGroups.onDidChangeTabGroups(changed));
  context.subscriptions.push({ dispose: () => clearTimeout(timer) });
  const externalLinks = registerExternalLinks(vscode, context);
  registerProjects(vscode, context, enqueue);
  return { externalLinks };
}

module.exports = { activate };
