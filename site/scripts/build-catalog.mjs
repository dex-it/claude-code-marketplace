// Генератор страниц каталога из метаданных репозитория.
//
// Источники (читаются как есть, руками на сайт ничего не копируется):
//   .claude-plugin/marketplace.json            состав каталога, описания, версии
//   <source>/.claude-plugin/plugin.json        имя плагина (для полной формы команды)
//   <source>/bundle.json                       состав бандлов
//   <source>/agents, commands, skills          что лежит внутри плагина
//   README.md, раздел «Перечень skills ...»    группировка skills по темам
//   tools/command-skills.js                    команды, оформленные как skill (голое имя)
//
// Результат: Markdown в site/src/generated (в git не хранится) и копии баннеров.
// Любое расхождение, которое сделает каталог неполным, роняет сборку.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { REPO as GITHUB } from '../site.config.mjs';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SITE_ROOT, '..');
const OUT = join(SITE_ROOT, 'src', 'generated');

const KIND_LABEL = {
  bundle: 'Бандл',
  specialist: 'Специалист',
  skill: 'Skill',
  utility: 'Утилита',
  mod: 'Мод',
};

// Подписи каталогов специалистов. Новый каталог без записи получает своё имя.
const SPECIALIST_GROUPS = {
  architecture: ['Архитектура', 'ADR, API, дизайн, диаграммы, обзорное ревью кода'],
  delivery: ['Поставка и баги', 'баги, инциденты, правки по ревью, безопасность'],
  dotnet: ['.NET', 'код, тесты, EF Core, производительность, диагностика рантайма'],
  fullstack: ['TypeScript', 'Node.js/Bun и React'],
  infrastructure: ['Инфраструктура', 'CI/CD, контейнеры, брокеры, базы данных, мониторинг'],
  ml: ['ML', 'данные, обучение, отладка моделей, деплой'],
  product: ['Продукт и требования', 'требования, сценарии, BDD, бэклог, метрики'],
  qa: ['QA', 'поиск и оформление багов, тест-дизайн, автотесты'],
  review: ['Ревью и приёмка', 'ревью MR/PR, саморевью, приёмка требований и стенда'],
  auto: ['Автономная работа', 'трек от цели до коммитов и PR'],
};
const SPECIALIST_ORDER = ['architecture', 'product', 'dotnet', 'fullstack', 'review', 'delivery', 'qa', 'infrastructure', 'ml', 'auto'];

const fail = (msg) => {
  console.error(`catalog: ${msg}`);
  process.exit(1);
};
const warnings = [];
const warn = (msg) => warnings.push(msg);

// ---------- чтение ----------

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const exists = (p) => existsSync(p);

function frontmatter(file) {
  const raw = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---(\n|$)/);
  if (!m) return {};
  try {
    return parseYaml(m[1]) ?? {};
  } catch {
    // Frontmatter, который строгий YAML не берёт, читаем построчно: нужны только строковые поля.
    const out = {};
    for (const line of m[1].split('\n')) {
      const kv = line.match(/^([A-Za-z-]+):\s*(.*)$/);
      if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
    }
    warn(`frontmatter разобран построчно: ${file.replace(REPO_ROOT + '/', '')}`);
    return out;
  }
}

const marketplace = readJson(join(REPO_ROOT, '.claude-plugin', 'marketplace.json'));
const MARKET = marketplace.name;

// Команды, оформленные как skill: у них голое имя, а не `/плагин:имя`.
function commandSkillSet() {
  const file = join(REPO_ROOT, 'tools', 'command-skills.js');
  if (!exists(file)) return new Set();
  const m = readFileSync(file, 'utf8').match(/COMMAND_SKILLS\s*=\s*new Set\(\[([^\]]*)\]/);
  if (!m) {
    warn('tools/command-skills.js: не найден COMMAND_SKILLS, команды-skills будут показаны как skills');
    return new Set();
  }
  return new Set([...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]));
}
const COMMAND_SKILLS = commandSkillSet();

function listMd(dir) {
  return exists(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : [];
}

const plugins = marketplace.plugins.map((entry) => {
  const dir = resolve(REPO_ROOT, entry.source);
  if (!exists(dir)) fail(`${entry.name}: каталог источника не найден: ${entry.source}`);
  const pj = readJson(join(dir, '.claude-plugin', 'plugin.json'));
  if (pj.name !== entry.name) fail(`${entry.name}: имя в plugin.json (${pj.name}) не совпадает с marketplace.json`);

  const agents = listMd(join(dir, 'agents')).map((f) => {
    const fm = frontmatter(join(dir, 'agents', f));
    return { name: fm.name ?? f.slice(0, -3), description: String(fm.description ?? '') };
  });
  const commands = listMd(join(dir, 'commands')).map((f) => {
    const fm = frontmatter(join(dir, 'commands', f));
    const name = f.slice(0, -3);
    return { name, full: `/${entry.name}:${name}`, description: String(fm.description ?? ''), hint: fm['argument-hint'] ? String(fm['argument-hint']) : '' };
  });
  const skills = [];
  if (exists(join(dir, 'skills'))) {
    for (const s of readdirSync(join(dir, 'skills'), { withFileTypes: true })) {
      if (!s.isDirectory()) continue;
      const file = join(dir, 'skills', s.name, 'SKILL.md');
      if (!exists(file)) continue;
      const fm = frontmatter(file);
      const name = fm.name ?? s.name;
      const description = String(fm.description ?? '');
      if (COMMAND_SKILLS.has(`${entry.name}:${name}`)) {
        commands.push({ name, full: `/${name}`, description, hint: fm['argument-hint'] ? String(fm['argument-hint']) : '', bare: true });
      } else {
        skills.push({ name, description });
      }
    }
  }
  let bundle = null;
  if (exists(join(dir, 'bundle.json'))) {
    const b = readJson(join(dir, 'bundle.json'));
    bundle = { includes: b.includes ?? [], dependencies: b.dependencies ?? [], authorOnly: b.authorOnly ?? [] };
  }
  const rel = entry.source.replace(/^\.\//, '');
  const parts = rel.split('/');
  let group = null;
  if (entry.category === 'specialist') group = parts[0] === 'plugins' && parts[1] === 'specialists' ? parts[2] : parts[1];

  return {
    ...entry,
    rel,
    group,
    readme: exists(join(dir, 'README.md')),
    agents,
    commands,
    skills,
    bundle,
    pluginJson: pj,
  };
});

const byName = new Map(plugins.map((p) => [p.name, p]));
if (byName.size !== plugins.length) fail('в marketplace.json повторяются имена плагинов');

for (const p of plugins) {
  if (p.bundle) {
    for (const n of [...p.bundle.includes, ...p.bundle.dependencies]) {
      if (!byName.has(n)) fail(`${p.name}: в составе бандла названо то, чего нет в marketplace.json: ${n}`);
    }
  }
}

// Обратный индекс: в какие бандлы входит плагин.
const bundlesOf = new Map(plugins.map((p) => [p.name, []]));
for (const b of plugins.filter((p) => p.bundle)) {
  for (const n of b.bundle.includes) bundlesOf.get(n).push({ bundle: b.name, role: 'profile' });
  for (const n of b.bundle.dependencies) bundlesOf.get(n).push({ bundle: b.name, role: 'dependency' });
}

// Группировка skills по темам: из таблицы README (её состав сверяет validate-readme).
function skillThemes() {
  const readme = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8');
  const start = readme.indexOf('| Категория | Skills |');
  const themes = [];
  if (start < 0) {
    warn('README.md: таблица «Категория | Skills» не найдена, skills будут одним списком');
    return themes;
  }
  for (const line of readme.slice(start).split('\n').slice(2)) {
    if (!line.startsWith('|')) break;
    const cells = line.split('|').map((c) => c.trim());
    const title = cells[1].replace(/\*\*/g, '');
    const names = [...cells[2].matchAll(/`([^`]+)`/g)].map((m) => `dex-skill-${m[1]}`);
    themes.push({ title: title.replace(/\s*\(экспериментально\)/, ''), experimental: /экспериментально/.test(title), names });
  }
  return themes;
}

// ---------- форматирование ----------

const slug = (name) => name;
const pluginUrl = (name) => `/catalog/plugins/${slug(name)}/`;
const link = (name) => `[\`${name}\`](${pluginUrl(name)})`;
const yamlStr = (s) => JSON.stringify(String(s));
const plural = (n, one, few, many) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

// Текст из frontmatter попадает в Markdown: служебные символы экранируются, обратные кавычки остаются разметкой.
function esc(text) {
  return String(text)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\\/g, '\\\\')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[{}]/g, (c) => `\\${c}`)
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\|/g, '\\|');
}

// Короткое «для чего»: до «Активируется при», до первого конца предложения, иначе по границе слова.
function short(text, max = 170) {
  let t = String(text).replace(/\s+/g, ' ').trim();
  t = t.replace(/\s*Активируется при.*$/i, '').replace(/\s*Триггеры\s*[-:].*$/i, '');
  const sentence = t.match(/^(.{30,}?[.!?])(\s|$)/);
  if (sentence && sentence[1].length <= max) t = sentence[1];
  if (t.length > max) {
    t = t.slice(0, max);
    t = t.slice(0, t.lastIndexOf(' ')).replace(/[,;:\-(]+$/, '') + '…';
  }
  return t.replace(/\.$/, '');
}

const cell = (text) => esc(short(text));
const installCmd = (p) =>
  p.category === 'bundle'
    ? `./install-bundle/install-bundle.sh ${p.name.replace(/^dex-bundle-/, '')}`
    : `claude plugin install ${p.name}@${MARKET}`;

function page({ title, description, order, sidebarLabel, hidden = false, body, extra = [] }) {
  const lines = ['---', `title: ${yamlStr(title)}`, `description: ${yamlStr(description)}`, 'editUrl: false'];
  if (hidden) {
    lines.push('sidebar:', '  hidden: true');
    lines.push('prev: false', 'next: false');
  } else if (order !== undefined || sidebarLabel) {
    lines.push('sidebar:');
    if (order !== undefined) lines.push(`  order: ${order}`);
    if (sidebarLabel) lines.push(`  label: ${yamlStr(sidebarLabel)}`);
  }
  lines.push(...extra, '---', '', body.trim(), '');
  return lines.join('\n');
}

const written = [];
function write(slugPath, content) {
  const file = join(OUT, `${slugPath}.md`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  written.push(slugPath);
}

const installNote = `Один плагин ставится командой \`claude plugin install <имя>@${MARKET}\`; точная команда есть на странице каждого плагина. Бандлы ставит скрипт из клона репозитория: [как это сделать](/start/install/).`;

// ---------- страницы плагинов ----------

function rowsOf(list) {
  return list.map((n) => `- ${link(n)} - ${esc(short(byName.get(n).description, 120))}`).join('\n');
}

function pluginPage(p) {
  const kind = p.category === 'specialist' && p.group ? `${KIND_LABEL.specialist}, ${SPECIALIST_GROUPS[p.group]?.[0] ?? p.group}` : KIND_LABEL[p.category];
  const b = [];
  b.push(`> ${esc(p.description)}`);
  b.push('');
  b.push(`**Вид:** ${kind} · **Версия:** ${p.version} · [Исходники${p.readme ? ' и README' : ''} на GitHub](${GITHUB}/tree/main/${p.rel})`);
  b.push('');
  b.push('## Установка');
  b.push('');
  if (p.category === 'bundle') {
    b.push('Из клона репозитория (нужны `git`, `claude` и `jq`):');
    b.push('');
    b.push('```bash');
    b.push(installCmd(p));
    b.push('```');
    b.push('');
    b.push('Сначала посмотреть состав без установки: добавьте `--dry-run`.');
    if (p.bundle.authorOnly.length) {
      b.push('');
      b.push(':::caution[Не для пользователя каталога]');
      b.push('Бандл собран для того, кто правит сам каталог: он работает в локальном клоне репозитория.');
      b.push(':::');
    }
  } else {
    b.push('```bash');
    b.push(installCmd(p));
    b.push('```');
    if (p.category === 'specialist' || p.category === 'utility') {
      b.push('');
      b.push('Установка плоская: skills, которые нужны специалисту, сами не подтягиваются. Бандл ставит всё нужное сразу.');
    }
    if (p.category === 'mod') {
      b.push('');
      b.push('Моды требуют Claude Code 2.1.287 или новее и ставятся адресно, в бандлы они не входят.');
    }
  }

  if (p.category === 'bundle') {
    b.push('', '## Состав', '');
    b.push('Профиль роли - то, ради чего бандл собран:', '');
    b.push(rowsOf(p.bundle.includes));
    if (p.bundle.dependencies.length) {
      b.push('', `Подтянуто вместе с профилем (${p.bundle.dependencies.length}) - то, на что опираются названные выше плагины:`, '');
      b.push('<details>', '<summary>Показать список</summary>', '');
      b.push(rowsOf(p.bundle.dependencies));
      b.push('', '</details>');
    }
  }

  if (p.commands.length) {
    b.push('', '## Команды', '');
    for (const c of p.commands) {
      b.push(`- \`${c.full}\` - ${esc(c.description)}`);
      if (c.hint) b.push(`  - Аргументы: \`${c.hint.replace(/`/g, "'")}\``);
    }
    if (!p.commands.some((c) => c.bare)) {
      b.push('', 'Команды плагинов вызываются полной формой `/плагин:команда`.');
    }
  }
  if (p.agents.length) {
    b.push('', p.agents.length > 1 ? '## Агенты' : '## Агент', '');
    for (const a of p.agents) b.push(`- \`${a.name}\` - ${esc(short(a.description, 260))}`);
  }
  if (p.skills.length) {
    b.push('', p.skills.length > 1 ? '## Skills' : '## Skill', '');
    for (const s of p.skills) {
      const desc = String(s.description).replace(/\s+/g, ' ').trim();
      b.push(`- \`${s.name}\` - ${esc(desc)}`);
    }
    if (p.category === 'skill') {
      b.push('', 'Skill подгружается сам, когда в разговоре появляется его тема: Claude Code сверяет её с описанием выше.');
    }
  }

  const owners = bundlesOf.get(p.name);
  if (owners.length) {
    b.push('', '## Входит в бандлы', '');
    for (const o of owners) {
      b.push(`- ${link(o.bundle)} - ${o.role === 'profile' ? 'в профиле роли' : 'как зависимость'}`);
    }
  }

  write(`catalog/plugins/${slug(p.name)}`, page({ title: p.name, description: short(p.description, 200), hidden: true, body: b.join('\n') }));
}

// ---------- страницы разделов ----------

function bundlesPage() {
  const list = plugins.filter((p) => p.category === 'bundle').sort((a, c) => a.name.localeCompare(c.name));
  const b = [];
  b.push('Бандл - готовый набор плагинов под роль или задачу. Кода в нём нет: это список, который ставит скрипт `install-bundle.sh`. В профиле роли - то, ради чего бандл собран; рядом ставится всё, на что это опирается.', '');
  b.push(':::tip[Не знаете, что выбрать]');
  b.push('Для первого раза возьмите `code-review`: он работает с любым языком. Задачи и подходящие бандлы собраны в [сценариях](/scenarios/).');
  b.push(':::', '');
  b.push('Установка из клона репозитория:', '', '```bash', './install-bundle/install-bundle.sh <имя>', '```', '');
  for (const p of list) {
    const short_ = p.name.replace(/^dex-bundle-/, '');
    b.push(`## ${short_}`, '');
    b.push(esc(p.description), '');
    b.push(`Установка: \`./install-bundle/install-bundle.sh ${short_}\` · [страница бандла](${pluginUrl(p.name)})`, '');
    const total = p.bundle.includes.length + p.bundle.dependencies.length;
    b.push(`В профиле роли ${p.bundle.includes.length}, всего с зависимостями ${total}.`, '');
    b.push('<details>', `<summary>Профиль роли</summary>`, '');
    b.push(rowsOf(p.bundle.includes), '', '</details>', '');
  }
  write('catalog/bundles', page({ title: 'Бандлы', description: 'Готовые наборы плагинов под роль: что входит и как поставить', order: 2, body: b.join('\n') }));
}

function specialistsPages() {
  const list = plugins.filter((p) => p.category === 'specialist');
  const groups = new Map();
  for (const p of list) {
    if (!groups.has(p.group)) groups.set(p.group, []);
    groups.get(p.group).push(p);
  }
  const keys = [...groups.keys()].sort((a, c) => {
    const ia = SPECIALIST_ORDER.indexOf(a);
    const ic = SPECIALIST_ORDER.indexOf(c);
    return (ia < 0 ? 99 : ia) - (ic < 0 ? 99 : ic) || a.localeCompare(c);
  });
  const idx = [];
  idx.push('Специалист - агент с узкой ролью и понятным порядком работы: ревьюер, дебаггер, архитектор, DevOps. Как правило один плагин - один агент. Команда, которая запускает специалиста, лежит в его же плагине.', '');
  idx.push(':::note');
  idx.push('Специалист без нужных ему skills запустится, но будет работать без них. Бандл ставит специалиста вместе со skills, поэтому для начала берите бандл, а не плагин поштучно.');
  idx.push(':::', '');
  idx.push('Разделы повторяют каталоги на диске.', '');
  idx.push('| Раздел | О чём | Плагинов |', '|---|---|---|');
  keys.forEach((k, i) => {
    const [label, blurb] = SPECIALIST_GROUPS[k] ?? [k, ''];
    const n = groups.get(k).length;
    idx.push(`| [${label}](/catalog/specialists/${k}/) | ${blurb} | ${n} |`);
    const rows = groups.get(k).sort((a, c) => a.name.localeCompare(c.name));
    const b = [];
    b.push(`${label}: ${blurb}.`, '');
    b.push('| Плагин | Агент | Команда | Для чего |', '|---|---|---|---|');
    for (const p of rows) {
      const agents = p.agents.map((a) => `\`${a.name}\``).join(', ') || '-';
      const cmds = p.commands.map((c) => `\`${c.full}\``).join(', ') || '-';
      b.push(`| ${link(p.name)} | ${agents} | ${cmds} | ${cell(p.description)} |`);
    }
    b.push('', installNote);
    write(`catalog/specialists/${k}`, page({ title: label, description: `Специалисты: ${blurb}`, order: i + 1, body: b.join('\n') }));
  });
  write('catalog/specialists/index', page({ title: 'Специалисты', description: 'Агенты с узкой ролью, сгруппированные по областям', order: 0, body: idx.join('\n') }));
}

function skillsPage() {
  const skills = plugins.filter((p) => p.category === 'skill');
  const themes = skillThemes();
  const placed = new Set();
  const b = [];
  b.push('Skill - короткая памятка по теме или стеку: на что не наступать и как делать правильно. Подгружается сама, когда тема появляется в разговоре, либо её загружает агент. Плагин называется `dex-skill-<имя>`.', '');
  b.push(installNote, '');
  const section = (title, names, note) => {
    const rows = names.map((n) => byName.get(n)).filter(Boolean);
    if (!rows.length) return;
    b.push(`## ${title}`, '');
    if (note) b.push(note, '');
    b.push('| Skill | Для чего |', '|---|---|');
    for (const p of rows.sort((a, c) => a.name.localeCompare(c.name))) {
      b.push(`| ${link(p.name)} | ${cell(p.skills[0]?.description || p.description)} |`);
      placed.add(p.name);
    }
    b.push('');
  };
  for (const t of themes) {
    const names = t.names.filter((n) => byName.get(n)?.category === 'skill');
    section(t.title, names, t.experimental ? 'Экспериментально.' : '');
  }
  const rest = skills.filter((p) => !placed.has(p.name)).map((p) => p.name);
  section('Остальное', rest);
  write('catalog/skills', page({ title: 'Skills', description: 'Памятки по стекам и темам, которые подгружаются сами', order: 3, body: b.join('\n') }));
}

function commandsPage() {
  const rows = [];
  for (const p of plugins) for (const c of p.commands) rows.push({ p, c });
  rows.sort((a, c) => a.c.name.localeCompare(c.c.name) || a.p.name.localeCompare(c.p.name));
  const b = [];
  b.push('Команда - точка входа в работу: вы вызываете её, она ведёт порядок шагов, вызывает специалистов и skills. Команда лежит в плагине того, кому делегирует, и вызывается полной формой `/плагин:команда`.', '');
  b.push(':::note[Короткое имя]');
  b.push('В сценариях и на страницах каталога команды записаны полным именем: оно работает всегда. Короткое имя без префикса плагина платформа даёт только skills, и каталог на него не рассчитывает.');
  b.push(':::', '');
  b.push('Название команды ведёт на страницу плагина, в котором она лежит.', '');
  b.push('| Команда | Что делает |', '|---|---|');
  for (const { p, c } of rows) b.push(`| [\`${c.full}\`](${pluginUrl(p.name)}) | ${cell(c.description)} |`);
  write('catalog/commands', page({ title: 'Команды', description: 'Все команды каталога: что делают и в каком плагине лежат', order: 4, body: b.join('\n') }));
  return rows.length;
}

function utilitiesPage() {
  const rows = plugins.filter((p) => p.category === 'utility').sort((a, c) => a.name.localeCompare(c.name));
  const b = [];
  b.push('Утилита - плагин без агентов и skills: обёртки над CLI (`gh`, `kubectl`, `psql` и другие), уведомления, анализ репозитория. Плагины ставят только команды: сами программы должны быть на машине.', '');
  b.push('Все CLI-плагины одной командой: `./install-bundle/install-bundle.sh cli-tools`. Установка самих программ, настройка и сравнение с MCP - в [руководстве по CLI-утилитам на GitHub](' + GITHUB + '/blob/main/docs/CLI_UTILITIES.md).', '');
  b.push(installNote, '');
  b.push('| Плагин | Команды | Для чего |', '|---|---|---|');
  for (const p of rows) {
    const cmds = p.commands.map((c) => `\`${c.full}\``).join(', ') || '-';
    b.push(`| ${link(p.name)} | ${cmds} | ${cell(p.description)} |`);
  }
  write('catalog/utilities', page({ title: 'Утилиты', description: 'Обёртки над CLI, уведомления и анализ репозитория', order: 5, body: b.join('\n') }));
}

function modsPage() {
  const rows = plugins.filter((p) => p.category === 'mod').sort((a, c) => a.name.localeCompare(c.name));
  const b = [];
  b.push('Мод меняет сам Claude Code: панели, строки над вводом, слежение за PR и сессиями. Это TypeScript-модуль, который работает внутри процесса клиента. Моды ставятся адресно, в бандлы не входят и требуют Claude Code 2.1.287 или новее. API модов в раннем доступе и может меняться между релизами.', '');
  b.push('Устройство мода: [MOD_FRAMEWORK.md на GitHub](' + GITHUB + '/blob/main/docs/MOD_FRAMEWORK.md).', '');
  b.push('| Мод | Для чего |', '|---|---|');
  for (const p of rows) b.push(`| ${link(p.name)} | ${cell(p.description)} |`);
  b.push('', '```bash');
  for (const p of rows) b.push(installCmd(p));
  b.push('```');
  write('catalog/mods', page({ title: 'Моды', description: 'Моды меняют сам Claude Code: панели, строки состояния, трекеры PR и сессий', order: 6, body: b.join('\n') }));
}

function overviewPage() {
  const count = (cat) => plugins.filter((p) => p.category === cat).length;
  const cmdCount = plugins.reduce((n, p) => n + p.commands.length, 0);
  const b = [];
  b.push('Каталог собирается из `.claude-plugin/marketplace.json` и манифестов плагинов при каждой сборке сайта, поэтому не расходится с репозиторием. Выберите вид плагина или начните с бандла под свою роль.', '');
  b.push('| Раздел | Что внутри | Сколько |', '|---|---|---|');
  b.push(`| [Бандлы](/catalog/bundles/) | готовые наборы под роль | ${count('bundle')} |`);
  b.push(`| [Специалисты](/catalog/specialists/) | агенты с узкой ролью | ${count('specialist')} |`);
  b.push(`| [Skills](/catalog/skills/) | памятки по стекам и темам | ${count('skill')} |`);
  b.push(`| [Команды](/catalog/commands/) | точки входа в работу | ${cmdCount} |`);
  b.push(`| [Утилиты](/catalog/utilities/) | CLI-обёртки, уведомления, анализ репозитория | ${count('utility')} |`);
  b.push(`| [Моды](/catalog/mods/) | меняют сам Claude Code | ${count('mod')} |`);
  b.push('', 'Число - на момент сборки сайта, из манифестов.', '');
  b.push('## Как выбирать', '');
  b.push('- Нужен набор под роль - берите [бандл](/catalog/bundles/): он ставит специалистов вместе с их skills.');
  b.push('- Нужна конкретная команда - найдите её в [списке команд](/catalog/commands/) и посмотрите, в каком плагине она лежит.');
  b.push('- Нужна одна памятка по стеку - [skills](/catalog/skills/), по одному плагину.');
  b.push('- Не знаете, с чего начать - [сценарии](/scenarios/): «хочу ... - ставлю ... - запускаю ...».');
  b.push('', '## Где искать', '');
  b.push('Поиск по сайту (строка вверху) находит и плагины, и команды по имени. У каждого плагина есть страница: описание, версия, команда установки, состав и бандлы, в которые он входит.');
  write('catalog/index', page({ title: 'Каталог', description: 'Бандлы, специалисты, skills, команды, утилиты и моды каталога', order: 0, body: b.join('\n') }));
  return cmdCount;
}

// ---------- запуск ----------

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const p of plugins) pluginPage(p);
overviewPage();
bundlesPage();
specialistsPages();
skillsPage();
const commandTotal = commandsPage();
utilitiesPage();
modsPage();

// Баннеры бренда: конфиг Starlight читает логотип из проекта, а источник лежит в assets/ репозитория.
const brand = join(OUT, 'brand');
mkdirSync(brand, { recursive: true });
for (const f of ['dexaikit-banner-light.svg', 'dexaikit-banner-dark.svg']) {
  const src = join(REPO_ROOT, 'assets', f);
  if (!exists(src)) fail(`нет баннера: assets/${f}`);
  cpSync(src, join(brand, f));
}

// Полнота: у каждого плагина из marketplace.json есть страница.
const missing = plugins.filter((p) => !exists(join(OUT, 'catalog', 'plugins', `${slug(p.name)}.md`)));
if (missing.length) fail(`нет страниц для: ${missing.map((p) => p.name).join(', ')}`);

for (const w of warnings) console.warn(`catalog: предупреждение: ${w}`);
console.log(`catalog: ${plugins.length} плагинов, ${commandTotal} команд, страниц ${written.length}`);
