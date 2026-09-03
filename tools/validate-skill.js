#!/usr/bin/env node
/**
 * Skill validator for Claude Code marketplace.
 *
 * Checks skills against the Skill Framework (SKILL_FRAMEWORK.md):
 * frontmatter requirements, description with trigger keywords,
 * declarative anti-pattern format (Плохо/Правильно/Почему),
 * size limits, pointer-not-code principle.
 *
 * Usage:
 *   node tools/validate-skill.js <path>                 # single file
 *   node tools/validate-skill.js all                    # all skills under plugins/
 *
 * Exit codes:
 *   0 - clean
 *   1 - at least one error found
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// MARKETPLACE_ROOT переносит валидатор на дерево-песочницу: tools/test-rules.js
// прогоняет правило на фикстуре, а не на живом каталоге.
const REPO_ROOT = process.env.MARKETPLACE_ROOT
  ? resolve(process.env.MARKETPLACE_ROOT)
  : resolve(__dirname, '..');
// Сканируем весь plugins/ (не только plugins/skills): скиллы живут и в других
// группах-папках (например plugins/ai-sdlc). Обход по SKILL.md покрывает
// любую папку без правки валидатора при переносе плагина.
const SKILLS_DIR = join(REPO_ROOT, 'plugins');
const MARKETPLACE_JSON = join(REPO_ROOT, '.claude-plugin', 'marketplace.json');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

const ERROR = 'error';
const WARNING = 'warning';

// --- CLI parsing --------------------------------------------------------

function parseArgs(argv) {
  const positional = argv.slice(2).filter((a) => !a.startsWith('--'));
  return { target: positional[0] || 'all' };
}

// --- Marketplace data ---------------------------------------------------

function loadMarketplacePlugins() {
  if (!existsSync(MARKETPLACE_JSON)) return new Set();
  try {
    const json = JSON.parse(readFileSync(MARKETPLACE_JSON, 'utf8'));
    return new Set((json.plugins || []).map((p) => p.name));
  } catch {
    return new Set();
  }
}

// Голое имя плагина в теле - указатель на соседа: «этим ведает вон тот», «подробнее там». Загрузкой
// оно не является (загрузка пишется полной формой `plugin:skill`), поэтому обязательства поставки не
// даёт и в замыкание бандла не входит. Но указатель обязан вести в существующее место: имя, которого
// в каталоге нет, читателя никуда не приводит и сгнить успевает молча, а голую форму до сих пор не
// сторожил никто. Полную форму в теле скилла не сторожит ничто: `skill-reference-unknown` в этом
// валидаторе не заведён, а замыкание бандла фильтрует цели по плагинам репозитория и имя, которого
// нет, из графа теряет - проверено подстановкой на живом дереве, остаток вынесен в issue #220.
let catalogPluginsCache = null;
function catalogPlugins() {
  if (!catalogPluginsCache) catalogPluginsCache = loadMarketplacePlugins();
  return catalogPluginsCache;
}

function validatePluginNameMentions(text, findings, where = '') {
  const known = catalogPlugins();
  if (known.size === 0) return; // каталога нет - имя не «неизвестно», а непроверяемо: сверять не с чем
  const seen = new Set();
  for (const match of text.matchAll(/`(dex-[a-z0-9-]+)`/g)) {
    const name = match[1];
    if (name.endsWith('-')) continue; // не имя, а префикс-шаблон: `dex-skill-`
    if (known.has(name) || seen.has(name)) continue;
    seen.add(name);
    findings.push({
      level: ERROR,
      rule: 'plugin-name-unknown',
      message: `${where}names "${name}" - no such plugin in the catalogue. A bare name is a pointer, not a load, so it carries no delivery obligation - but a pointer must lead somewhere, and a name that leads nowhere rots silently; this rule is the guard of the bare form`,
    });
  }
}

// --- File discovery -----------------------------------------------------

function findAllSkillFiles() {
  const result = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (entry === 'SKILL.md') result.push(full);
    }
  }
  walk(SKILLS_DIR);
  return result.sort();
}

// --- Size limits --------------------------------------------------------

// Пороги размера парны с docs/SKILL_FRAMEWORK.md, раздел "Размер skill" - это их нормативный дом.
// Прозаическую копию числа держит только он; меняешь порог - правишь оба места одним коммитом.
const CLAUDE_CODE_HARD_LIMIT = 500; // Anthropic recommendation ("Keep SKILL.md under 500 lines") - not an enforced platform truncation limit
const PROJECT_RECOMMENDED_MAX = 250; // project line-count guideline (trap-skill: цель 80-120)
// Верхний порог общий для обоих типов: рекомендация Anthropic названа в строках и типа skill не
// различает. Process-skill освобождён только от проектного trap-порога (250) - костяк движка не
// дробится на каталог ловушек; от платформенного потолка не освобождён никто, деталь по требованию
// выносится в references/ (файлы оттуда в счёт не идут и контекст не тратят, пока не прочитаны).
const PROJECT_TARGET_MAX = 120; // ideal range

// Мера в строках цену окна не ограничивает: плотность строки в каталоге различается кратно.
// После компакта возвращаются первые 5000 токенов скилла, и обрубок неотличим от целого.
// Числа назначены оператором; замер плотности и основание порога - docs/SKILL_FRAMEWORK.md,
// раздел «Размер skill».
const CHARS_HARD_LIMIT = 42000;
const CHARS_RECOMMENDED_MAX = 30000;

// --- Frontmatter validation ---------------------------------------------

const REQUIRED_FIELDS = ['name', 'description'];
const FORBIDDEN_FIELDS = ['keywords'];
const MIN_DESCRIPTION_LENGTH = 50;
const CLAUDE_DESCRIPTION_HARD_LIMIT = 1536; // Claude Code per-entry listing cap, default (description + when_to_use) - error
const PROJECT_DESCRIPTION_MAX = 750; // project hard cap - error
const WARN_DESCRIPTION_LENGTH = 500; // project soft guideline - warning
const MIN_TRIGGER_KEYWORDS = 10;

/**
 * Process / orchestration skills encode a workflow rule (e.g. "new project ->
 * inherit solution rules") or a registry, not a catalogue of API traps. The trap
 * heuristics (count + Плохо/Правильно/Почему triad) don't apply, so validateTraps
 * skips them entirely; instead validateProcessStructure enforces a content floor
 * (a table or >=2 H2 sections) so the exemption can't shelter a stub. Keyword-count,
 * size and description limits stay strict - activation must still be reliable.
 *
 * Registration is an explicit allowlist by skill name, not a self-declared
 * marker: adding a process skill requires a deliberate edit here plus review,
 * so the exemption can't be abused to slip an under-built skill through. The
 * `<!-- skill-type: process -->` marker in the body is for human readers only -
 * this allowlist is the source of truth. See docs/SKILL_FRAMEWORK.md "Типы skill".
 */
const PROCESS_SKILLS = new Set([
  'project-baseline',
  'stack-registry',
  'completeness-mapping',
  'optimize-for-llm',
  'node-contract',
  'test-coverage',
  'legacy-reconstruction',
  'project-docs-map',
  'docs-layout',
  'artifact-review',
  'business-analysis-29148',
  'system-requirements-29148',
  'architecture-definition-42010',
  'interface-definition-openapi',
  'verification-planning-29119',
  'use-cases-cockburn',
  'bdd-gherkin',
  'opportunity-canvas',
  'engine',
  'analytics-track',
  'product-track',
  'development-track',
  'architecture-track',
  'bugfix-track',
  'followup-track',
  'acceptance-track',
  'discover-track',
  'test-track',
  'mr-review-track',
  'issue-tracking',
  'documentation-track',
  'diagnostics-track',
  'idea-forming',
  'project-rulebook',
  'rulebook-track',
]);

function isProcessSkill(parsed) {
  return PROCESS_SKILLS.has(parsed.data && parsed.data.name);
}

// SKILL_FRAMEWORK.md "оркестрация - в скилле, исполнение - в агенте": обычному
// process-skill спавнить агентов не положено. Ручной allowlist, как PROCESS_SKILLS.
const ORCHESTRATOR_SKILLS = new Set([
  'engine',
  'analytics-track',
  'product-track',
  'development-track',
  'architecture-track',
  'acceptance-track',
  'discover-track',
  'followup-track',
  'bugfix-track',
  'test-track',
  'mr-review-track',
  'documentation-track',
  'diagnostics-track',
  'rulebook-track',
]);

// Эвристика best-effort: глагол делегирования рядом с бэктик-ссылкой на агента/Agent
// в одном блоке. Молчание не значит "не оркестрирует": глагол вне словаря либо короткое
// имя агента без dex-plugin:-префикса эвристику не поднимают.
// Префикс dex-skill- исключён: агентов в этих плагинах нет ни одного, значит совпадение
// с ним - всегда ссылка на скилл, и глагол делегирования рядом с ней даёт ложное
// срабатывание (unit-identity/SKILL.md:45).
const ORCHESTRATION_VERB_RE = /спавн|делегир|вызыва[ею]т|чинит/i;
const AGENT_MENTION_RE = /`(?:dex-(?!skill-)[a-z0-9-]+:[a-z0-9-]+|Agent)`/;

function validateOrchestratorRegistration(parsed, markdownBody, findings, isProcess) {
  const name = parsed.data && parsed.data.name;
  if (ORCHESTRATOR_SKILLS.has(name)) return;

  const tree = parseMarkdown(markdownBody);
  const lines = markdownBody.split('\n');
  let fired = false;

  visit(tree, (node) => node.type === 'paragraph' || node.type === 'heading', (node) => {
    if (fired || !node.position) return;
    const text = lines.slice(node.position.start.line - 1, node.position.end.line).join('\n');
    if (ORCHESTRATION_VERB_RE.test(text) && AGENT_MENTION_RE.test(text)) fired = true;
  });

  if (fired) {
    findings.push({
      level: ERROR,
      rule: 'orchestrator-unregistered',
      message: `${isProcess ? 'Process skill' : 'Skill'} "${name}" reads as spawning/delegating to an agent (delegation verb next to an agent/Agent-tool reference) but is not in ORCHESTRATOR_SKILLS - register it if it genuinely orchestrates the zone, or reword to remove the delegation language if it doesn't`,
    });
  }
}

function validateFrontmatter(parsed, findings, isProcess = false) {
  const fm = parsed.data || {};

  for (const field of REQUIRED_FIELDS) {
    if (fm[field] == null || fm[field] === '') {
      findings.push({
        level: ERROR,
        rule: 'frontmatter-required',
        message: `Missing required frontmatter field: ${field}`,
      });
    }
  }

  for (const field of FORBIDDEN_FIELDS) {
    if (field in fm) {
      findings.push({
        level: ERROR,
        rule: 'frontmatter-forbidden',
        message: `Forbidden frontmatter field: ${field} - not supported by Claude Code for skills`,
      });
    }
  }

  const desc = fm.description;
  if (typeof desc !== 'string') return;

  if (desc.length < MIN_DESCRIPTION_LENGTH) {
    findings.push({
      level: ERROR,
      rule: 'description-short',
      message: `Description shorter than ${MIN_DESCRIPTION_LENGTH} characters - likely missing trigger keywords`,
    });
  }

  if (desc.length > CLAUDE_DESCRIPTION_HARD_LIMIT) {
    findings.push({
      level: ERROR,
      rule: 'description-exceeds-claude-limit',
      message: `Description is ${desc.length} characters - exceeds the Claude Code per-entry listing cap of ${CLAUDE_DESCRIPTION_HARD_LIMIT} (the cap covers description + when_to_use). Text beyond it is truncated from the skill listing and will not activate the skill. Cut to the project cap of ${PROJECT_DESCRIPTION_MAX}: drop entry points, keep the technology anchor and aspect names`,
    });
  } else if (desc.length > PROJECT_DESCRIPTION_MAX) {
    findings.push({
      level: ERROR,
      rule: 'description-too-long',
      message: `Description is ${desc.length} characters - exceeds project cap of ${PROJECT_DESCRIPTION_MAX}. Cut entry points (concrete APIs/symptoms inside traps); keep only the technology anchor and aspect names`,
    });
  } else if (desc.length > WARN_DESCRIPTION_LENGTH) {
    findings.push({
      level: WARNING,
      rule: 'description-long',
      message: `Description is ${desc.length} characters - exceeds project guideline of ${WARN_DESCRIPTION_LENGTH}. A compact description triggers more reliably; cut entry points, keep aspects`,
    });
  }

  // Activation keywords drive SEMANTIC auto-activation. A process skill is loaded
  // imperatively by name (agent body calls the Skill tool with plugin:skill), so
  // auto-activation is secondary for it - same rationale as the trap-heuristic
  // exemption. There is no documented frontmatter field that disables only
  // auto-activation while keeping by-name Skill-tool loading (disable-model-invocation
  // behaviour on programmatic invocation is undocumented), so the description is not
  // dropped - only the activation floor is relaxed from ERROR to WARNING for process
  // skills. Trap/leaf skills keep the hard ERROR (auto-activation is their primary path).
  const activationLevel = isProcess ? WARNING : ERROR;

  // description must contain explicit activation phrase
  const hasActivation = /активируется при|triggers?\b|trigger(ed)? (on|by|when)/i.test(desc);
  if (!hasActivation) {
    findings.push({
      level: activationLevel,
      rule: 'description-no-activation',
      message: `Description must contain "Активируется при" (or "Triggers") followed by keywords - the mechanism for semantic activation`,
    });
    return;
  }

  // extract part after "Активируется при" / "Triggers" and count comma-separated keywords
  const activationMatch = desc.match(/(?:активируется при|triggers?)[:\s-]+([\s\S]+)$/i);
  if (activationMatch) {
    const keywordPart = activationMatch[1];
    const keywords = keywordPart
      .split(/[,;]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    if (keywords.length < MIN_TRIGGER_KEYWORDS) {
      findings.push({
        level: activationLevel,
        rule: 'description-few-keywords',
        message: `Description has only ${keywords.length} trigger keyword(s) after "Активируется при" - ${MIN_TRIGGER_KEYWORDS}+ recommended for reliable semantic activation`,
      });
    }
  }
}

// --- Body size check ----------------------------------------------------

function validateSize(rawContent, findings, isProcess = false) {
  const lineCount = rawContent.split('\n').length;

  if (lineCount > CLAUDE_CODE_HARD_LIMIT) {
    findings.push({
      level: ERROR,
      rule: 'size-exceeds-hard-limit',
      message: `File is ${lineCount} lines - exceeds Anthropic recommendation of ${CLAUDE_CODE_HARD_LIMIT} ("Keep SKILL.md under 500 lines"). Move detailed material to references/ - those files are not counted`,
    });
    return;
  }

  if (!isProcess && lineCount > PROJECT_RECOMMENDED_MAX) {
    findings.push({
      level: ERROR,
      rule: 'size-exceeds-recommended',
      message: `File is ${lineCount} lines - exceeds project recommendation of ${PROJECT_RECOMMENDED_MAX}. Consider splitting or cutting documentation/procedures`,
    });
  }

  const charCount = rawContent.length;

  if (charCount > CHARS_HARD_LIMIT) {
    findings.push({
      level: ERROR,
      rule: 'chars-exceed-hard-limit',
      message: `File is ${charCount} characters (~${Math.round(charCount / 3000)}k tokens) - exceeds ${CHARS_HARD_LIMIT}. The line limit does not bound window cost: move detailed material to references/, those files are not counted`,
    });
    return;
  }

  if (charCount > CHARS_RECOMMENDED_MAX) {
    findings.push({
      level: WARNING,
      rule: 'chars-exceed-recommended',
      message: `File is ${charCount} characters (~${Math.round(charCount / 3000)}k tokens) - above the ${CHARS_RECOMMENDED_MAX} guideline. Cut or move to references/ before it reaches the ${CHARS_HARD_LIMIT} hard limit`,
    });
  }
}

// --- references/ size check ----------------------------------------------

// Файл references/ читается по требованию и в счёт тела не идёт: мера отдельная, только
// предупреждающая - жёсткого потолка у неё нет. Состав выноса согласуется с владельцем
// артефакта, счётчик его не режет.
function validateReferenceSize(skillFilePath, findings) {
  const dir = join(dirname(skillFilePath), 'references');
  if (!existsSync(dir)) return;
  let dirChars = 0;
  let fileCount = 0;
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (!statSync(full).isFile() || !entry.endsWith('.md')) continue;
    const body = readFileSync(full, 'utf8');
    validateCatalogDocsLink(body, full, findings, `references/${entry} `);
    validatePluginNameMentions(body, findings, `references/${entry} `);
    validateLinkEscapesPlugin(body, full, findings, `references/${entry} `);
    const charCount = body.length;
    dirChars += charCount;
    fileCount += 1;
    if (charCount <= CHARS_RECOMMENDED_MAX) continue;
    findings.push({
      level: WARNING,
      rule: 'reference-chars-exceed-recommended',
      message: `references/${entry} is ${charCount} characters (~${Math.round(charCount / 3000)}k tokens) - above the ${CHARS_RECOMMENDED_MAX} guideline. Not counted in the body limit and not blocking: raise it at review`,
    });
  }
  // Пофайловая мера обходится разбиением: тот же материал в двух файлах молчит,
  // а цена чтения лежит на директории. Порог тот же, своего числа у суммы нет.
  if (dirChars > CHARS_RECOMMENDED_MAX) {
    findings.push({
      level: WARNING,
      rule: 'reference-dir-chars-exceed-recommended',
      message: `references/ holds ${dirChars} characters (~${Math.round(dirChars / 3000)}k tokens) across ${fileCount} file(s) - above the same ${CHARS_RECOMMENDED_MAX} guideline the body uses. Splitting a file does not lower the cost: raise the directory at review`,
    });
  }
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

// --- Markdown parsing ---------------------------------------------------

/**
 * Single source of the markdown parser so every check sees the same AST.
 * remark-gfm is required for `table` nodes - without it GFM tables parse as
 * plain paragraphs and validateProcessStructure's table branch goes dead.
 */
function parseMarkdown(markdownBody) {
  return unified().use(remarkParse).use(remarkGfm).parse(markdownBody);
}

// --- Trap structure validation ------------------------------------------

/**
 * Parse markdown body and extract H3 sections (traps). Each trap must follow
 * the "Плохо / Правильно / Почему" triad.
 */
function extractTraps(markdownBody) {
  const tree = parseMarkdown(markdownBody);
  const traps = [];
  let currentTrap = null;

  function headingText(node) {
    let t = '';
    visit(node, 'text', (child) => {
      t += child.value;
    });
    return t.trim();
  }

  for (const node of tree.children) {
    if (node.type === 'heading' && node.depth === 3) {
      if (currentTrap) traps.push(currentTrap);
      currentTrap = {
        title: headingText(node),
        startLine: node.position?.start?.line ?? 0,
        nodes: [],
      };
    } else if (node.type === 'heading' && node.depth === 2) {
      if (currentTrap) {
        traps.push(currentTrap);
        currentTrap = null;
      }
    } else if (currentTrap) {
      currentTrap.nodes.push(node);
    }
  }

  if (currentTrap) traps.push(currentTrap);
  return traps;
}

function nodeText(node) {
  let t = '';
  visit(node, 'text', (child) => {
    t += child.value;
  });
  return t;
}

function trapBodyText(trap) {
  return trap.nodes.map(nodeText).join('\n');
}

function validateTraps(markdownBody, findings, isProcess = false) {
  // Process skills encode orchestration rules (registry, decision forks), not a
  // catalogue of API traps. The trap heuristics (count + Плохо/Правильно/Почему
  // triad) don't apply to them - structure is checked by validateProcessStructure
  // instead. Triads remain *allowed* in a process skill (e.g. decision forks in
  // project-baseline), just not *required*.
  if (isProcess) return;

  const traps = extractTraps(markdownBody);

  if (traps.length < 5) {
    findings.push({
      level: ERROR,
      rule: 'too-few-traps',
      message: `Skill has only ${traps.length} H3 sections - framework recommends 10-15 traps per skill`,
    });
  }

  for (const trap of traps) {
    const body = trapBodyText(trap).toLowerCase();

    const hasBad = /плохо|неправильно|bad|wrong/i.test(body);
    const hasGood = /правильно|good|correct/i.test(body);
    const hasWhy = /почему|why|причина|reason/i.test(body);

    const missing = [];
    if (!hasBad) missing.push('Плохо');
    if (!hasGood) missing.push('Правильно');
    if (!hasWhy) missing.push('Почему');

    if (missing.length > 0) {
      findings.push({
        level: ERROR,
        rule: 'trap-missing-triad',
        message: `Trap "${trap.title}" (line ${trap.startLine}) is missing: ${missing.join(', ')} - framework mandates "Плохо / Правильно / Почему" triad`,
      });
    }
  }
}

// --- Process structure validation ---------------------------------------

/**
 * A process skill is exempt from trap heuristics, so it needs its own floor to
 * stop an empty/under-built skill from slipping through on the exemption alone.
 * It must carry actual orchestration content: a registry table OR at least two
 * H2 rule/decision sections. Below that it's not a process skill - it's a stub.
 */
const MIN_PROCESS_H2_SECTIONS = 2;

function validateProcessStructure(markdownBody, findings) {
  const tree = parseMarkdown(markdownBody);

  let h2Count = 0;
  let hasTable = false;
  visit(tree, 'heading', (node) => {
    if (node.depth === 2) h2Count += 1;
  });
  visit(tree, 'table', () => {
    hasTable = true;
  });

  if (!hasTable && h2Count < MIN_PROCESS_H2_SECTIONS) {
    findings.push({
      level: ERROR,
      rule: 'process-empty',
      message: `Process skill has no registry table and only ${h2Count} H2 section(s) - a process skill must encode orchestration content (a table or at least ${MIN_PROCESS_H2_SECTIONS} rule/decision sections), otherwise it's a stub exploiting the trap exemption`,
    });
  }
}

// --- Pointer-not-code validation ----------------------------------------

const MAX_CODE_FENCE_LINES = 12;

function validateCodeFences(markdownBody, findings) {
  const tree = parseMarkdown(markdownBody);

  visit(tree, 'code', (node) => {
    const lines = (node.value || '').split('\n').length;
    if (lines > MAX_CODE_FENCE_LINES) {
      findings.push({
        level: ERROR,
        rule: 'code-fence-too-long',
        message: `Code block at line ${node.position?.start?.line ?? '?'} has ${lines} lines - framework principle "pointer, not road" recommends max ${MAX_CODE_FENCE_LINES} lines. Replace with API name / condition reference`,
      });
    }
  });
}

// --- Forbidden documentation-style section titles ------------------------

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
  const tree = parseMarkdown(markdownBody);

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
          message: `Heading "${title}" (line ${node.position?.start?.line ?? '?'}) looks like documentation ("how to X", "what is Y", "step N") - framework mandates traps/anti-patterns, not tutorials`,
        });
        break;
      }
    }
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

  const isProcess = isProcessSkill(parsed);

  validateFrontmatter(parsed, findings, isProcess);
  validateSize(raw, findings, isProcess);
  validateCatalogDocsLink(raw, filepath, findings);
  validatePluginNameMentions(raw, findings);
  validateLinkEscapesPlugin(raw, filepath, findings);
  validateReferenceSize(filepath, findings);
  validateTraps(parsed.content, findings, isProcess);
  if (isProcess) {
    validateProcessStructure(parsed.content, findings);
  }
  validateOrchestratorRegistration(parsed, parsed.content, findings, isProcess);
  validateCodeFences(parsed.content, findings);
  validateNoDocumentationTitles(parsed.content, findings);

  return { filepath, findings };
}

// --- Reporting ----------------------------------------------------------

function formatFinding(f) {
  const isWarning = f.level === WARNING;
  const color = isWarning ? COLORS.yellow : COLORS.red;
  const label = isWarning ? 'WARN ' : 'ERROR';
  return `  ${color}${label}${COLORS.reset} ${COLORS.gray}[${f.rule}]${COLORS.reset} ${f.message}`;
}

function report(results) {
  let totalErrors = 0;
  let totalWarnings = 0;
  let filesWithIssues = 0;

  for (const result of results) {
    if (result.findings.length === 0) continue;

    totalErrors += result.findings.filter((f) => f.level !== WARNING).length;
    totalWarnings += result.findings.filter((f) => f.level === WARNING).length;
    filesWithIssues += 1;
    const rel = relative(REPO_ROOT, result.filepath);
    console.log(`\n${COLORS.bold}${rel}${COLORS.reset}`);
    for (const f of result.findings) console.log(formatFinding(f));
  }

  console.log('');
  console.log(
    `${COLORS.bold}Summary:${COLORS.reset} ${results.length} skill(s) checked, ` +
      `${COLORS.red}${totalErrors} error(s)${COLORS.reset}, ` +
      `${COLORS.yellow}${totalWarnings} warning(s)${COLORS.reset}` +
      (filesWithIssues > 0 ? `, ${filesWithIssues} file(s) with issues` : '')
  );

  return totalErrors > 0 ? 1 : 0;
}

// --- Main ---------------------------------------------------------------

function main() {
  const { target } = parseArgs(process.argv);

  let files;
  if (target === 'all') {
    files = findAllSkillFiles();
    if (files.length === 0) {
      console.error(`No skill files found under ${relative(REPO_ROOT, SKILLS_DIR)}`);
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
