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
 *   0 — clean
 *   1 — at least one error found
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
const SPECIALISTS_DIR = join(REPO_ROOT, 'plugins', 'specialists');
const MARKETPLACE_JSON = join(REPO_ROOT, '.claude-plugin', 'marketplace.json');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
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

/**
 * Blacklisted phrases in exit criteria — they describe internal state,
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
 * Forbidden frontmatter fields — break Claude Code or violate framework.
 */
const FORBIDDEN_FRONTMATTER_FIELDS = ['allowed-tools', 'skills'];

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
        message: `Forbidden frontmatter field: ${field} — use \`tools:\` for tool access, Skill tool for skill loading`,
      });
    }
  }

  if (typeof fm.description === 'string' && fm.description.length < 50) {
    findings.push({
      level: ERROR,
      rule: 'frontmatter-description-short',
      message: `Description is shorter than 50 characters — likely missing trigger keywords for semantic activation`,
    });
  }

  if (
    typeof fm.description === 'string' &&
    !/триггер|активируется|trigger/i.test(fm.description)
  ) {
    findings.push({
      level: ERROR,
      rule: 'frontmatter-description-no-triggers',
      message: `Description does not contain "Триггеры" / "trigger" — Claude Code matches agents by keywords from description`,
    });
  }

  if (typeof fm.tools === 'string' && !/\bSkill\b/.test(fm.tools)) {
    findings.push({
      level: ERROR,
      rule: 'frontmatter-no-skill-tool',
      message: `Agent does not declare "Skill" in tools — will not be able to load skills imperatively in phases`,
    });
  }
}

/**
 * Parse markdown into an AST and extract phase sections.
 * A phase is identified by an H2 heading that matches /^Phase\b/.
 */
function extractPhases(markdownBody) {
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
          startLine: node.position?.start?.line ?? 0,
          endLine: node.position?.end?.line ?? 0,
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

function validatePhases(markdownBody, findings) {
  const phases = extractPhases(markdownBody);

  if (phases.length === 0) {
    findings.push({
      level: ERROR,
      rule: 'no-phases',
      message: `Agent has no "## Phase N:" sections — all agents must follow Agent Framework phase structure`,
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
          message: `Phase "${phase.title}" (line ${phase.startLine}) contains non-observable phrase "${phrase}" — exit criteria must describe an observable artifact`,
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
          message: `Phase "${phase.title}" (line ${phase.startLine}) declares **Mandatory:** yes without justification — framework requires explaining "why mandatory"`,
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
        message: `Phase "${phase.title}" (line ${phase.startLine}) contains ordered list with ${maxListLen} items — potentially procedural description, framework mandates declarative style (goal + output + exit, not step-by-step)`,
      });
    }
  }

  return { validated: true, phases };
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

// --- File validation orchestration --------------------------------------

function validateFile(filepath, marketplacePlugins) {
  const findings = [];
  let parsed;

  try {
    const raw = readFileSync(filepath, 'utf8');
    parsed = matter(raw);
  } catch (e) {
    return {
      filepath,
      findings: [
        { level: ERROR, rule: 'read-failed', message: `Failed to read file: ${e.message}` },
      ],
    };
  }

  const phaseResult = validatePhases(parsed.content, findings);
  validateFrontmatter(parsed, findings);

  if (phaseResult.validated) {
    validateSkillReferences(parsed.content, marketplacePlugins, findings);
  }

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
    for (const f of result.findings) {
      console.log(formatFinding(f));
    }
  }

  console.log('');
  console.log(
    `${COLORS.bold}Summary:${COLORS.reset} ${results.length} file(s) checked, ` +
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
