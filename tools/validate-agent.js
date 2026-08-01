#!/usr/bin/env node
/**
 * Agent validator for Claude Code marketplace.
 *
 * Checks agents against the Agent Framework (AGENT_FRAMEWORK.md):
 * frontmatter requirements, declarative phase structure, observable exit
 * criteria, referenced skill names existing in marketplace.json.
 *
 * Usage:
 *   node tools/validate-agent.js <path>                 # single file
 *   node tools/validate-agent.js all                    # all agents in plugins/specialists
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
import { visit } from 'unist-util-visit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// MARKETPLACE_ROOT переносит валидатор на дерево-песочницу: tools/test-rules.js
// прогоняет правило на фикстуре, а не на живом каталоге.
const REPO_ROOT = process.env.MARKETPLACE_ROOT
  ? resolve(process.env.MARKETPLACE_ROOT)
  : resolve(__dirname, '..');
const SPECIALISTS_DIR = join(REPO_ROOT, 'plugins', 'specialists');
const MARKETPLACE_JSON = join(REPO_ROOT, '.claude-plugin', 'marketplace.json');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

// --- CLI parsing --------------------------------------------------------

function parseArgs(argv) {
  const positional = argv.slice(2).filter((a) => !a.startsWith('--'));
  return { target: positional[0] || 'all' };
}

// --- Marketplace data ---------------------------------------------------

function loadMarketplacePlugins() {
  if (!existsSync(MARKETPLACE_JSON)) {
    return new Set();
  }
  try {
    const json = JSON.parse(readFileSync(MARKETPLACE_JSON, 'utf8'));
    const names = (json.plugins || []).map((p) => p.name);
    return new Set(names);
  } catch {
    return new Set();
  }
}

// --- File discovery -----------------------------------------------------

function findAllAgentFiles() {
  const result = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (entry.endsWith('.md') && full.includes('/agents/')) {
        result.push(full);
      }
    }
  }
  walk(SPECIALISTS_DIR);
  return result.sort();
}

// --- Validation rules ---------------------------------------------------

const ERROR = 'error';
const WARNING = 'warning';

// Description length thresholds (project guidelines - Claude Code does not
// document a platform limit for subagent `description`, so these are ours, not
// a platform hard limit). The agent description sits in the session system
// prompt of every session where the plugin is installed, so a bloated one is a
// standing context tax; a compact one matches more reliably.
const WARN_DESCRIPTION_LENGTH = 500; // project soft guideline - warning
const PROJECT_DESCRIPTION_MAX = 750; // project hard cap - error

/**
 * Blacklisted phrases in exit criteria - they describe internal state,
 * not observable outcomes. Framework forbids them.
 */
const NON_OBSERVABLE_PHRASES = [
  'агент понял',
  'agent understood',
  'анализ завершён',
  'анализ завершен',
  'analysis complete',
  'гипотеза в голове',
  'гипотеза есть',
  'всё понятно',
  'все понятно',
];

const REQUIRED_FRONTMATTER_FIELDS = ['name', 'description', 'tools'];

/**
 * Forbidden frontmatter fields - break Claude Code or violate framework.
 * `skills:` is NOT forbidden: it is the official sub-agent field for pre-loading
 * unconditional process-skills (see ALLOWED_PRELOAD_SKILLS below). `allowed-tools`
 * is a slash-command field, not a sub-agent one.
 */
const FORBIDDEN_FRONTMATTER_FIELDS = ['allowed-tools'];

/**
 * Skills allowed in frontmatter `skills:` (pre-load). Only UNCONDITIONAL
 * process-skills belong here - those an agent loads on EVERY run regardless of
 * stack/diff (the node handoff contract). Conditional skills (trap-skills by
 * stack, conditional process-skills like completeness-mapping) must NOT be
 * pre-loaded - they load imperatively via the Skill tool in the relevant phase,
 * so pre-loading them wastes context on runs that don't need them.
 * Names are matched stack-agnostically by the skill's short name (last `:`-segment
 * and stripped `dex-skill-` prefix) so all listing formats resolve.
 *
 * Value = which agents may pre-load it. `null` - any agent (the handoff contract
 * is unconditional for every node). A Set - a stage normative: unconditional for
 * the agent OWNING that stage and conditional for everyone else, so an open
 * allowlist would let any agent pre-load a stage normative it never runs.
 */
const ALLOWED_PRELOAD_SKILLS = new Map([
  ['node-contract', null],
  ['business-analysis', new Set(['business-requirements-analyst'])],
]);

/**
 * Реестр ЧИТАТЕЛЕЙ норматива этапа: агенты, которые норматив не pre-load'ят
 * (для них он условен), но обязаны загружать его ИМПЕРАТИВНО в фазе, потому что
 * судят артефакт этого этапа. Без загрузки судья проверяет полноту состава по
 * памяти, а состав живёт в нормативе - расхождение автора и судьи, ради снятия
 * которого норматив и заведён (docs/standards/CHAIN.md, раздел 7).
 *
 * Ключ - полная форма ссылки `{plugin}:{skill}` (ровно то, что ищется в теле).
 * Значение - имена агентов (`name` во frontmatter). Rename агента - повод
 * править и эту карту, и ALLOWED_PRELOAD_SKILLS выше.
 */
const STAGE_NORMATIVE_READERS = new Map([
  [
    'dex-skill-business-analysis:business-analysis',
    new Set(['requirements-reviewer', 'requirements-orchestrator']),
  ],
]);

/**
 * Normalize a `skills:` entry to its short skill name for allowlist matching.
 * Accepts `dex-skill-node-contract`, `dex-skill-node-contract:node-contract`,
 * or `node-contract` - all -> `node-contract`.
 *
 * Tolerant on purpose: this answers "WHICH skill is this?" (allowlist policy).
 * Whether the entry is spelled in a form Claude Code can actually resolve is a
 * separate question - see `validatePreloadSkillForm`.
 */
function normalizePreloadSkillName(entry) {
  let name = String(entry).trim();
  if (name.includes(':')) name = name.slice(name.lastIndexOf(':') + 1);
  name = name.replace(/^dex-skill-/, '');
  return name;
}

/**
 * Map `plugin name` -> Set of skill names it ships, built by walking plugins/
 * for SKILL.md and reading the owning plugin's manifest. A plugin-shipped skill
 * is addressed as `{plugin}:{skill}` - the plugin name alone is NOT a skill name.
 */
function buildPluginSkillMap() {
  const map = new Map();
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry === 'SKILL.md') {
        // <plugin>/skills/<skill>/SKILL.md -> <plugin>/.claude-plugin/plugin.json
        const pj = join(dirname(dirname(dirname(full))), '.claude-plugin', 'plugin.json');
        if (!existsSync(pj)) continue;
        try {
          const plugin = JSON.parse(readFileSync(pj, 'utf8')).name;
          const skill = matter(readFileSync(full, 'utf8')).data?.name;
          if (!plugin || !skill) continue;
          if (!map.has(plugin)) map.set(plugin, new Set());
          map.get(plugin).add(String(skill));
        } catch {
          /* unreadable manifest or frontmatter - skipped */
        }
      }
    }
  }
  walk(join(REPO_ROOT, 'plugins'));
  return map;
}

const PLUGIN_SKILLS = buildPluginSkillMap();

/**
 * A plugin-shipped skill MUST be pre-loaded as `{plugin}:{skill}` - that is the
 * namespace Claude Code resolves ("Plugin skills use a `plugin-name:skill-name`
 * namespace", code.claude.com/docs/en/skills). Writing the bare PLUGIN name
 * (`dex-skill-node-contract`) addresses a skill that does not exist: the skill is
 * `node-contract`. Claude Code does NOT fail on this - it "skips it and logs a
 * warning to the debug log", so the agent silently starts WITHOUT the skill.
 *
 * Verified empirically: the bare form also slips past `bundle-not-closed`
 * (validate-bundle matches `{plugin}:{skill}` only), so the skill can vanish from
 * a bundle's includes[] with zero errors. Hence this check.
 */
function validatePreloadSkillForm(raw, findings) {
  const entry = String(raw).trim();
  if (entry === '') return;

  if (!entry.includes(':')) {
    // Bare name. If it names a plugin that ships skills, it is the broken form.
    if (PLUGIN_SKILLS.has(entry)) {
      const skills = [...PLUGIN_SKILLS.get(entry)];
      const suggestion = skills.length === 1 ? `${entry}:${skills[0]}` : `${entry}:{skill}`;
      findings.push({
        level: ERROR,
        rule: 'frontmatter-skills-bare-plugin-name',
        message: `\`skills:\` entry "${entry}" is a PLUGIN name, not a skill name - it does not resolve and Claude Code skips it silently (agent starts without the skill). Use the \`{plugin}:{skill}\` namespace: "${suggestion}"`,
      });
    }
    return;
  }

  const [plugin, skill] = entry.split(':');
  if (!PLUGIN_SKILLS.has(plugin)) return; // not a repo plugin - out of scope
  if (!PLUGIN_SKILLS.get(plugin).has(skill)) {
    findings.push({
      level: ERROR,
      rule: 'frontmatter-skills-unknown-skill',
      message: `\`skills:\` entry "${entry}" - plugin "${plugin}" ships no skill named "${skill}" (has: ${[...PLUGIN_SKILLS.get(plugin)].join(', ')}); the entry will not resolve and is skipped silently`,
    });
  }
}

/**
 * Allowed values for the `model` field. Either a tier alias, `inherit`,
 * or a full model ID (e.g. `claude-opus-4-8`). Tier aliases are enforced;
 * full IDs are accepted by pattern.
 */
const MODEL_TIER_ALIASES = ['opus', 'sonnet', 'haiku', 'fable', 'inherit'];
const MODEL_ID_RE = /^claude-[a-z0-9-]+$/;

/**
 * Allowed values for the `effort` field - the reasoning-depth axis, independent
 * of `model`. Unlike `model` (a ceiling), `effort` OVERRIDES the session level,
 * so raising it silently outspends the mode the user picked. The framework
 * therefore allows it downward freely and upward only with a stated reason.
 * Which of the levels a supporting model offers is resolved by Claude Code, not
 * here - this only rejects values that are not levels at all.
 */
const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'];

/**
 * Tiers that do not carry the effort axis at all. The effort docs enumerate the
 * supporting models by name (generations 5 and 4.5-4.8) and no Haiku is among
 * them, so `effort` on a Haiku-tier agent buys nothing: there the cost lever is
 * `model` itself. Full IDs are caught by the same prefix.
 */
const EFFORTLESS_MODEL_RE = /^(haiku|claude-haiku)/;

function validateFrontmatter(parsed, findings) {
  const fm = parsed.data || {};

  for (const field of REQUIRED_FRONTMATTER_FIELDS) {
    if (fm[field] == null || fm[field] === '') {
      findings.push({
        level: ERROR,
        rule: 'frontmatter-required',
        message: `Missing required frontmatter field: ${field}`,
      });
    }
  }

  for (const field of FORBIDDEN_FRONTMATTER_FIELDS) {
    if (field in fm) {
      findings.push({
        level: ERROR,
        rule: 'frontmatter-forbidden',
        message: `Forbidden frontmatter field: ${field} - use \`tools:\` for tool access, Skill tool for skill loading`,
      });
    }
  }

  // `skills:` pre-loads its entries into the sub-agent context at startup.
  // Only unconditional process-skills (node handoff contract) may be pre-loaded;
  // conditional skills (trap-skills by stack, conditional process-skills) load
  // imperatively in phases. A non-allowlisted entry here = wasted standing
  // context on runs that don't need it. See AGENT_FRAMEWORK.md «Подключение skills».
  if ('skills' in fm && fm.skills != null) {
    const entries = Array.isArray(fm.skills)
      ? fm.skills
      : String(fm.skills).split(',');
    for (const raw of entries) {
      const short = normalizePreloadSkillName(raw);
      if (short === '') continue;
      // Two independent questions: WHICH skill (allowlist policy, below) and
      // whether it is spelled in a resolvable form (here).
      validatePreloadSkillForm(raw, findings);
      if (!ALLOWED_PRELOAD_SKILLS.has(short)) {
        findings.push({
          level: ERROR,
          rule: 'frontmatter-skills-not-preloadable',
          message: `\`skills:\` entry "${String(raw).trim()}" is not an unconditional process-skill - pre-load only [${[...ALLOWED_PRELOAD_SKILLS.keys()].join(', ')}]; conditional skills load imperatively via Skill tool in phases`,
        });
        continue;
      }
      const owners = ALLOWED_PRELOAD_SKILLS.get(short);
      if (owners != null && !owners.has(String(fm.name ?? '').trim())) {
        findings.push({
          level: ERROR,
          rule: 'frontmatter-skills-not-own-stage',
          message: `\`skills:\` entry "${String(raw).trim()}" is a stage normative - pre-loadable only by the agent owning that stage [${[...owners].join(', ')}]; for others it is conditional and loads via Skill tool in a phase`,
        });
      }
    }
  }

  // `model` must be explicit (not inherited) and a valid tier or model ID.
  // Default `inherit` runs cheap work on the session model - on an Opus
  // session even trivial agents would run on Opus. See AGENT_FRAMEWORK.md.
  if (fm.model == null || fm.model === '') {
    findings.push({
      level: ERROR,
      rule: 'frontmatter-model-missing',
      message: `Missing required frontmatter field: model - set explicit \`opus\` / \`sonnet\` / \`haiku\` by judgment type (not \`inherit\`)`,
    });
  } else if (
    !MODEL_TIER_ALIASES.includes(String(fm.model)) &&
    !MODEL_ID_RE.test(String(fm.model))
  ) {
    findings.push({
      level: ERROR,
      rule: 'frontmatter-model-invalid',
      message: `Invalid model "${fm.model}" - expected one of ${MODEL_TIER_ALIASES.join(', ')} or a full model ID`,
    });
  }

  // `effort` is optional: omitting it inherits the session level, which keeps
  // the ceiling with the user. Only the value is checked here - the decision to
  // set it at all is a judgment call the framework describes, not a rule.
  if (fm.effort != null && fm.effort !== '') {
    if (!EFFORT_LEVELS.includes(String(fm.effort))) {
      findings.push({
        level: ERROR,
        rule: 'frontmatter-effort-invalid',
        message: `Invalid effort "${fm.effort}" - expected one of ${EFFORT_LEVELS.join(', ')}`,
      });
    }
    if (EFFORTLESS_MODEL_RE.test(String(fm.model ?? ''))) {
      findings.push({
        level: ERROR,
        rule: 'frontmatter-effort-unsupported-model',
        message: `effort "${fm.effort}" is set on model "${fm.model}" - the haiku tier has no effort axis; drop the field, or move the agent to a tier that has one`,
      });
    }
  }

  // `permissionMode: default` is redundant (it is already the Claude Code
  // default) - the framework checklist forbids the noise.
  if (fm.permissionMode === 'default') {
    findings.push({
      level: ERROR,
      rule: 'frontmatter-permissionmode-default',
      message: `Redundant \`permissionMode: default\` - omit it, this is already the default`,
    });
  }

  if (typeof fm.description === 'string' && fm.description.length < 50) {
    findings.push({
      level: ERROR,
      rule: 'frontmatter-description-short',
      message: `Description is shorter than 50 characters - likely missing trigger keywords for semantic activation`,
    });
  }

  if (typeof fm.description === 'string' && fm.description.length > PROJECT_DESCRIPTION_MAX) {
    findings.push({
      level: ERROR,
      rule: 'frontmatter-description-too-long',
      message: `Description is ${fm.description.length} characters - exceeds project hard cap of ${PROJECT_DESCRIPTION_MAX}. The agent description loads into the system prompt of every session; trim it to role + responsibilities + symptom triggers`,
    });
  } else if (
    typeof fm.description === 'string' &&
    fm.description.length > WARN_DESCRIPTION_LENGTH
  ) {
    findings.push({
      level: WARNING,
      rule: 'frontmatter-description-long',
      message: `Description is ${fm.description.length} characters - exceeds project guideline of ${WARN_DESCRIPTION_LENGTH}. A compact description matches more reliably and costs less standing context; cut symptom duplicates, keep role + areas`,
    });
  }

  if (
    typeof fm.description === 'string' &&
    !/триггер|активируется|trigger/i.test(fm.description)
  ) {
    findings.push({
      level: ERROR,
      rule: 'frontmatter-description-no-triggers',
      message: `Description does not contain "Триггеры" / "trigger" - Claude Code matches agents by keywords from description`,
    });
  }

  if (typeof fm.tools === 'string' && !/\bSkill\b/.test(fm.tools)) {
    findings.push({
      level: ERROR,
      rule: 'frontmatter-no-skill-tool',
      message: `Agent does not declare "Skill" in tools - will not be able to load skills imperatively in phases`,
    });
  }
}

/**
 * The agent file name must match the frontmatter `name`. Claude Code resolves
 * the agent by its `name`; a divergent file name leaves the file looking like a
 * different agent than the one it declares and breaks the project convention
 * "имя файла агента совпадает с `name`" (CLAUDE.md). Skipped when `name` is
 * missing - that is already reported by `frontmatter-required`.
 */
function validateFileNameMatchesName(filepath, parsed, findings) {
  const fm = parsed.data || {};
  if (fm.name == null || fm.name === '') return;

  const fileStem = basename(filepath, '.md');
  if (fileStem !== String(fm.name)) {
    findings.push({
      level: ERROR,
      rule: 'agent-file-name-mismatch',
      message: `File name "${fileStem}.md" does not match frontmatter name "${fm.name}" - rename the file to "${fm.name}.md" (or fix the name) so they agree`,
    });
  }
}

/**
 * Parse markdown into an AST and extract phase sections.
 * A phase is identified by an H2 heading that matches /^Phase\b/.
 */
function extractPhases(markdownBody, bodyOffset = 0) {
  const tree = unified().use(remarkParse).parse(markdownBody);

  const phases = [];
  let currentPhase = null;

  function headingText(node) {
    let t = '';
    visit(node, 'text', (child) => {
      t += child.value;
    });
    return t.trim();
  }

  for (const node of tree.children) {
    if (node.type === 'heading' && node.depth === 2) {
      const title = headingText(node);
      if (/^Phase\b/i.test(title)) {
        if (currentPhase) phases.push(currentPhase);
        currentPhase = {
          title,
          startLine: (node.position?.start?.line ?? 0) + bodyOffset,
          endLine: (node.position?.end?.line ?? 0) + bodyOffset,
          nodes: [],
        };
      } else if (currentPhase) {
        phases.push(currentPhase);
        currentPhase = null;
      }
    } else if (currentPhase) {
      currentPhase.nodes.push(node);
    }
  }

  if (currentPhase) phases.push(currentPhase);
  return phases;
}

function nodeText(node) {
  let t = '';
  visit(node, 'text', (child) => {
    t += child.value;
  });
  return t;
}

function phaseBodyText(phase) {
  return phase.nodes.map(nodeText).join('\n');
}

/**
 * Check whether any node in the phase has a "**Label:**" bold prefix matching
 * the given label (case-insensitive). Works with how remark parses bold:
 * `**Goal:**` becomes a `strong` inline node containing text "Goal:".
 */
function phaseHasAttribute(phase, label) {
  const labelRe = new RegExp(`^${label}:?\\s*$`, 'i');
  for (const node of phase.nodes) {
    let found = false;
    visit(node, 'strong', (strongNode) => {
      if (found) return;
      const t = nodeText(strongNode).trim();
      if (labelRe.test(t)) found = true;
    });
    if (found) return true;
  }
  return false;
}

function validatePhases(markdownBody, findings, bodyOffset = 0) {
  const phases = extractPhases(markdownBody, bodyOffset);

  if (phases.length === 0) {
    findings.push({
      level: ERROR,
      rule: 'no-phases',
      message: `Agent has no "## Phase N:" sections - all agents must follow Agent Framework phase structure`,
    });
    return { validated: false, phases: [] };
  }

  for (const phase of phases) {
    if (!phaseHasAttribute(phase, 'Goal')) {
      findings.push({
        level: ERROR,
        rule: 'phase-missing-goal',
        message: `Phase "${phase.title}" (line ${phase.startLine}) is missing **Goal:** attribute`,
      });
    }

    if (!phaseHasAttribute(phase, 'Exit criteria')) {
      findings.push({
        level: ERROR,
        rule: 'phase-missing-exit',
        message: `Phase "${phase.title}" (line ${phase.startLine}) is missing **Exit criteria:** attribute`,
      });
    }

    const body = phaseBodyText(phase).toLowerCase();
    for (const phrase of NON_OBSERVABLE_PHRASES) {
      if (body.includes(phrase)) {
        findings.push({
          level: ERROR,
          rule: 'phase-non-observable-exit',
          message: `Phase "${phase.title}" (line ${phase.startLine}) contains non-observable phrase "${phrase}" - exit criteria must describe an observable artifact`,
        });
      }
    }

    const mandatoryMatch = body.match(/mandatory:\s*yes([^\n]*)/i);
    if (mandatoryMatch) {
      const afterYes = (mandatoryMatch[1] || '').trim();
      if (afterYes.length < 10) {
        findings.push({
          level: ERROR,
          rule: 'phase-mandatory-no-justification',
          message: `Phase "${phase.title}" (line ${phase.startLine}) declares **Mandatory:** yes without justification - framework requires explaining "why mandatory"`,
        });
      }
    }

    let maxListLen = 0;
    for (const node of phase.nodes) {
      if (node.type === 'list' && node.ordered === true) {
        const len = node.children?.length ?? 0;
        if (len > maxListLen) maxListLen = len;
      }
    }
    if (maxListLen >= 4) {
      findings.push({
        level: ERROR,
        rule: 'phase-procedural-body',
        message: `Phase "${phase.title}" (line ${phase.startLine}) contains ordered list with ${maxListLen} items - potentially procedural description, framework mandates declarative style (goal + output + exit, not step-by-step)`,
      });
    }
  }

  return { validated: true, phases };
}

/**
 * Detects agents that EXECUTE fact-verification (imperative `plugin:skill` call)
 * but are missing one or more links in the cascade: ToolSearch -> WebSearch ->
 * WebFetch. Without all three, fact-check silently degrades to latest-doc
 * (context7 is a deferred MCP tool reachable only via ToolSearch; WebSearch/
 * WebFetch are the offline fallback). See CLAUDE.md "Каскад tools под fact-check".
 *
 * Trigger is the `:`-qualified invocation form (`dex-skill-fact-verification:fact-verification`)
 * rather than a bare mention, to distinguish "agent executes fact-check" from
 * "agent prose references the skill name" - only the former requires the cascade.
 */
function validateFactcheckCascade(parsed, findings) {
  const body = parsed.content || '';
  // Only trigger on the imperative invocation form, not bare prose mentions.
  if (!body.includes('dex-skill-fact-verification:fact-verification')) return;

  const fm = parsed.data || {};
  // `tools:` officially accepts both a comma-string and a YAML list; normalize the
  // list form to a string so the cascade check does not false-positive on it.
  const tools = Array.isArray(fm.tools)
    ? fm.tools.join(',')
    : typeof fm.tools === 'string'
      ? fm.tools
      : '';

  const CASCADE = ['ToolSearch', 'WebSearch', 'WebFetch'];
  const missing = CASCADE.filter((t) => !new RegExp(`\\b${t}\\b`).test(tools));

  if (missing.length > 0) {
    findings.push({
      level: ERROR,
      rule: 'factcheck-cascade-incomplete',
      message: `Agent invokes fact-verification skill but tools is missing cascade link(s): ${missing.join(', ')} - fact-check silently degrades to latest-doc (see CLAUDE.md "Каскад tools под fact-check")`,
    });
  }
}

/**
 * Читатель норматива этапа обязан грузить его императивно в фазе. Проверяется
 * наличие полной формы `{plugin}:{skill}` в теле и `Skill` в `tools`: без tool'а
 * запись в теле неисполнима, и проверка состава молча выпадает.
 */
function validateStageNormativeReaders(parsed, findings) {
  const name = String(parsed.data?.name ?? '').trim();
  if (!name) return;

  const body = parsed.content || '';
  const fm = parsed.data || {};
  const tools = Array.isArray(fm.tools)
    ? fm.tools.join(',')
    : typeof fm.tools === 'string'
      ? fm.tools
      : '';

  for (const [ref, readers] of STAGE_NORMATIVE_READERS) {
    if (!readers.has(name)) continue;

    if (!body.includes(ref)) {
      findings.push({
        level: ERROR,
        rule: 'stage-normative-reader-missing',
        message: `Agent "${name}" judges artifacts of the stage normed by "${ref}" but never loads it - add an imperative Skill call in the judging phase (pre-load is reserved for the stage owner)`,
      });
      continue;
    }

    if (!/\bSkill\b/.test(tools)) {
      findings.push({
        level: ERROR,
        rule: 'stage-normative-reader-missing',
        message: `Agent "${name}" references stage normative "${ref}" in a phase but tools is missing \`Skill\` - the imperative load cannot run`,
      });
    }
  }
}

function validateSkillReferences(markdownBody, marketplacePlugins, findings) {
  const re = /`(dex-skill-[a-z0-9-]+):[a-z0-9-]+`/gi;
  const referenced = new Set();
  for (const match of markdownBody.matchAll(re)) {
    referenced.add(match[1]);
  }

  for (const plugin of referenced) {
    if (!marketplacePlugins.has(plugin)) {
      findings.push({
        level: ERROR,
        rule: 'skill-reference-unknown',
        message: `Referenced skill plugin "${plugin}" not found in marketplace.json`,
      });
    }
  }
}

/**
 * Атрибут фазы (`**Goal:**`, `**Output (handoff):**`, `**Gate ...:**`) - отдельный блок.
 * Без пустой строки перед следующим таким лейблом markdown сливает их в один абзац,
 * и нормативный пункт перестаёт читаться отдельно. Ловится по AST: внутри одного
 * paragraph-узла лейбл стоит не на первой строке (заголовки и code fence в paragraph
 * не попадают, поэтому ложных срабатываний на них нет). Длина лейбла не ограничена:
 * верхняя граница отсекала бы длинные лейблы каталога от проверки молча, а склейка
 * у них ровно та же. Префикс контейнера (отступ пункта списка, `>` цитаты) снимается
 * перед проверкой - внутри списка и blockquote лейбл стоит не на нулевой колонке.
 */
const ATTRIBUTE_LABEL_RE = /^\*\*[^*\n]+:\*\*/;
const CONTAINER_PREFIX_RE = /^[\s>]*/;

function validateAttributeBlocks(markdownBody, findings, bodyOffset = 0) {
  const tree = unified().use(remarkParse).parse(markdownBody);
  const lines = markdownBody.split('\n');

  visit(tree, 'paragraph', (node) => {
    const start = node.position?.start?.line;
    const end = node.position?.end?.line;
    if (!start || !end || end <= start) return;

    for (let ln = start + 1; ln <= end; ln++) {
      const text = (lines[ln - 1] ?? '').replace(CONTAINER_PREFIX_RE, '');
      if (!ATTRIBUTE_LABEL_RE.test(text)) continue;
      const label = text.slice(2, text.indexOf(':**'));
      const fileLine = ln + bodyOffset;
      findings.push({
        level: ERROR,
        rule: 'glued-attribute-block',
        message: `Line ${fileLine}: attribute "**${label}:**" is glued to the previous block - markdown merges them into one paragraph. Separate with a blank line`,
      });
    }
  });
}

// --- File validation orchestration --------------------------------------

function validateFile(filepath, marketplacePlugins) {
  const findings = [];
  let parsed;
  let bodyOffset = 0;

  try {
    const raw = readFileSync(filepath, 'utf8');
    parsed = matter(raw);
    // Позиции из AST считаются по телу без frontmatter; в сообщениях нужен номер
    // строки файла, иначе он не совпадает с тем, что видит открывший файл.
    bodyOffset = raw.split('\n').length - parsed.content.split('\n').length;
  } catch (e) {
    return {
      filepath,
      findings: [
        { level: ERROR, rule: 'read-failed', message: `Failed to read file: ${e.message}` },
      ],
    };
  }

  const phaseResult = validatePhases(parsed.content, findings, bodyOffset);
  validateFrontmatter(parsed, findings);
  validateFileNameMatchesName(filepath, parsed, findings);
  validateFactcheckCascade(parsed, findings);
  validateStageNormativeReaders(parsed, findings);
  validateAttributeBlocks(parsed.content, findings, bodyOffset);

  if (phaseResult.validated) {
    validateSkillReferences(parsed.content, marketplacePlugins, findings);
  }

  return { filepath, findings };
}

// --- Reporting ----------------------------------------------------------

function formatFinding(f) {
  const isWarning = f.level === WARNING;
  const label = isWarning
    ? `${COLORS.yellow}WARN ${COLORS.reset}`
    : `${COLORS.red}ERROR${COLORS.reset}`;
  return `  ${label} ${COLORS.gray}[${f.rule}]${COLORS.reset} ${f.message}`;
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
    for (const f of result.findings) {
      console.log(formatFinding(f));
    }
  }

  console.log('');
  console.log(
    `${COLORS.bold}Summary:${COLORS.reset} ${results.length} file(s) checked, ` +
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
    files = findAllAgentFiles();
    if (files.length === 0) {
      console.error(`No agent files found under ${relative(REPO_ROOT, SPECIALISTS_DIR)}`);
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

  const marketplacePlugins = loadMarketplacePlugins();
  const results = files.map((f) => validateFile(f, marketplacePlugins));
  process.exit(report(results));
}

main();
