function createCdpClient(session) {
  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  const receiver = session.onDidReceiveMessage(message => {
    if (message.id !== undefined) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    } else {
      for (const listener of listeners) listener(message);
    }
  });
  function rejectPending() {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error('The browser connection closed.'));
    }
    pending.clear();
  }
  const closed = session.onDidClose(rejectPending);
  return {
    send(method, params = {}, sessionId) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Browser command timed out: ${method}`));
        }, 5000);
        pending.set(id, { resolve, reject, timer });
        session.sendMessage({ id, method, params, ...(sessionId ? { sessionId } : {}) }).catch(error => {
          clearTimeout(timer);
          pending.delete(id);
          reject(error);
        });
      });
    },
    onEvent(listener) {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
    async close() {
      receiver.dispose();
      closed.dispose();
      listeners.clear();
      rejectPending();
      await session.close();
    }
  };
}
module.exports = { createCdpClient };
