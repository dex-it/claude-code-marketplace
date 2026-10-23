// Перечень артефактов плагина и суд половины «скилл» полной формы `{plugin}:{skill}` - одно правило
// для validate-skill, validate-agent и validate-command (issue #423, продолжение #220).
//
// Скилл, агент и команда одного плагина делят пространство имён `{plugin}:{artifact}`: вызов своего
// агента или команды формой не отличим от вызова скилла. Поэтому «скилл существует» судится по
// объединению трёх перечней, а не по одним SKILL.md. Правило имени `skill-reference-unknown` каждый
// валидатор поднимает у себя (реестр правил ищет `rule:` в тексте самого валидатора); здесь только
// данные и выборка висячих адресов.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import matter from 'gray-matter';

// Трек плагина (Workflow-скрипт из каталога `workflows` манифеста) зовётся тем же адресом
// `{plugin}:{name}`, где name - `meta.name` скрипта: `Workflow` `dex-auto:dex-auto-goal`. Это
// четвёртый вид артефакта плагина, и ссылка на него не висячая.
const WORKFLOW_NAME_RE = /export\s+const\s+meta\s*=\s*\{[^]*?\bname:\s*['"]([^'"]+)['"]/;

function addWorkflows(pluginJson, manifest, names) {
  if (typeof manifest.workflows !== 'string') return;
  const dir = resolve(dirname(dirname(pluginJson)), manifest.workflows);
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.js')) continue;
    try {
      const name = readFileSync(join(dir, file), 'utf8').match(WORKFLOW_NAME_RE)?.[1];
      if (name) names.add(name);
    } catch {
      // unreadable script - skipped
    }
  }
}

/**
 * Map `plugin name` -> Set of artifact names (skills, agents, commands, tracks) the plugin ships.
 * Плагин с манифестом, но без артефактов попадает в карту с пустым набором: он известен каталогу,
 * и ссылка в его пространство имён висячая. `statPlain` передаёт валидатор: обход не идёт по
 * symlink и спецфайлам (отказ с кодом 1), и это решение каждого валидатора, а не модуля.
 */
export function buildPluginArtifactMap(pluginsDir, statPlain) {
  const map = new Map();
  const add = (pluginJson, name) => {
    try {
      const manifest = JSON.parse(readFileSync(pluginJson, 'utf8'));
      const plugin = manifest.name;
      if (!plugin) return;
      if (!map.has(plugin)) map.set(plugin, new Set());
      if (name) map.get(plugin).add(String(name));
      if (!name) addWorkflows(pluginJson, manifest, map.get(plugin));
    } catch {
      // unreadable manifest or frontmatter - skipped
    }
  };

  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statPlain(full).isDirectory()) {
        walk(full);
      } else if (entry === 'plugin.json' && basename(dirname(full)) === '.claude-plugin') {
        add(full, null);
      } else if (entry === 'SKILL.md') {
        // <plugin>/skills/<skill>/SKILL.md
        const pj = join(dirname(dirname(dirname(full))), '.claude-plugin', 'plugin.json');
        if (!existsSync(pj)) continue;
        try {
          add(pj, matter(readFileSync(full, 'utf8'), {}).data?.name);
        } catch {
          // unreadable frontmatter - skipped
        }
      } else if (entry.endsWith('.md') && basename(dirname(full)) === 'commands') {
        const pj = join(dirname(dirname(full)), '.claude-plugin', 'plugin.json');
        if (existsSync(pj)) add(pj, basename(full, '.md'));
      } else if (entry.endsWith('.md') && basename(dirname(full)) === 'agents') {
        const pj = join(dirname(dirname(full)), '.claude-plugin', 'plugin.json');
        if (!existsSync(pj)) continue;
        try {
          add(pj, matter(readFileSync(full, 'utf8'), {}).data?.name);
        } catch {
          // unreadable frontmatter - skipped
        }
      }
    }
  }
  walk(pluginsDir);
  return map;
}

const FULL_FORM_RE = /`([a-z][a-z0-9-]*):([a-z][a-z0-9-]*)`/g;

/**
 * Адреса `{plugin}:{skill}` в тексте, у которых плагин известен (есть в карте перечня или в каталоге
 * `catalogPlugins`), а второй половины среди его артефактов нет. Неизвестный плагин не судится:
 * `file:line`, `имя:значение` и прочее двоеточие в бэктиках вызовом скилла не является, а опечатка
 * в самом имени плагина - другая половина адреса, у каждого валидатора со своим правилом.
 * Возвращает [{ ref, plugin, name, has }] без повторов.
 */
export function danglingSkillHalves(text, artifactMap, catalogPlugins = new Set()) {
  const seen = new Set();
  const dangling = [];
  for (const match of text.matchAll(FULL_FORM_RE)) {
    const [, plugin, name] = match;
    const ref = `${plugin}:${name}`;
    if (seen.has(ref)) continue;
    seen.add(ref);
    if (!artifactMap.has(plugin) && !catalogPlugins.has(plugin)) continue;
    const has = artifactMap.get(plugin) ?? new Set();
    if (has.has(name)) continue;
    dangling.push({ ref, plugin, name, has: [...has] });
  }
  return dangling;
}

export function skillHalfMessage({ ref, plugin, name, has }, where = '') {
  const shipped = has.length > 0 ? has.join(', ') : 'nothing';
  return `${where}Referenced skill "${ref}" - plugin "${plugin}" ships no skill, agent, command or track named "${name}" (has: ${shipped}). A typo in the second half of the address leads nowhere, same as an unknown plugin: the load is skipped silently`;
}
