function installPageLinks(binding, origin) {
  if (location.origin !== origin) return;
  globalThis.__lucasT3LinkCapture?.abort();
  const controller = new AbortController();
  globalThis.__lucasT3LinkCapture = controller;
  function intercept(event) {
    if (event.button !== 0 && event.button !== 1) return;
    const anchor = event.composedPath().find(node => node instanceof Element && node.matches('a[href]'));
    if (!anchor) return;
    let url;
    try { url = new URL(anchor.href, location.href); } catch { return; }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin === origin) return;
    const send = globalThis[binding];
    if (typeof send !== 'function') return;
    send(url.href);
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  for (const type of ['click', 'auxclick']) {
    window.addEventListener(type, intercept, { capture: true, signal: controller.signal });
  }
}
module.exports = { installPageLinks };
