// label-worker: печать этикетки по сообщению из очереди labels (контракт - docs/messages.md).
export function processJob(msg, ctx = {}) {
  const lines = [
    `Отправление ${msg.id}, трек ${msg.tracking}`,
    `Индекс ${msg.postcode}`,
    `Зона ${msg.zone}`,
    `Вес: ${(msg.weightGrams / 1000).toFixed(1)} кг`,
  ];
  if (msg.express) lines.push('ЭКСПРЕСС');
  ctx.log?.info('label printed', { id: msg.id });
  return lines.join('\n');
}
