// label-worker: печать этикетки по сообщению из очереди labels (контракт - docs/messages.md).
export function processJob(msg, ctx = {}) {
  const lines = [
    `Отправление ${msg.id}, трек ${msg.tracking}`,
    `Индекс ${msg.postcode}, зона ${msg.zone}`,
    `Вес: ${(msg.weightGrams / 1000).toFixed(1)} кг`,
  ];
  if (msg.express) lines.push('ЭКСПРЕСС');
  if (msg.note) lines.push(`Комментарий: ${msg.note}`);
  if (msg.insured) lines.push(`Страховка: ${msg.insuredAmount.toFixed(2)} EUR`); // docs/messages.md
  ctx.log?.info('label printed', { id: msg.id });
  return lines.join('\n');
}
