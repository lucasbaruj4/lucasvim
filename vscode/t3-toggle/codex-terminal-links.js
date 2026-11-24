const controls = /\x1b(?:\[\?([\d;]+)([hl])|\]7501;([^\x07\x1b]*)(?:\x07|\x1b\\))|\x1b(?:\[[\x20-\x3f]*|\][^\x07\x1b]*\x1b?)?$/g;
const mouseModes = new Set(['9', '1000', '1002', '1003']);

function trackCodexTerminalLinks(vscode, context) {
  const states = new WeakMap();
  const { window } = vscode;
  context.subscriptions.push(window.onDidWriteTerminalData(({ terminal, data }) => {
    const state = states.get(terminal) ?? { pending: '', codex: false, mouse: undefined };
    if (!state.pending && !data.includes('\x1b')) return;
    const input = state.pending + data;
    state.pending = '';
    for (const [sequence, modes, change, status] of input.matchAll(controls)) {
      if (status !== undefined) {
        state.codex = status.split(':').includes('app=codex');
      } else if (modes) {
        for (const mode of modes.split(';')) {
          if (!mouseModes.has(mode)) continue;
          if (change === 'h') state.mouse = mode;
          else if (state.mouse === mode) state.mouse = undefined;
        }
      } else if (sequence.length <= 256) {
        state.pending = sequence;
      }
    }
    states.set(terminal, state);
  }));
  context.subscriptions.push(window.onDidEndTerminalShellExecution(({ terminal }) => states.delete(terminal)));
  return terminal => {
    const state = terminal && states.get(terminal);
    return Boolean(state?.codex && state.mouse);
  };
}

module.exports = { trackCodexTerminalLinks };
