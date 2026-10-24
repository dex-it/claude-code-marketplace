#!/usr/bin/env node
const o = require('../src/orders');
const { formatAmount } = require('../src/money');

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) {
    const v = rest[i + 1];
    if (v === undefined || v.startsWith('--')) { console.error(`missing value for ${rest[i]}`); process.exit(2); }
    flags[rest[i].slice(2)] = v; i++;
  } else pos.push(rest[i]);
}
const line = (x) => `${x.id} ${x.sku} x${x.qty} ${formatAmount(x.total)} ${x.status}`;
try {
  if (cmd === 'create') console.log(o.create(flags).id);
  else if (cmd === 'list') { const rows = o.list(flags); console.log(rows.length ? rows.map(line).join('\n') : 'no orders'); }
  else if (['pay', 'ship', 'cancel'].includes(cmd)) console.log(line(o[cmd](pos[0])));
  else { console.log('usage: orders <create|list|pay|ship|cancel>'); process.exit(1); }
} catch (e) { console.error(e.message); process.exit(e.code || 1); }
