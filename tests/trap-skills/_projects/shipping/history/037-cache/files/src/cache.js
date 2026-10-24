// Кэш котировок за флагом quote_cache: повторная котировка той же посылки - из памяти, без расчёта.
// Флаги приходят в ctx.flags (на стенде - из конфигурации флагов), по умолчанию выключены.
const cache = new Map();

export function cachedQuote(body, ctx, compute) {
  if (!ctx.flags?.quote_cache) return compute();
  const key = JSON.stringify([body.weight, body.postcode]);
  if (!cache.has(key)) cache.set(key, compute());
  return cache.get(key);
}

export function cacheSize() {
  return cache.size;
}
