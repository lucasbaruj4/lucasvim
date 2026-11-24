const assert = require('node:assert/strict');
const { test } = require('node:test');
const { trackCodexTerminalLinks } = require('./codex-terminal-links');

test('Codex owns clicks only while its terminal reports mouse input', () => {
  let write;
  let end;
  const terminal = {};
  const other = {};
  const ownsLinks = trackCodexTerminalLinks({
    window: {
      onDidWriteTerminalData(listener) { write = listener; return { dispose() {} }; },
      onDidEndTerminalShellExecution(listener) { end = listener; return { dispose() {} }; }
    }
  }, { subscriptions: [] });
  const emit = data => write({ terminal, data });

  emit('\x1b[?1003h');
  assert.equal(ownsLinks(terminal), false);
  emit('\x1b]7501;state=working:app=cod');
  emit('ex\x1b');
  emit('\\');
  assert.equal(ownsLinks(terminal), true);
  assert.equal(ownsLinks(other), false);

  emit('\x1b[?1003');
  emit('l');
  assert.equal(ownsLinks(terminal), false);
  emit('\x1b[?1002;1006h');
  assert.equal(ownsLinks(terminal), true);
  emit('\x1b]7501;state=clear\x1b\\');
  assert.equal(ownsLinks(terminal), false);

  emit('\x1b]7501;state=idle:app=codex\x07');
  assert.equal(ownsLinks(terminal), true);
  end({ terminal });
  assert.equal(ownsLinks(terminal), false);
});
