#!/usr/bin/env node
/**
 * Command validator for Claude Code marketplace.
 *
 * Checks commands against the Command Framework (COMMAND_FRAMEWORK.md):
 * frontmatter requirements, size limits, no procedural scripts,
 * no documentation-style content.
 *
 * Usage:
 *   node tools/validate-command.js <path>                 # single file
 *   node tools/validate-command.js all                    # all commands in plugins/
 *
 * Exit codes:
 *   0 - clean
 *   1 - at least one error found
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { basename, join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// MARKETPLACE_ROOT переносит валидатор на дерево-песочницу: tools/test-rules.js
// прогоняет правило на фикстуре, а не на живом каталоге.
const REPO_ROOT = process.env.MARKETPLACE_ROOT
  ? resolve(process.env.MARKETPLACE_ROOT)
  : resolve(__dirname, '..');
const PLUGINS_DIR = join(REPO_ROOT, 'plugins');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

const ERROR = 'error';

// --- CLI parsing --------------------------------------------------------

function parseArgs(argv) {
  const positional = argv.slice(2).filter((a) => !a.startsWith('--'));
  return { target: positional[0] || 'all' };
}

// --- Skill reference validation ------------------------------------------

// Mirrors buildPluginSkillMap in validate-agent.js - same {plugin}:{skill} namespace.
function buildPluginSkillMap() {
  const map = new Map();
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry === 'SKILL.md') {
        const pj = join(dirname(dirname(dirname(full))), '.claude-plugin', 'plugin.json');
        if (!existsSync(pj)) continue;
        try {
          const plugin = JSON.parse(readFileSync(pj, 'utf8')).name;
          const skill = matter(readFileSync(full, 'utf8')).data?.name;
          if (!plugin || !skill) continue;
          if (!map.has(plugin)) map.set(plugin, new Set());
          map.get(plugin).add(String(skill));
        } catch {
          // unreadable manifest or frontmatter - skipped
        }
      }
    }
  }
  walk(PLUGINS_DIR);
  return map;
}

const PLUGIN_SKILLS = buildPluginSkillMap();

// Plugin half not skill-shipping (agent spawn refs, `file:line`) - out of scope, not a Skill call.
function validateSkillReferences(markdownBody, findings) {
  const re = /`([a-z][a-z0-9-]*):([a-z][a-z0-9-]*)`/g;
  const referenced = new Map();
  for (const match of markdownBody.matchAll(re)) {
    referenced.set(`${match[1]}:${match[2]}`, [match[1], match[2]]);
  }

  for (const [ref, [plugin, skill]] of referenced) {
    if (!PLUGIN_SKILLS.has(plugin)) continue;
    if (!PLUGIN_SKILLS.get(plugin).has(skill)) {
      findings.push({
        level: ERROR,
        rule: 'skill-reference-unknown',
        message: `Referenced skill "${ref}" - plugin "${plugin}" ships no skill named "${skill}" (has: ${[...PLUGIN_SKILLS.get(plugin)].join(', ')})`,
      });
    }
  }
}

// Голое имя плагина в теле - указатель на соседа: «этим ведает вон тот», «подробнее там». Загрузкой
// оно не является (загрузка пишется полной формой `plugin:skill`), поэтому обязательства поставки не
// даёт и в замыкание бандла не входит. Но указатель обязан вести в существующее место: имя, которого
// в каталоге нет, читателя никуда не приводит и сгнить успевает молча - полную форму сторожит
// `skill-reference-unknown`, голую до сих пор не сторожил никто.
let catalogPluginsCache = null;
function catalogPlugins() {
  if (catalogPluginsCache) return catalogPluginsCache;
  const file = join(REPO_ROOT, '.claude-plugin', 'marketplace.json');
  try {
    catalogPluginsCache = new Set((JSON.parse(readFileSync(file, 'utf8')).plugins || []).map((p) => p.name));
  } catch {
    catalogPluginsCache = new Set();
  }
  return catalogPluginsCache;
}

function validatePluginNameMentions(text, findings, where = '') {
  const known = catalogPlugins();
  if (known.size === 0) return; // урезанное дерево без marketplace.json - сверять не с чем
  const seen = new Set();
  for (const match of text.matchAll(/`(dex-[a-z0-9-]+)`/g)) {
    const name = match[1];
    if (name.endsWith('-')) continue; // не имя, а префикс-шаблон: `dex-skill-`
    if (known.has(name) || seen.has(name)) continue;
    seen.add(name);
    findings.push({
      level: ERROR,
      rule: 'plugin-name-unknown',
      message: `${where}names "${name}" - no such plugin in the catalogue. A bare name is a pointer, not a load, so it carries no delivery obligation - but a pointer must lead somewhere; the full form is guarded by skill-reference-unknown, the bare one by nothing`,
    });
  }
}

// --- File discovery -----------------------------------------------------

function findAllCommandFiles() {
  const result = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (entry.endsWith('.md') && full.includes('/commands/')) {
        result.push(full);
      }
    }
  }
  walk(PLUGINS_DIR);
  return result.sort();
}

// --- Size limits --------------------------------------------------------

const SIZE_HARD_LIMIT = 200;
const SIZE_RECOMMENDED_MAX = 80;
// 100 - допуск для команд-деклараций pipeline-стадий с гейтами (каждая стадия +
// правило её обязательности), где сжатие ниже 80 ломает однозначность обязательных
// проверок. Не индульгенция на разрастание: точечные команды (/build, /test)
// остаются в цели 20-50 и гейтятся по 80. Allowlist по имени файла команды -
// источник истины (у команд нет frontmatter name, в отличие от skills).
const SIZE_PIPELINE_MAX = 100;
const PIPELINE_COMMANDS = new Set(['mr-analyze', 'mr-apply']);

// --- Frontmatter validation ---------------------------------------------

function validateFrontmatter(parsed, findings) {
  const fm = parsed.data || {};

  if (fm.description == null || fm.description === '') {
    findings.push({
      level: ERROR,
      rule: 'frontmatter-required',
      message: 'Missing required frontmatter field: description',
    });
  }
}

// --- Size validation ----------------------------------------------------

function validateSize(rawContent, findings, isPipeline = false) {
  const lineCount = rawContent.split('\n').length;
  const recommendedMax = isPipeline ? SIZE_PIPELINE_MAX : SIZE_RECOMMENDED_MAX;

  if (lineCount > SIZE_HARD_LIMIT) {
    findings.push({
      level: ERROR,
      rule: 'size-exceeds-hard-limit',
      message: `File is ${lineCount} lines - exceeds hard limit of ${SIZE_HARD_LIMIT}. Commands this large should be agents with phases, not slash-commands`,
    });
  } else if (lineCount > recommendedMax) {
    findings.push({
      level: ERROR,
      rule: 'size-exceeds-recommended',
      message: `File is ${lineCount} lines - exceeds recommended max of ${recommendedMax}. Consider trimming procedural content, bash scripts, or templates`,
    });
  }
}

// --- Procedural body detection ------------------------------------------

function validateNoProcedural(markdownBody, findings) {
  const tree = unified().use(remarkParse).parse(markdownBody);

  visit(tree, 'list', (node) => {
    if (node.ordered === true) {
      const len = node.children?.length ?? 0;
      if (len >= 5) {
        findings.push({
          level: ERROR,
          rule: 'procedural-body',
          message: `Ordered list with ${len} items at line ${node.position?.start?.line ?? '?'} - commands should declare Goal + Output, not step-by-step procedures`,
        });
      }
    }
  });
}

// --- Code fence length --------------------------------------------------

const MAX_CODE_FENCE_LINES = 5;

function validateCodeFences(markdownBody, findings) {
  const tree = unified().use(remarkParse).parse(markdownBody);

  visit(tree, 'code', (node) => {
    const lines = (node.value || '').split('\n').length;
    if (lines > MAX_CODE_FENCE_LINES) {
      findings.push({
        level: ERROR,
        rule: 'code-fence-too-long',
        message: `Code block at line ${node.position?.start?.line ?? '?'} has ${lines} lines - commands describe Goal + Output format, not embed scripts. Claude knows CLI syntax`,
      });
    }
  });
}

// --- Bash script detection ----------------------------------------------

function validateNoBashScripts(markdownBody, findings) {
  const tree = unified().use(remarkParse).parse(markdownBody);
  let bashBlockCount = 0;
  let totalBashLines = 0;

  visit(tree, 'code', (node) => {
    const lang = (node.lang || '').toLowerCase();
    if (lang === 'bash' || lang === 'sh' || lang === 'shell') {
      const lines = (node.value || '').split('\n').length;
      if (lines > 3) {
        bashBlockCount++;
        totalBashLines += lines;
      }
    }
  });

  if (bashBlockCount >= 2 && totalBashLines > 10) {
    findings.push({
      level: ERROR,
      rule: 'bash-script-detected',
      message: `${bashBlockCount} bash blocks with ${totalBashLines} total lines - commands declare what to achieve, not how. Claude knows CLI commands`,
    });
  }
}

// --- Documentation-style titles -----------------------------------------

const DOCUMENTATION_TITLE_PATTERNS = [
  /^как (настроить|использовать|начать|создать|работать|установить)/i,
  /^how to (configure|use|start|create|install|work)/i,
  /^что такое/i,
  /^what is/i,
  /^введение/i,
  /^introduction/i,
  /^getting started/i,
  /^шаг \d/i,
  /^step \d/i,
];

function validateNoDocumentationTitles(markdownBody, findings) {
  const tree = unified().use(remarkParse).parse(markdownBody);

  visit(tree, 'heading', (node) => {
    if (node.depth < 2 || node.depth > 3) return;
    let title = '';
    visit(node, 'text', (t) => {
      title += t.value;
    });
    title = title.trim();
    for (const pattern of DOCUMENTATION_TITLE_PATTERNS) {
      if (pattern.test(title)) {
        findings.push({
          level: ERROR,
          rule: 'documentation-style-title',
          message: `Heading "${title}" (line ${node.position?.start?.line ?? '?'}) looks like documentation - commands describe Goal + Output, not tutorials`,
        });
        break;
      }
    }
  });
}

// --- link escapes the plugin ---------------------------------------------

// Соседний плагин у пользователя ставится сам по себе: `../<плагин>/...` из тела
// артефакта не резолвится ровно так же, как `docs/` каталога. Внутриплагинный
// подъём (`../<соседний скилл>/`) законен и правилом не трогается - решает не
// число `../`, а то, вышел ли разрешённый путь за корень плагина.
const ESCAPING_LINK_RE = /\]\((\.\.\/[^)\s]+)\)/g;

function pluginRootOf(filepath) {
  let dir = dirname(resolve(filepath));
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, '.claude-plugin'))) return dir;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
  return null;
}

function validateLinkEscapesPlugin(text, filepath, findings, where = '') {
  const pluginRoot = pluginRootOf(filepath);
  if (!pluginRoot) return;
  const baseDir = dirname(resolve(filepath));
  const hits = [];
  ESCAPING_LINK_RE.lastIndex = 0;
  for (const m of text.matchAll(ESCAPING_LINK_RE)) {
    if (relative(pluginRoot, resolve(baseDir, m[1])).startsWith('..')) hits.push(m[1]);
  }
  if (hits.length === 0) return;
  const shown = hits.slice(0, 3).join(', ');
  findings.push({
    level: ERROR,
    rule: 'link-escapes-plugin',
    message: `${where}link leaves the plugin directory (${shown}${hits.length > 3 ? `, +${hits.length - 3} more` : ''}) - a neighbouring plugin is installed on its own, so the path does not resolve at runtime. Name the neighbour instead: {plugin}:{skill}`,
  });
}

// --- catalog docs link ---------------------------------------------------

// `docs/` каталога - дизайн-тайм: он нормирует авторство артефактов и в установленный плагин не
// входит. Адрес такого документа в теле хуже отсутствия адреса: он выглядит валидным, а исполнитель
// либо молча его не открывает, либо сочиняет содержимое. Норма, нужная в рантайме, живёт в самом
// артефакте либо в скилле, который у пользователя установлен.

// Ключ у правила один - адресат: документ, который РЕАЛЬНО существует в `docs/` каталога. Форма
// записи ключом не служит - код-спан и проза уводят исполнителя туда же, куда markdown-ссылка.
// Шаблоны формы работают на текст сообщения: назвать место в тексте и то, что относительная ссылка
// не разрешается даже в клоне. Обратная сторона того же ключа: путь, которого в `docs/` каталога нет
// (`docs/discover/README.md` как выход агента в проекте пользователя), не покрыт ни в одной форме -
// он адресует чужой корпус.
const CATALOG_DOCS_LINK_FORMS = [
  /https?:\/\/github\.com\/dex-it\/claude-code-marketplace\/\S*?\/docs\/[^\s)\]]+/g,
  /\]\((?:\.{1,2}\/)*docs\/[^)\s]+\)/g,
];

// Каталоги, которые каталог сам раздаёт пользователю: `project-docs-map` несёт дефолты
// `product: docs/product/` и `domain: docs/domain/` как адрес корпуса уровня 0 ЕГО проекта. Путь под
// ними в теле артефакта именует чужой документ, а не наш, - из-под правила выведен.
const USER_CORPUS_DIRS = new Set(['product', 'domain']);

let catalogDocTargetsCache = null;
function catalogDocTargets() {
  if (catalogDocTargetsCache) return catalogDocTargetsCache;
  const paths = new Set();
  const names = new Set();
  const walk = (dir, rel) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      const relPath = rel ? `${rel}/${entry}` : entry;
      if (statSync(full).isDirectory()) {
        if (!rel && USER_CORPUS_DIRS.has(entry)) continue;
        walk(full, relPath);
        continue;
      }
      if (!entry.endsWith('.md')) continue;
      paths.add(`docs/${relPath}`);
      // Голым именем адресуются доки-фреймворки каталога, а они лежат на верхнем уровне `docs/`.
      // Ниже - внутренние дизайн-доки (`ARCHITECTURE.md`, `PIPELINE.md`), и такое имя носит документ
      // пользователя не реже нашего: на нём правило ловило бы чужой файл.
      if (!rel && /^[A-Z][A-Z0-9_]*\.md$/.test(entry) && entry !== 'README.md') names.add(entry);
    }
  };
  walk(join(REPO_ROOT, 'docs'), '');
  catalogDocTargetsCache = { paths: [...paths], names: [...names] };
  return catalogDocTargetsCache;
}

// Матч по границе, а не подстрокой: `MY_PIPELINE.md` не адресует `PIPELINE.md`. Слева у пути `/`
// допустим (адрес внутри URL), у голого имени - нет: там `/` значит, что имя уже часть пути и
// посчитано путём.
function mentionsTarget(text, target, slashBefore) {
  const before = slashBefore ? '(?<![\\w.-])' : '(?<![\\w./-])';
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${before}${escaped}(?![\\w])`).test(text);
}

// Авторские плагины: их артефакты исполняются в клоне каталога, где `docs/` лежит рядом, поэтому
// адрес у них разрешается и правило к ним не применяется. Читается `authorOnly[]`, а не весь состав
// бандла автора: в состав попадают и плагины замыкания (`dependencies[]`: `artifact-review` грузит
// `fact-verification` и `optimize-for-llm`), а они едут пользователю в бандлах ролей, где `docs/`
// каталога нет. Разъезд списка с составами бандлов ловит `validate-bundle.js` (`author-only-*`).
const AUTHOR_BUNDLE_JSON = 'plugins/bundles/dex-bundle-market-editor/bundle.json';
let authorPluginsCache = null;
function authorPlugins() {
  if (authorPluginsCache) return authorPluginsCache;
  authorPluginsCache = new Set();
  try {
    const json = JSON.parse(readFileSync(join(REPO_ROOT, AUTHOR_BUNDLE_JSON), 'utf8'));
    for (const name of json.authorOnly || []) authorPluginsCache.add(name);
  } catch {
    // бандла нет (песочница фикстур, урезанное дерево) - исключений нет
  }
  return authorPluginsCache;
}

// Имя плагина, которому принадлежит файл: ближайший вверх каталог с `.claude-plugin/plugin.json`.
function pluginNameOf(filepath) {
  let dir = dirname(resolve(filepath));
  while (dir !== dirname(dir)) {
    const manifest = join(dir, '.claude-plugin', 'plugin.json');
    if (existsSync(manifest)) {
      try {
        return JSON.parse(readFileSync(manifest, 'utf8')).name || basename(dir);
      } catch {
        return basename(dir);
      }
    }
    dir = dirname(dir);
  }
  return null;
}

function validateCatalogDocsLink(text, filepath, findings, where = '') {
  if (authorPlugins().has(pluginNameOf(filepath))) return;

  const { paths, names } = catalogDocTargets();
  const named = [];
  for (const target of paths) {
    if (mentionsTarget(text, target, true)) named.push(target);
  }
  for (const target of names) {
    if (!mentionsTarget(text, target, false)) continue;
    if (named.some((t) => t.endsWith(`/${target}`))) continue;
    named.push(target);
  }
  if (named.length === 0) return;

  const forms = [];
  for (const re of CATALOG_DOCS_LINK_FORMS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      // Хвостовая пунктуация предложения в адрес не входит.
      const form = m[0].replace(/[.,;:]+$/, '');
      if (named.some((t) => form.includes(t))) forms.push(form);
    }
  }
  const shown = named.slice(0, 3).join(', ');
  const asLink =
    forms.length > 0
      ? ` Here it is written as a link (${forms.slice(0, 2).join(', ')}), which misses even in a clone - a relative link resolves from the artifact's own directory.`
      : '';
  findings.push({
    level: ERROR,
    rule: 'catalog-docs-link',
    message: `${where}names a catalog docs/ document (${shown}${named.length > 3 ? `, +${named.length - 3} more` : ''}) - naming it in any form (code span, prose, link) sends the executor to a file the plugin does not ship.${asLink} Carry the norm in the artifact itself or in a skill the user has installed; author-only artifacts belong in dex-bundle-market-editor`,
  });
}

// --- File validation orchestration --------------------------------------

function validateFile(filepath) {
  const findings = [];
  let parsed;
  let raw;

  try {
    raw = readFileSync(filepath, 'utf8');
    parsed = matter(raw);
  } catch (e) {
    return {
      filepath,
      findings: [
        { level: ERROR, rule: 'read-failed', message: `Failed to read file: ${e.message}` },
      ],
    };
  }

  validateFrontmatter(parsed, findings);
  validateSize(raw, findings, PIPELINE_COMMANDS.has(basename(filepath, '.md')));
  validateNoProcedural(parsed.content, findings);
  validateCodeFences(parsed.content, findings);
  validateNoBashScripts(parsed.content, findings);
  validateNoDocumentationTitles(parsed.content, findings);
  validateSkillReferences(parsed.content, findings);
  validateCatalogDocsLink(raw, filepath, findings);
  validatePluginNameMentions(raw, findings);
  validateLinkEscapesPlugin(raw, filepath, findings);

  return { filepath, findings };
}

// --- Reporting ----------------------------------------------------------

function formatFinding(f) {
  return `  ${COLORS.red}ERROR${COLORS.reset} ${COLORS.gray}[${f.rule}]${COLORS.reset} ${f.message}`;
}

function report(results) {
  let totalErrors = 0;
  let filesWithIssues = 0;

  for (const result of results) {
    if (result.findings.length === 0) continue;

    totalErrors += result.findings.length;
    filesWithIssues += 1;
    const rel = relative(REPO_ROOT, result.filepath);
    console.log(`\n${COLORS.bold}${rel}${COLORS.reset}`);
    for (const f of result.findings) console.log(formatFinding(f));
  }

  console.log('');
  console.log(
    `${COLORS.bold}Summary:${COLORS.reset} ${results.length} command(s) checked, ` +
      `${COLORS.red}${totalErrors} error(s)${COLORS.reset}` +
      (filesWithIssues > 0 ? `, ${filesWithIssues} file(s) with issues` : '')
  );

  return totalErrors > 0 ? 1 : 0;
}

// --- Main ---------------------------------------------------------------

function main() {
  const { target } = parseArgs(process.argv);

  let files;
  if (target === 'all') {
    files = findAllCommandFiles();
    if (files.length === 0) {
      console.error(`No command files found under ${relative(REPO_ROOT, PLUGINS_DIR)}`);
      process.exit(1);
    }
  } else {
    const abs = resolve(target);
    if (!existsSync(abs)) {
      console.error(`File not found: ${target}`);
      process.exit(1);
    }
    files = [abs];
  }

  const results = files.map((f) => validateFile(f));
  process.exit(report(results));
}

main();
