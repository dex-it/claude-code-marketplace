#!/usr/bin/env node
/**
 * Command validator for Claude Code marketplace.
 *
 * Checks commands against the Command Framework (COMMAND_FRAMEWORK.md):
 * frontmatter requirements, Goal/Output presence, size limits,
 * bash-script and error-code anti-patterns.
 *
 * Usage:
 *   node tools/validate-command.js <path>                 # single file
 *   node tools/validate-command.js all                    # all commands in plugins/specialists
 *   node tools/validate-command.js all --errors-only      # skip warnings
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
const SPECIALISTS_DIR = join(REPO_ROOT, 'plugins', 'specialists');
const UTILITIES_DIR = join(REPO_ROOT, 'plugins', 'utilities');

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
  walk(SPECIALISTS_DIR);
  walk(UTILITIES_DIR);
  return result.sort();
}

// --- Size limits --------------------------------------------------------

const SIZE_TARGET = 80;       // above this = warning
const SIZE_ALARM = 100;       // above this = error (likely should be an agent)

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

// --- Body validation: Goal and Output -----------------------------------

function validateGoalAndOutput(markdownBody, findings) {
  const hasGoal = /\*\*Goal:?\*\*/i.test(markdownBody);
  const hasOutput = /\*\*Output:?\*\*/i.test(markdownBody);

  if (!hasGoal) {
    findings.push({
      level: WARNING,
      rule: 'missing-goal',
      message: 'Command is missing **Goal:** — framework requires describing what the command achieves',
    });
  }

  if (!hasOutput) {
    findings.push({
      level: WARNING,
      rule: 'missing-output',
      message: 'Command is missing **Output:** — framework requires describing the result format',
    });
  }
}

// --- Size check ---------------------------------------------------------

function validateSize(rawContent, findings) {
  const lineCount = rawContent.split('\n').length;

  if (lineCount > SIZE_ALARM) {
    findings.push({
      level: ERROR,
      rule: 'size-exceeds-alarm',
      message: `Command is ${lineCount} lines — exceeds ${SIZE_ALARM} line alarm threshold. Consider migrating to an agent`,
    });
  } else if (lineCount > SIZE_TARGET) {
    findings.push({
      level: WARNING,
      rule: 'size-exceeds-target',
      message: `Command is ${lineCount} lines — exceeds ${SIZE_TARGET} line target. Framework recommends 20-50 lines`,
    });
  }
}

// --- Anti-pattern: bash scripts in code fences --------------------------

const BASH_SCRIPT_INDICATORS = [
  /\$\(.*\)/,             // $(command)
  /\bif\s+\[/,            // if [
  /\bfor\s+\w+\s+in\b/,   // for x in
  /\bwhile\s+\[/,         // while [
  /\|\s*head\b/,          // | head
  /\|\s*grep\b/,          // | grep
  /\bfind\s+\.\s/,        // find .
];

function validateNoBashScripts(markdownBody, findings) {
  const tree = unified().use(remarkParse).parse(markdownBody);

  visit(tree, 'code', (node) => {
    const lang = (node.lang || '').toLowerCase();
    const value = node.value || '';
    const lines = value.split('\n').length;

    // Bash code blocks > 3 lines with script indicators
    if ((lang === 'bash' || lang === 'sh' || lang === 'shell') && lines > 3) {
      const hasScriptPattern = BASH_SCRIPT_INDICATORS.some((re) => re.test(value));
      if (hasScriptPattern) {
        findings.push({
          level: WARNING,
          rule: 'bash-script-antipattern',
          message: `Bash code block at line ${node.position?.start?.line ?? '?'} (${lines} lines) looks like a script — framework principle: describe the goal, not the procedure. Claude knows how to run CLI tools`,
        });
      }
    }

    // SQL/PromQL reference blocks > 5 lines
    if ((lang === 'sql' || lang === 'promql') && lines > 5) {
      findings.push({
        level: WARNING,
        rule: 'query-reference-antipattern',
        message: `${lang.toUpperCase()} code block at line ${node.position?.start?.line ?? '?'} (${lines} lines) looks like a query reference — Claude knows ${lang.toUpperCase()}, describe what metrics/data you need instead`,
      });
    }
  });
}

// --- Anti-pattern: error code catalogs ----------------------------------

const ERROR_CODE_PATTERN = /^[-*]\s*\*?\*?[A-Z]{2,}\d{3,}/m;

function validateNoErrorCodeCatalog(markdownBody, findings) {
  const matches = markdownBody.match(new RegExp(ERROR_CODE_PATTERN.source, 'gm'));
  if (matches && matches.length >= 3) {
    findings.push({
      level: WARNING,
      rule: 'error-code-catalog',
      message: `Command contains ${matches.length} error code entries — looks like an error code reference. Claude knows error codes from training data`,
    });
  }
}

// --- Anti-pattern: verbose output templates ------------------------------

function validateNoVerboseOutputTemplate(markdownBody, findings) {
  const tree = unified().use(remarkParse).parse(markdownBody);

  visit(tree, 'code', (node) => {
    const lang = (node.lang || '').toLowerCase();
    const lines = (node.value || '').split('\n').length;

    // Unlabeled or text code blocks > 20 lines are likely output templates
    if ((!lang || lang === 'text' || lang === 'txt') && lines > 20) {
      findings.push({
        level: WARNING,
        rule: 'verbose-output-template',
        message: `Code block at line ${node.position?.start?.line ?? '?'} (${lines} lines) looks like a verbose output template — describe the format briefly instead`,
      });
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
  } catch (e) {
    return {
      filepath,
      findings: [
        { level: ERROR, rule: 'read-failed', message: `Failed to read file: ${e.message}` },
      ],
    };
  }

  try {
    parsed = matter(raw);
  } catch {
    // YAML parse error — likely unquoted special chars in frontmatter (e.g. [brackets])
    // Fall back to regex-based frontmatter extraction
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    const body = fmMatch ? raw.slice(fmMatch[0].length) : raw;
    const data = {};
    if (fmMatch) {
      for (const line of fmMatch[1].split('\n')) {
        const m = line.match(/^(\S+):\s*(.*)/);
        if (m) data[m[1]] = m[2];
      }
    }
    parsed = { data, content: body };
    findings.push({
      level: WARNING,
      rule: 'frontmatter-yaml-error',
      message: 'Frontmatter has YAML parse error — likely unquoted special characters (e.g. [brackets]). Wrap values in quotes',
    });
  }

  validateFrontmatter(parsed, findings);
  validateSize(raw, findings);
  validateGoalAndOutput(parsed.content, findings);
  validateNoBashScripts(parsed.content, findings);
  validateNoErrorCodeCatalog(parsed.content, findings);
  validateNoVerboseOutputTemplate(parsed.content, findings);

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
    `${COLORS.bold}Summary:${COLORS.reset} ${results.length} command(s) checked, ` +
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
    files = findAllCommandFiles();
    if (files.length === 0) {
      console.error(`No command files found under plugins/specialists or plugins/utilities`);
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
