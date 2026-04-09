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
 *   node tools/validate-skill.js all --errors-only      # skip warnings
 *
 * Exit codes:
 *   0 — clean (or only warnings with --errors-only)
 *   1 — at least one error found
 *   2 — only warnings found
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
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
  const args = argv.slice(2);
  const flags = new Set();
  const positional = [];
  for (const a of args) {
    if (a.startsWith('--')) flags.add(a);
    else positional.push(a);
  }
  return {
    target: positional[0] || 'all',
    errorsOnly: flags.has('--errors-only'),
  };
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

const CLAUDE_CODE_HARD_LIMIT = 500; // official Claude Code limit
const PROJECT_RECOMMENDED_MAX = 150; // project guideline
const PROJECT_TARGET_MAX = 120; // ideal range

// --- Frontmatter validation ---------------------------------------------

const REQUIRED_FIELDS = ['name', 'description'];
const FORBIDDEN_FIELDS = ['keywords'];
const MIN_DESCRIPTION_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 250;
const MIN_TRIGGER_KEYWORDS = 10;

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
      level: WARNING,
      rule: 'description-short',
      message: `Description shorter than ${MIN_DESCRIPTION_LENGTH} characters — likely missing trigger keywords`,
    });
  }

  if (desc.length > MAX_DESCRIPTION_LENGTH) {
    findings.push({
      level: WARNING,
      rule: 'description-too-long',
      message: `Description is ${desc.length} characters — exceeds recommended max of ${MAX_DESCRIPTION_LENGTH}. Keywords beyond this limit may not activate the skill`,
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
        level: WARNING,
        rule: 'description-few-keywords',
        message: `Description has only ${keywords.length} trigger keyword(s) after "Активируется при" — framework recommends 15-25 for reliable semantic activation`,
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
      level: WARNING,
      rule: 'size-exceeds-recommended',
      message: `File is ${lineCount} lines — exceeds project recommendation of ${PROJECT_RECOMMENDED_MAX}. Consider splitting or cutting documentation/procedures`,
    });
  }
}

// --- Trap structure validation ------------------------------------------

/**
 * Parse markdown body and extract H3 sections (traps). Each trap must follow
 * the "Плохо / Правильно / Почему" triad.
 */
function extractTraps(markdownBody) {
  const tree = unified().use(remarkParse).parse(markdownBody);
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

function validateTraps(markdownBody, findings) {
  const traps = extractTraps(markdownBody);

  if (traps.length < 5) {
    findings.push({
      level: WARNING,
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
        level: WARNING,
        rule: 'trap-missing-triad',
        message: `Trap "${trap.title}" (line ${trap.startLine}) is missing: ${missing.join(', ')} — framework mandates "Плохо / Правильно / Почему" triad`,
      });
    }
  }
}

// --- Pointer-not-code validation ----------------------------------------

const MAX_CODE_FENCE_LINES = 5;

function validateCodeFences(markdownBody, findings) {
  const tree = unified().use(remarkParse).parse(markdownBody);

  visit(tree, 'code', (node) => {
    const lines = (node.value || '').split('\n').length;
    if (lines > MAX_CODE_FENCE_LINES) {
      findings.push({
        level: WARNING,
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
          level: WARNING,
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

  validateFrontmatter(parsed, findings);
  validateSize(raw, findings);
  validateTraps(parsed.content, findings);
  validateCodeFences(parsed.content, findings);
  validateNoDocumentationTitles(parsed.content, findings);

  return { filepath, findings };
}

// --- Reporting ----------------------------------------------------------

function formatFinding(f) {
  const color = f.level === ERROR ? COLORS.red : COLORS.yellow;
  const tag = f.level === ERROR ? 'ERROR' : 'WARN ';
  return `  ${color}${tag}${COLORS.reset} ${COLORS.gray}[${f.rule}]${COLORS.reset} ${f.message}`;
}

function report(results, errorsOnly) {
  let totalErrors = 0;
  let totalWarnings = 0;
  let filesWithIssues = 0;

  for (const result of results) {
    const errors = result.findings.filter((f) => f.level === ERROR);
    const warnings = result.findings.filter((f) => f.level === WARNING);
    totalErrors += errors.length;
    totalWarnings += warnings.length;

    const shown = errorsOnly ? errors : [...errors, ...warnings];
    if (shown.length === 0) continue;

    filesWithIssues += 1;
    const rel = relative(REPO_ROOT, result.filepath);
    console.log(`\n${COLORS.bold}${rel}${COLORS.reset}`);
    for (const f of shown) console.log(formatFinding(f));
  }

  console.log('');
  console.log(
    `${COLORS.bold}Summary:${COLORS.reset} ${results.length} skill(s) checked, ` +
      `${COLORS.red}${totalErrors} error(s)${COLORS.reset}, ` +
      `${COLORS.yellow}${totalWarnings} warning(s)${COLORS.reset}` +
      (filesWithIssues > 0 ? `, ${filesWithIssues} file(s) with issues` : '')
  );

  if (totalErrors > 0) return 1;
  if (totalWarnings > 0) return 2;
  return 0;
}

// --- Main ---------------------------------------------------------------

function main() {
  const { target, errorsOnly } = parseArgs(process.argv);

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
  const exitCode = report(results, errorsOnly);

  if (errorsOnly && exitCode === 2) process.exit(0);
  process.exit(exitCode);
}

main();
