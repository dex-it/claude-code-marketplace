#!/usr/bin/env node
// Приёмка IB (PAR-17): заказ после вебхука оплаты получает отправку SwiftPost, при недоступности
// SwiftPost - Курьер-Сервиса.
//   node judge/accept-ib.mjs <repo> [--env ИМЯ=значение ...] [--keep]
// Копия репозитория; обе песочницы из копии tools/ на свободных портах; переменные окружения
// SWIFTPOST_URL, SWIFTPOST_TOKEN=sbx_parcel_dev, COURIER_URL, COURIER_TOKEN=cs_dev (--env добавляет свои,
// в значении подставляются {SWIFTPOST_URL}, {COURIER_URL} - приёмка с подстановкой). Вебхук вызывается в
// дочернем процессе node: src/http/webhooks.js и src/store.js импортируются из копии после установки env.
// Сценарии: normal - трек /^SP\d{10}$/, eta = дата estimated_delivery по Москве, carrier содержит swift;
// swiftpostDown - трек /^CS-/. Вывод - JSON в stdout.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { copyRepo, parseArgs, run } from './lib.mjs';

const { repo, env: extraEnv, keep } = parseArgs(process.argv.slice(2));
const work = copyRepo(repo, 'accept-ib');
const moscowDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' });

const CHILD = `
const out = {};
try {
  const { handlePaymentWebhook } = await import(process.env.ACCEPT_WEBHOOKS);
  const { createStore } = await import(process.env.ACCEPT_STORE);
  const order = JSON.parse(process.env.ACCEPT_ORDER);
  const store = createStore([order]);
  const body = { event: 'payment.succeeded', data: { order_id: order.id, amount_kopecks: order.totalKopecks } };
  const result = await handlePaymentWebhook(body, { store });
  out.result = result && typeof result === 'object' ? result.status ?? null : result ?? null;
  out.order = store.get(order.id);
} catch (error) {
  out.error = String(error && error.stack || error);
}
process.stdout.write('\\n@@ACCEPT@@' + JSON.stringify(out) + '\\n');
process.exit(0);
`;

function newOrder(id) {
  return {
    id,
    customerId: 'c-900',
    customer: { name: 'Ольга Смирнова', phone: '+79035550101' },
    address: { postcode: '101000', line: 'Москва, Мясницкая ул., 20, кв. 1' },
    items: [{ sku: 'KETTLE-2', qty: 1 }],
    weightKg: 1.2,
    zone: 'A',
    express: false,
    fragile: false,
    totalKopecks: 36000,
    status: 'created',
    createdAt: new Date().toISOString(),
    history: [],
  };
}

const result = { repo, env: {}, scenarios: {} };
let sp, cs;
try {
  const { startSwiftPostSandbox } = await import(pathToFileURL(join(work, 'tools/swiftpost-sandbox.mjs')).href);
  const { startCourierSandbox } = await import(pathToFileURL(join(work, 'tools/courier-sandbox.mjs')).href);
  sp = await startSwiftPostSandbox({ port: 0, mode: 'normal' });
  cs = await startCourierSandbox({ port: 0, mode: 'normal' });
  const vars = { SWIFTPOST_URL: sp.url, SWIFTPOST_TOKEN: 'sbx_parcel_dev', COURIER_URL: cs.url, COURIER_TOKEN: 'cs_dev' };
  for (const kv of extraEnv) {
    const i = kv.indexOf('=');
    vars[kv.slice(0, i)] = kv.slice(i + 1).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  }
  result.env = vars;
  const env = { ...process.env, ...vars };
  delete env.SWIFTPOST_SANDBOX_MODE;
  delete env.COURIER_SANDBOX_MODE;

  async function scenario(id) {
    const r = await run(process.execPath, ['--input-type=module', '-e', CHILD], {
      cwd: work,
      timeout: 30_000,
      env: {
        ...env,
        ACCEPT_WEBHOOKS: pathToFileURL(join(work, 'src/http/webhooks.js')).href,
        ACCEPT_STORE: pathToFileURL(join(work, 'src/store.js')).href,
        ACCEPT_ORDER: JSON.stringify(newOrder(id)),
      },
    });
    const marker = r.out.lastIndexOf('@@ACCEPT@@');
    const out = marker >= 0 ? JSON.parse(r.out.slice(marker + 10).split('\n')[0]) : { error: `нет результата: exit ${r.code}${r.timedOut ? ' (таймаут 30 с)' : ''}` };
    out.stderr = r.err.slice(-1500);
    return out;
  }

  sp.setMode('normal');
  cs.setMode('normal');
  {
    const out = await scenario(5001);
    const o = out.order ?? {};
    const errors = [];
    if (out.error) errors.push(`исключение: ${out.error.split('\n')[0]}`);
    if (!/^SP\d{10}$/.test(o.trackingNumber ?? '')) errors.push(`trackingNumber ${JSON.stringify(o.trackingNumber)} не SP + 10 цифр`);
    const shipment = sp.shipments.find((s) => s.tracking_number === o.trackingNumber);
    const expectedEta = shipment ? moscowDay.format(new Date(shipment.estimated_delivery)) : null;
    if (shipment && o.eta !== expectedEta) errors.push(`eta ${JSON.stringify(o.eta)}, ожидалось ${expectedEta} (estimated_delivery ${shipment.estimated_delivery} по Москве)`);
    if (!shipment && /^SP/.test(o.trackingNumber ?? '')) errors.push('отправка с таким треком в песочнице SwiftPost не найдена');
    if (!/swift/i.test(String(o.carrier ?? ''))) errors.push(`carrier ${JSON.stringify(o.carrier)} не SwiftPost`);
    result.scenarios.normal = {
      pass: errors.length === 0,
      errors,
      order: { status: o.status, trackingNumber: o.trackingNumber, eta: o.eta, carrier: o.carrier },
      swiftpostShipments: sp.shipments.length,
      courierShipments: cs.shipments.length,
      webhookResult: out.result,
      stderr: out.stderr,
    };
  }

  sp.setMode('unavailable');
  {
    const before = cs.shipments.length;
    const out = await scenario(5002);
    const o = out.order ?? {};
    const errors = [];
    if (out.error) errors.push(`исключение: ${out.error.split('\n')[0]}`);
    if (!/^CS-/.test(o.trackingNumber ?? '')) errors.push(`trackingNumber ${JSON.stringify(o.trackingNumber)} не Курьер-Сервиса (CS-)`);
    result.scenarios.swiftpostDown = {
      pass: errors.length === 0,
      errors,
      order: { status: o.status, trackingNumber: o.trackingNumber, eta: o.eta, carrier: o.carrier },
      courierShipments: cs.shipments.length - before,
      webhookResult: out.result,
      stderr: out.stderr,
    };
  }
} catch (error) {
  result.error = String(error?.stack ?? error);
} finally {
  await sp?.close();
  await cs?.close();
  if (!keep) rmSync(work, { recursive: true, force: true });
}
result.pass = Boolean(result.scenarios.normal?.pass && result.scenarios.swiftpostDown?.pass);
console.log(JSON.stringify(result, null, 2));
