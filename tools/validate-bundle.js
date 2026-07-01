#!/usr/bin/env node
/**
 * Bundle validator for Claude Code marketplace.
 *
 * Checks that every bundle is *closed* over the skills its agents load:
 * each non-by-stack skill that an agent in the bundle loads imperatively
 * (via the Skill tool, `dex-skill-X:Y`) MUST be listed in the bundle's
 * includes[]. Installation is flat — install-bundle.sh installs exactly
 * the includes[] entries, there is no specialist→skill cascade. So a skill
 * an agent loads but the bundle omits will never be installed, and the
 * agent silently degrades (graceful-degradation branch).
 *
 * by-stack profile skills (dex-skill-{dotnet,ts,python,...}-*) are exempt
 * ONLY while the bundle ships no skill of that stack: language-agnostic agents
 * load them conditionally per detected project stack (see dex-skill-stack-registry),
 * so they arrive by what the user has installed, not in every bundle. Once a
 * bundle commits to a stack (already includes >=1 skill of it), it is a stack
 * bundle and MUST be closed over that stack too, or its stack-specific agents
 * (e.g. dex-dotnet-coder) silently degrade.
 *
 * Also checks:
 *   - every includes[] entry exists in marketplace.json (else install fails)
 *   - plugin.json version matches the bundle's version in marketplace.json
 *     (the real two-place sync; bundle.json itself carries no version)
 *
 * Usage:
 *   node tools/validate-bundle.js <bundle-dir|bundle.json>   # single bundle
 *   node tools/validate-bundle.js all                        # all bundles
 *
 * Exit codes:
 *   0 — clean
 *   1 — at least one error found
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const BUNDLES_DIR = join(REPO_ROOT, 'plugins', 'bundles');
const SPECIALISTS_DIR = join(REPO_ROOT, 'plugins', 'specialists');
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

// by-stack profile skill prefixes — exempt from the closure rule.
// A skill `dex-skill-<prefix>-*` is loaded conditionally per project stack
// by language-agnostic agents, so it is NOT required to sit in every bundle.
// `dotnet|ts|python` are the canonical stacks from dex-skill-stack-registry;
// the rest are infra/profile skills loaded the same conditional way.
const BY_STACK_PREFIXES = [
  'dotnet',
  'ts',
  'python',
  'react',
  'rabbitmq',
  'kafka',
  'redis',
  'mongodb',
  'elasticsearch',
  'docker',
  'kubernetes',
  'gitlab-ci',
  'github-actions',
  'teamcity',
  'jenkins',
  'playwright',
];

// Return the by-stack prefix a skill belongs to (e.g. "dotnet"), or null if
// the skill is stack-neutral. A `dex-skill-<prefix>-*` (or bare
// `dex-skill-<prefix>`) skill is loaded conditionally per project stack.
function stackOf(skillPlugin) {
  return (
    BY_STACK_PREFIXES.find(
      (p) => skillPlugin.startsWith(`dex-skill-${p}-`) || skillPlugin === `dex-skill-${p}`
    ) || null
  );
}

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

// Map: plugin name -> version as declared in marketplace.json.
function loadMarketplaceVersions() {
  const map = new Map();
  if (!existsSync(MARKETPLACE_JSON)) return map;
  try {
    const json = JSON.parse(readFileSync(MARKETPLACE_JSON, 'utf8'));
    for (const p of json.plugins || []) {
      if (p && p.name && p.version) map.set(p.name, p.version);
    }
  } catch {
    /* ignore */
  }
  return map;
}

// --- Specialist → loaded skills map -------------------------------------

// Map: specialist plugin dir name -> Set of dex-skill-* plugins its agent(s)
// load imperatively. Built once by walking plugins/specialists/**/agents/*.md
// and extracting `dex-skill-X:Y` references (same regex as validate-agent.js).
function buildAgentSkillMap() {
  const map = new Map();
  const re = /`?(dex-skill-[a-z0-9-]+):[a-z0-9-]+`?/gi;

  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (entry.endsWith('.md') && full.includes('/agents/')) {
        // plugins/specialists/<group>/<plugin>/agents/<agent>.md
        const m = full.match(/plugins\/specialists\/[^/]+\/([^/]+)\/agents\//);
        if (!m) continue;
        const plugin = m[1];
        const body = readFileSync(full, 'utf8');
        const set = map.get(plugin) || new Set();
        for (const match of body.matchAll(re)) {
          const skill = match[1];
          // skip glob/example artifacts like `dex-skill-dotnet-*`
          if (/-$/.test(skill)) continue;
          set.add(skill);
        }
        map.set(plugin, set);
      }
    }
  }
  walk(SPECIALISTS_DIR);
  return map;
}

// --- Bundle discovery ---------------------------------------------------

function findAllBundleFiles() {
  const result = [];
  if (!existsSync(BUNDLES_DIR)) return result;
  for (const entry of readdirSync(BUNDLES_DIR)) {
    const bj = join(BUNDLES_DIR, entry, 'bundle.json');
    if (existsSync(bj)) result.push(bj);
  }
  return result;
}

function resolveBundleFile(target) {
  const abs = resolve(target);
  if (existsSync(abs) && statSync(abs).isFile()) return abs;
  // directory or bundle name
  const asDir = join(abs, 'bundle.json');
  if (existsSync(asDir)) return asDir;
  const asName = join(BUNDLES_DIR, basename(target), 'bundle.json');
  if (existsSync(asName)) return asName;
  return null;
}

// --- Validation ---------------------------------------------------------

function validateBundle(bundleFile, marketplacePlugins, marketplaceVersions, agentSkillMap, skillPluginsInRepo) {
  const findings = [];
  let bundle;
  try {
    bundle = JSON.parse(readFileSync(bundleFile, 'utf8'));
  } catch (e) {
    return { filepath: bundleFile, findings: [{ level: ERROR, rule: 'read-failed', message: `Failed to parse bundle.json: ${e.message}` }] };
  }

  const includes = Array.isArray(bundle.includes) ? bundle.includes : [];
  if (includes.length === 0) {
    findings.push({ level: ERROR, rule: 'empty-includes', message: 'bundle.json has no includes[]' });
    return { filepath: bundleFile, findings };
  }
  const includeSet = new Set(includes);

  // 1. Every include exists in marketplace.json (else install-bundle errors).
  for (const comp of includes) {
    if (!marketplacePlugins.has(comp)) {
      findings.push({
        level: ERROR,
        rule: 'include-not-in-marketplace',
        message: `includes[] entry "${comp}" not declared in marketplace.json — install-bundle will fail`,
      });
    }
  }

  // 2. Closure: each skill an agent in this bundle loads must be in includes[].
  //    A by-stack skill (dex-skill-<stack>-*) is exempt ONLY while the bundle
  //    ships no skill of that stack — such skills arrive per the user's stack.
  //    But once a bundle commits to a stack (already includes >=1 skill of it),
  //    it is a stack bundle and must be closed over that stack too, else a
  //    stack-specific agent (e.g. dex-dotnet-coder) silently degrades.
  //    Note: commitment is judged by skills in includes[], not by the presence
  //    of a stack-specific specialist — a bundle that ships a stack agent but
  //    zero stack skills is left to review, not flagged here.
  const committedStacks = new Set();
  for (const comp of includes) {
    const st = stackOf(comp);
    if (st) committedStacks.add(st);
  }
  for (const comp of includes) {
    const loaded = agentSkillMap.get(comp);
    if (!loaded) continue; // not a specialist, or loads no skills
    for (const skill of loaded) {
      if (!skillPluginsInRepo.has(skill)) continue; // unknown skill is validate-agent.js's job
      const st = stackOf(skill);
      if (st && !committedStacks.has(st)) continue; // by-stack, bundle not committed to it
      if (!includeSet.has(skill)) {
        findings.push({
          level: ERROR,
          rule: 'bundle-not-closed',
          message: `agent "${comp}" loads "${skill}" but it is missing from includes[] — bundle not closed; add it or the agent degrades`,
        });
      }
    }
  }

  // 3. Version sync: plugin.json version must match this bundle's version in
  //    marketplace.json (the real two-place sync; bundle.json carries no version).
  const pluginJson = join(dirname(bundleFile), '.claude-plugin', 'plugin.json');
  if (existsSync(pluginJson)) {
    try {
      const pj = JSON.parse(readFileSync(pluginJson, 'utf8'));
      const marketVersion = pj.name ? marketplaceVersions.get(pj.name) : undefined;
      if (pj.version && marketVersion && pj.version !== marketVersion) {
        findings.push({
          level: WARNING,
          rule: 'version-mismatch',
          message: `plugin.json version (${pj.version}) != marketplace.json version (${marketVersion}) for "${pj.name}"`,
        });
      }
    } catch {
      /* plugin.json parse handled by other validators */
    }
  }

  return { filepath: bundleFile, findings };
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
    console.log(`\n${COLORS.bold}${relative(REPO_ROOT, result.filepath)}${COLORS.reset}`);
    for (const f of result.findings) console.log(formatFinding(f));
  }

  console.log('');
  console.log(
    `${COLORS.bold}Summary:${COLORS.reset} ${results.length} bundle(s) checked, ` +
      `${COLORS.red}${totalErrors} error(s)${COLORS.reset}, ` +
      `${COLORS.yellow}${totalWarnings} warning(s)${COLORS.reset}` +
      (filesWithIssues > 0 ? `, ${filesWithIssues} file(s) with issues` : '')
  );

  return totalErrors > 0 ? 1 : 0;
}

// --- Main ---------------------------------------------------------------

function buildSkillPluginsInRepo() {
  const set = new Set();
  // Скиллы живут не только в plugins/skills (например plugins/ai-sdlc). Обходим весь
  // plugins/ по SKILL.md - как findAllSkillFiles в validate-skill.js - и берём name из
  // манифеста плагина-владельца. Иначе closure-чек не видит скиллы вне plugins/skills и
  // молча их пропускает (правило bundle-not-closed на них не срабатывает).
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry === 'SKILL.md') {
        // <plugin>/skills/<name>/SKILL.md -> <plugin>/.claude-plugin/plugin.json
        const pj = join(dirname(dirname(dirname(full))), '.claude-plugin', 'plugin.json');
        if (existsSync(pj)) {
          try {
            set.add(JSON.parse(readFileSync(pj, 'utf8')).name);
          } catch {
            /* ignore */
          }
        }
      }
    }
  }
  walk(join(REPO_ROOT, 'plugins'));
  return set;
}

function main() {
  const { target } = parseArgs(process.argv);
  const marketplacePlugins = loadMarketplacePlugins();
  const marketplaceVersions = loadMarketplaceVersions();
  const agentSkillMap = buildAgentSkillMap();
  const skillPluginsInRepo = buildSkillPluginsInRepo();

  let files;
  if (target === 'all') {
    files = findAllBundleFiles();
    if (files.length === 0) {
      console.error(`No bundles found under ${relative(REPO_ROOT, BUNDLES_DIR)}`);
      process.exit(1);
    }
  } else {
    const f = resolveBundleFile(target);
    if (!f) {
      console.error(`Bundle not found: ${target}`);
      process.exit(1);
    }
    files = [f];
  }

  const results = files.map((f) =>
    validateBundle(f, marketplacePlugins, marketplaceVersions, agentSkillMap, skillPluginsInRepo)
  );
  process.exit(report(results));
}

main();
