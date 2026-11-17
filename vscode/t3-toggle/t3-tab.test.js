const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isT3Tab } = require('./t3-tab');

test('recognizes both T3 page titles and the initial browser host', () => {
  for (const label of ['T3 Code', 'app.t3.codes', 'general / Use VS Code With T3 Code Setup - T3 Code']) {
    assert.equal(isT3Tab({ label }), true);
  }
});

test('does not classify file editors or other browser pages as T3', () => {
  assert.equal(isT3Tab({ label: 'T3 Code', input: { uri: 'file:///T3 Code' } }), false);
  assert.equal(isT3Tab({ label: 'Example Domain' }), false);
  assert.equal(isT3Tab(undefined), false);
});


test('recognizes VS Code truncated titles using the native T3 browser title', () => {
  const title = 'general / Use VS Code With T3 Code Setup - T3 Code';
  const browser = { title, url: 'https://app.t3.codes/env/thread' };
  const tab = { label: title.slice(0, 30) + '…' };
  assert.equal(isT3Tab(tab, [browser]), true);
  assert.equal(isT3Tab(tab, [{ ...browser, url: 'https://example.com' }]), false);
  assert.equal(isT3Tab({ ...tab, input: { uri: 'file:///example' } }, [browser]), false);
});
