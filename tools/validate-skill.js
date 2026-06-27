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
 *   node tools/validate-skill.js all                    # all skills in plugins/skills
 *
 * Exit codes:
 *   0 — clean
 *   1 — at least one error found
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const SKILLS_DIR = join(REPO_ROOT, 'plugins', 'skills');
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

const CLAUDE_CODE_HARD_LIMIT = 500; // official Claude Code line limit
const PROJECT_RECOMMENDED_MAX = 250; // project line-count guideline
const PROJECT_TARGET_MAX = 120; // ideal range

// --- Frontmatter validation ---------------------------------------------

const REQUIRED_FIELDS = ['name', 'description'];
const FORBIDDEN_FIELDS = ['keywords'];
const MIN_DESCRIPTION_LENGTH = 50;
const CLAUDE_DESCRIPTION_HARD_LIMIT = 1536; // Claude Code hard limit (description + when_to_use) — error
const PROJECT_DESCRIPTION_MAX = 750; // project hard cap — error
const WARN_DESCRIPTION_LENGTH = 500; // project soft guideline — warning
const MIN_TRIGGER_KEYWORDS = 10;

/**
 * Process / orchestration skills encode a workflow rule (e.g. "new project →
 * inherit solution rules") or a registry, not a catalogue of API traps. The trap
 * heuristics (count + Плохо/Правильно/Почему triad) don't apply, so validateTraps
 * skips them entirely; instead validateProcessStructure enforces a content floor
 * (a table or ≥2 H2 sections) so the exemption can't shelter a stub. Keyword-count,
 * size and description limits stay strict — activation must still be reliable.
 *
 * Registration is an explicit allowlist by skill name, not a self-declared
 * marker: adding a process skill requires a deliberate edit here plus review,
 * so the exemption can't be abused to slip an under-built skill through. The
 * `<!-- skill-type: process -->` marker in the body is for human readers only —
 * this allowlist is the source of truth. See docs/SKILL_FRAMEWORK.md "Типы skill".
 */
const PROCESS_SKILLS = new Set([
  'dotnet-project-baseline',
  'stack-registry',
  'completeness-mapping',
  'optimize-for-llm',
  'pipeline-handoff',
]);

function isProcessSkill(parsed) {
  return PROCESS_SKILLS.has(parsed.data && parsed.data.name);
}

function validateFrontmatter(parsed, findings) {
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
        message: `Forbidden frontmatter field: ${field} — not supported by Claude Code for skills`,
      });
    }
  }

  const desc = fm.description;
  if (typeof desc !== 'string') return;

  if (desc.length < MIN_DESCRIPTION_LENGTH) {
    findings.push({
      level: ERROR,
      rule: 'description-short',
      message: `Description shorter than ${MIN_DESCRIPTION_LENGTH} characters — likely missing trigger keywords`,
    });
  }

  if (desc.length > CLAUDE_DESCRIPTION_HARD_LIMIT) {
    findings.push({
      level: ERROR,
      rule: 'description-exceeds-claude-limit',
      message: `Description is ${desc.length} characters — exceeds Claude Code hard limit of ${CLAUDE_DESCRIPTION_HARD_LIMIT}. Text beyond this limit is truncated from the skill listing and will not activate the skill`,
    });
  } else if (desc.length > PROJECT_DESCRIPTION_MAX) {
    findings.push({
      level: ERROR,
      rule: 'description-too-long',
      message: `Description is ${desc.length} characters — exceeds project cap of ${PROJECT_DESCRIPTION_MAX}. Cut entry points (concrete APIs/symptoms inside traps); keep only the technology anchor and aspect names`,
    });
  } else if (desc.length > WARN_DESCRIPTION_LENGTH) {
    findings.push({
      level: WARNING,
      rule: 'description-long',
      message: `Description is ${desc.length} characters — exceeds project guideline of ${WARN_DESCRIPTION_LENGTH}. A compact description triggers more reliably; cut entry points, keep aspects`,
    });
  }

  // description must contain explicit activation phrase
  const hasActivation = /активируется при|triggers?\b|trigger(ed)? (on|by|when)/i.test(desc);
  if (!hasActivation) {
    findings.push({
      level: ERROR,
      rule: 'description-no-activation',
      message: `Description must contain "Активируется при" (or "Triggers") followed by keywords — this is the ONLY mechanism for semantic activation`,
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
        level: ERROR,
        rule: 'description-few-keywords',
        message: `Description has only ${keywords.length} trigger keyword(s) after "Активируется при" — framework requires at least ${MIN_TRIGGER_KEYWORDS} for reliable semantic activation`,
      });
    }
  }
}

// --- Body size check ----------------------------------------------------

function validateSize(rawContent, findings) {
  const lineCount = rawContent.split('\n').length;

  if (lineCount > CLAUDE_CODE_HARD_LIMIT) {
    findings.push({
      level: ERROR,
      rule: 'size-exceeds-hard-limit',
      message: `File is ${lineCount} lines — exceeds Claude Code hard limit of ${CLAUDE_CODE_HARD_LIMIT}`,
    });
  } else if (lineCount > PROJECT_RECOMMENDED_MAX) {
    findings.push({
      level: ERROR,
      rule: 'size-exceeds-recommended',
      message: `File is ${lineCount} lines — exceeds project recommendation of ${PROJECT_RECOMMENDED_MAX}. Consider splitting or cutting documentation/procedures`,
    });
  }
}

// --- Markdown parsing ---------------------------------------------------

/**
 * Single source of the markdown parser so every check sees the same AST.
 * remark-gfm is required for `table` nodes — without it GFM tables parse as
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
  // triad) don't apply to them — structure is checked by validateProcessStructure
  // instead. Triads remain *allowed* in a process skill (e.g. decision forks in
  // dotnet-project-baseline), just not *required*.
  if (isProcess) return;

  const traps = extractTraps(markdownBody);

  if (traps.length < 5) {
    findings.push({
      level: ERROR,
      rule: 'too-few-traps',
      message: `Skill has only ${traps.length} H3 sections — framework recommends 10-15 traps per skill`,
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
        message: `Trap "${trap.title}" (line ${trap.startLine}) is missing: ${missing.join(', ')} — framework mandates "Плохо / Правильно / Почему" triad`,
      });
    }
  }
}

// --- Process structure validation ---------------------------------------

/**
 * A process skill is exempt from trap heuristics, so it needs its own floor to
 * stop an empty/under-built skill from slipping through on the exemption alone.
 * It must carry actual orchestration content: a registry table OR at least two
 * H2 rule/decision sections. Below that it's not a process skill — it's a stub.
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
      message: `Process skill has no registry table and only ${h2Count} H2 section(s) — a process skill must encode orchestration content (a table or at least ${MIN_PROCESS_H2_SECTIONS} rule/decision sections), otherwise it's a stub exploiting the trap exemption`,
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
        message: `Code block at line ${node.position?.start?.line ?? '?'} has ${lines} lines — framework principle "pointer, not road" recommends max ${MAX_CODE_FENCE_LINES} lines. Replace with API name / condition reference`,
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
          message: `Heading "${title}" (line ${node.position?.start?.line ?? '?'}) looks like documentation ("how to X", "what is Y", "step N") — framework mandates traps/anti-patterns, not tutorials`,
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

  validateFrontmatter(parsed, findings);
  validateSize(raw, findings);
  validateTraps(parsed.content, findings, isProcess);
  if (isProcess) validateProcessStructure(parsed.content, findings);
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
