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

function validateSize(rawContent, findings) {
  const lineCount = rawContent.split('\n').length;

  if (lineCount > SIZE_HARD_LIMIT) {
    findings.push({
      level: ERROR,
      rule: 'size-exceeds-hard-limit',
      message: `File is ${lineCount} lines — exceeds hard limit of ${SIZE_HARD_LIMIT}. Commands this large should be agents with phases, not slash-commands`,
    });
  } else if (lineCount > SIZE_RECOMMENDED_MAX) {
    findings.push({
      level: ERROR,
      rule: 'size-exceeds-recommended',
      message: `File is ${lineCount} lines — exceeds recommended max of ${SIZE_RECOMMENDED_MAX}. Consider trimming procedural content, bash scripts, or templates`,
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
          message: `Ordered list with ${len} items at line ${node.position?.start?.line ?? '?'} — commands should declare Goal + Output, not step-by-step procedures`,
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
        message: `Code block at line ${node.position?.start?.line ?? '?'} has ${lines} lines — commands describe Goal + Output format, not embed scripts. Claude knows CLI syntax`,
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
      message: `${bashBlockCount} bash blocks with ${totalBashLines} total lines — commands declare what to achieve, not how. Claude knows CLI commands`,
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
          message: `Heading "${title}" (line ${node.position?.start?.line ?? '?'}) looks like documentation — commands describe Goal + Output, not tutorials`,
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
  validateNoProcedural(parsed.content, findings);
  validateCodeFences(parsed.content, findings);
  validateNoBashScripts(parsed.content, findings);
  validateNoDocumentationTitles(parsed.content, findings);

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
