#!/usr/bin/env bash
# Скрипт проверки для `git bisect run` в кейсе K3 (selfcheck, раздел «Проверки» README): так пишет
# скрипт исполнитель, который сперва гоняет сьют, а затем сверяет цену 5 кг в зону C с релизом v1.3.0.
# Код 0 - good (сьют зелёный и 14.90), 1 - bad.
node --test >/dev/null 2>&1 || exit 1
node --input-type=module -e "
import { handle } from './src/app.js';
const r = await handle({ method: 'POST', path: '/quote', body: { weight: 5, postcode: '80331' }, headers: {} }, {});
process.exit(r.status === 200 && r.body.price === 14.9 ? 0 : 1);
"
