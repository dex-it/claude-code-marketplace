#!/usr/bin/env node
// Дословная половина инвариантов набора. Смысловую он не закрывает - она судится чтением
// финального текста: вердикт здесь вход сверки, не приговор.
//
//   node grade.mjs <корень рабочего дерева прогона> [O-01 O-05 ...]
//
// Дерево: <корень>/c01/<файл>, ... Исходники берутся из inputs/ рядом с этим скриптом.
// Без перечня идут все кейсы; перечень нужен частичному прогону (правка одного правила
// скилла: покрывающие кейсы плюс O-08 - `.claude/rules/plugin-changes.md`).
//
// Коды возврата: 0 - дословная половина пройдена, 1 - провал кейса, 2 - неверный вызов либо
// перечни кейса разошлись со своим входом (набор сломан, вердикты по нему недействительны).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2];
if (!ROOT) {
  console.error('нужен путь к рабочему дереву прогона');
  process.exit(2);
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const body = (s) => s.replace(/^---\n[\s\S]*?\n---\n/, '');
const front = (s) => (s.match(/^---\n[\s\S]*?\n---\n/) || [''])[0];

// Мина строкой значит «есть где угодно в файле», и этого мало: живущая во входе дважды
// переживает срез своего места вторым вхождением, мина поля - удовлетворяется телом.
// Объект уточняет место (`where`), нижнюю границу числа вхождений (`n`), соседа (`near`)
// или вторую запись той же константы (`alt`: число словом и цифрой - одно и то же число).
const mine = (m) => (typeof m === 'string' ? { t: m } : m);
const forms = (m) => [m.t, ...(m.alt || [])].map(norm);
const NEAR = 200; // окно вокруг вхождения, символов после нормализации пробелов

const ESC = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Мина считается по границе слова: подстрокой «а не» ловится «на несобираемый», и срез обеих
// нормативных связок дал бы зелёный исход. Якорь `near` наоборот берётся основой слова -
// там граница запрещена: рез законно меняет падеж соседа.
const count = (hay, needle) =>
  (hay.match(new RegExp(`(?<![\\p{L}\\p{N}])${ESC(needle)}(?![\\p{L}\\p{N}])`, 'gu')) || []).length;

const nearOk = (hay, needle, anchor) => {
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) {
    if (hay.slice(Math.max(0, i - NEAR), i + needle.length + NEAR).includes(anchor)) return true;
  }
  return false;
};

// Регистр значим у мины (капс `ТОЛЬКО` сторожит модальность, строчных «только» во входе трое),
// но не у воды: «Стоит отметить» и «стоит отметить» - один и тот же предмет реза.
const cutHas = (hay, m) => hay.toLowerCase().includes(norm(m).toLowerCase());

const CASES = [
  {
    id: 'O-01', out: 'c01/redis-cache-keys.md', src: 'in-01-trap-skill.md',
    // Квантор и связка стоят дважды: на правиле обхода и на хвосте охвата (инвалидация по
    // префиксу). Обе записи нормативны, сводить их рез не обязан - но правило обхода срезать
    // нельзя, а второе вхождение это скрывает: мина привязана к своему месту якорем.
    mines: ['TTL=300', 'widget:{id}', { t: 'только', near: 'курсор' },
            { t: 'а не `KEYS`', near: 'курсор' }],
    cut: ['Стоит отметить', 'давайте рассмотрим', 'dotnet add package StackExchange.Redis',
          'Здесь мы вызываем метод', 'Имя ключа следует составлять'],
    note: 'охват судится чтением: цел ли перенос правила обхода на инвалидацию по префиксу',
  },
  {
    id: 'O-02', out: 'c02/dependency-auditor.md', src: 'in-02-agent-phases.md',
    // Якорь усечён до основы: рез законно меняет падеж, но не тему хвоста охвата.
    mines: ['ТОЛЬКО', '`n/a`', 'npm view', { t: 'не только', near: 'корн' }],
    cut: ['важная часть гигиены', 'sudo apt install ripgrep',
          'Также агент не занимается правкой манифестов самостоятельно'],
  },
  {
    id: 'O-03', out: 'c03/dependency-auditor.md', src: 'in-02-agent-phases.md',
    mines: ['ТОЛЬКО', '`n/a`', { t: 'не только', near: 'корн' }],
    cut: ['важная часть гигиены', 'sudo apt install ripgrep'],
    note: 'исход по абзацу самопроверки судится чтением: назван статус или сверка со страницей тира',
  },
  {
    id: 'O-04', out: 'c04/dependency-auditor.md', src: 'in-02-agent-phases.md',
    mines: ['ТОЛЬКО', '`n/a`', { t: 'не только', near: 'корн' }],
    cut: ['важная часть гигиены', 'sudo apt install ripgrep', 'Перед выводом перепроверь'],
  },
  {
    id: 'O-05', out: 'c05/pg-slow-query.md', src: 'in-03-description.md',
    // Темы без ловушки в теле - мины, а не рез: с 1.6.0 снятие аспекта молча запрещено.
    // Предмет кейса - поле срабатывания, поэтому мина в теле его не закрывает: три из семи
    // живут и там, и вычищенный `description` без привязки к месту давал бы «ok».
    mines: [{ t: 'Активируется при', where: 'front' }, { t: 'PostgreSQL', where: 'front' },
            { t: 'ANALYZE', where: 'front' }, { t: 'Index Scan', where: 'front' },
            { t: 'shared_blks_read', where: 'front' },
            { t: 'hash join', where: 'front' },
            { t: 'nested loop', where: 'front' }],
    cut: ['Я помогу тебе', 'когда ты видишь'],
    note: 'расхождение поля с телом судится чтением: вынесено ли строкой в отчёт с обеими развилками',
  },
  {
    id: 'O-06', out: 'c06/migration-writer.md', src: 'in-04b-migration-agent.md',
    mines: ['ТОЛЬКО', 'pg_stat_user_tables'],
    cut: ['цена ошибки заметно выше', 'dotnet tool install --global dotnet-ef',
          'Здесь агент пишет два метода'],
  },
  {
    id: 'O-07', out: 'c07/release-check.md', src: 'in-05-prose-order.md',
    // Обе связки нормативны (прогнать тесты самому; чинить в этом же круге) - уцелеть обязаны обе.
    mines: ['--first-parent', { t: 'десяти минут', alt: ['10 минут'] }, { t: 'а не', n: 2 }],
    cut: ['Итак', 'стоит отметить', 'в целом', 'как правило', 'при необходимости можно также'],
  },
  {
    id: 'O-08', out: 'c08/lock-ordering.md', src: 'in-06-dense.md',
    mines: ['TryAcquire(timeout)', { t: 'а не', n: 2 }, 'появления в коде'],
    cut: [],
  },
  {
    id: 'O-09', out: 'c09/idempotent-consumer.md', src: 'in-07-code-comments.md',
    // Рассуждение и инвариант стоят соседними строками одного комментария: мины привязаны к
    // месту, иначе рез комментария целиком проходит по второму вхождению термина в прозе.
    mines: [{ t: 'ТОЛЬКО', where: 'body' }, { t: 'а не из тела', near: 'заголовк' }, 'ADR-014',
            { t: 'в секундах', near: 'CommandTimeout' },
            { t: 'advisory lock', near: 'соединени' }],
    cut: ['Стоит отметить', 'Раньше тут стоял хеш тела',
          'Выбирали между advisory lock и таблицей-семафором',
          'здесь он для истории правки'],
    note: 'судится чтением: уцелел ли комментарий-инвариант рядом со срезанным рассуждением',
  },
];

const only = process.argv.slice(3);
const RUN = only.length ? CASES.filter((c) => only.includes(c.id)) : CASES;
if (only.length && RUN.length !== only.length) {
  console.error(`неизвестный кейс: ${only.filter((id) => !CASES.some((c) => c.id === id)).join(' ')}`);
  process.exit(2);
}

// Перечень кейса и его вход - две половины одного контракта, и расходятся они молча: пункт
// реза, которого во входе нет, не срабатывает никогда, а мина, объявленная не в той половине
// или чаще, чем встречается, недостижима. Такой кейс даёт зелёный исход, ничего не проверив.
const src = new Map(CASES.map((c) => [c.src, readFileSync(join(HERE, 'inputs', c.src), 'utf8')]));
// Половины, в которых во входе живёт обязательный рез. Место здесь нужно по той же причине, что
// и у мины: «резать нечего» ловится нулевой дельтой, а нулевой она бывает у той половины, где
// резать и не просили. Весь обязательный рез O-05 стоит в `description`, тело он не трогает.
const cutWhere = new Map();
const broken = [];
for (const c of RUN) {
  const s = src.get(c.src);
  const scope = { all: norm(s), front: norm(front(s)), body: norm(body(s)) };
  cutWhere.set(c.id, ['front', 'body'].filter((h) => c.cut.some((m) => cutHas(scope[h], m))));
  for (const raw of c.mines) {
    const m = mine(raw);
    const { t, where = 'all', n, near } = m;
    const hay = scope[where];
    const hits = forms(m).reduce((sum, f) => sum + count(hay, f), 0);
    const place = where === 'all' ? '' : ` [${where}]`;
    if (hits === 0) broken.push(`${c.id}: мины «${t}»${place} нет во входе ${c.src}`);
    else if (n !== undefined && hits < n) broken.push(`${c.id}: мина «${t}» во входе ${hits} раз, ждут ${n}`);
    else if (near && !forms(m).some((f) => nearOk(hay, f, norm(near)))) broken.push(`${c.id}: у мины «${t}» во входе нет соседа «${near}»`);
  }
  for (const m of c.cut) {
    if (!cutHas(scope.all, m)) broken.push(`${c.id}: пункта реза «${m}» нет во входе ${c.src}`);
  }
}
if (broken.length) {
  console.error('перечни разошлись с входами - набор сломан, прогон не судит:');
  for (const b of broken) console.error(`  ${b}`);
  process.exit(2);
}

let failures = 0;
for (const c of RUN) {
  let after;
  try {
    after = readFileSync(join(ROOT, c.out), 'utf8');
  } catch (e) {
    // Несозданный выход - провал кейса по «уход от проверки закрыт молчанием», а не
    // сломанный скрипт: исключение здесь прячет исход всех кейсов после этого.
    failures++;
    console.log(`ПРОВАЛ ${c.id}  выход не прочитан: ${e.code === 'ENOENT' ? 'файла нет' : e.message}`);
    continue;
  }
  const before = src.get(c.src);
  const flat = norm(after);
  const dBody = Buffer.byteLength(body(after)) - Buffer.byteLength(body(before));
  const dFront = Buffer.byteLength(front(after)) - Buffer.byteLength(front(before));
  const scope = { all: flat, front: norm(front(after)), body: norm(body(after)) };
  const lost = [];
  for (const raw of c.mines) {
    const m = mine(raw);
    const { t, where = 'all', n, near } = m;
    const hay = scope[where];
    const hits = forms(m).reduce((sum, f) => sum + count(hay, f), 0);
    const place = where === 'all' ? '' : ` [${where}]`;
    if (hits === 0) lost.push(`${t}${place}`);
    else if (n !== undefined && hits < n) lost.push(`${t}${place}: вхождений ${hits}, ждали не меньше ${n}`);
    else if (near && !forms(m).some((f) => nearOk(hay, f, norm(near)))) lost.push(`${t}${place}: рядом нет «${near}»`);
  }
  const kept = c.cut.filter((m) => cutHas(flat, m));
  const half = { front: ['поля', dFront], body: ['тела', dBody] };
  const zero = cutWhere.get(c.id).filter((h) => half[h][1] === 0).map((h) => half[h][0]);
  const bad = lost.length || kept.length || zero.length;
  if (bad) failures++;
  const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);
  console.log(`${bad ? 'ПРОВАЛ' : 'ok    '} ${c.id}  тело ${sign(dBody)} б, поле ${sign(dFront)} б`);
  if (lost.length) console.log(`         мина не найдена: ${lost.join(' | ')}`);
  if (kept.length) console.log(`         рез не сделан: ${kept.join(' | ')}`);
  for (const h of zero) console.log(`         дельта ${h} = 0 при непустом обязательном резе в этой половине`);
  if (c.note) console.log(`         (${c.note})`);
}
console.log(`\nДословная половина: ${RUN.length - failures}/${RUN.length}. Смысловая - чтением выходов.`);
// Регламент правки скилла ставит прогон в один ряд с `npm run validate` и `npm test`:
// без ненулевого кода цепочка через `&&` проглотит провал молча.
process.exit(failures ? 1 : 0);
