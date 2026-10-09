// Контекст handle для тестов: очередь копит сообщения, хранилище - Map.
export function makeCtx(over = {}) {
  const messages = [];
  return {
    config: {},
    flags: {},
    now: '2026-09-01T10:00:00Z',
    log: { info() {}, warn() {}, error() {} },
    store: new Map(),
    queue: { messages, publish: (topic, msg) => messages.push({ topic, msg }) },
    ...over,
  };
}
