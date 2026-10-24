const queues = new Map();

export function enqueue(name, payload) {
  if (!queues.has(name)) queues.set(name, []);
  queues.get(name).push({ payload, enqueuedAt: new Date().toISOString() });
}

export function drain(name) {
  const items = queues.get(name) ?? [];
  queues.set(name, []);
  return items;
}
