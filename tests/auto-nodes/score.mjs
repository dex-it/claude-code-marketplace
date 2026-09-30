// score.mjs <каталог прогона>: выход узла по каждому прогону, следы, токены и цена; мера по узлу - README стенда.
import { readFileSync, readdirSync, existsSync, cpSync, rmSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, execSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const out = process.argv[2]
const nodeName = (readFileSync(join(out, 'workflow.js'), 'utf8').match(/name: 'auto-node-([a-z-]+)'/) || [])[1]
const slug = (p) => p.replace(/[^A-Za-z0-9-]/g, '-')
const projects = join(process.env.CLAUDE_CONFIG_DIR || join(process.env.HOME, '.claude'), 'projects')
const cut = (s, n = 200) => String(s ?? '').replace(/\s+/g, ' ').slice(0, n)
const walk = (d, hit) => existsSync(d) ? readdirSync(d).flatMap(e => {
  const p = join(d, e)
  return statSync(p).isDirectory() ? walk(p, hit) : hit(p) ? [p] : []
}) : []
const near = (f, m) => {
  const [file, line] = String(f.anchor || '').split(':')
  if (!file || !file.endsWith(m.file)) return false
  const n = parseInt(line, 10)
  return Number.isNaN(n) || (n >= m.lines[0] - 2 && n <= m.lines[1] + 2)
}
const sh = (cmd, cwd, re) => {
  let text = '', code = 0
  try { text = execSync(`${cmd} 2>&1`, { cwd, shell: '/bin/bash', encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 26 }) }
  catch (e) { text = String(e.stdout || '') + String(e.stderr || ''); code = e.status ?? 1 }
  const failed = [...new Set([...text.matchAll(new RegExp(re, 'gm'))].map(m => m[1].trim()))]
  return { code, failed, tail: text.trim().split('\n').slice(-3).join(' / ') }
}
// Итог кодера - закоммиченный HEAD; коммита нет - рабочее дерево как есть, с пометкой в выводе.
const snapshot = (repo, dest, ahead) => {
  rmSync(dest, { recursive: true, force: true })
  if (ahead) execFileSync('git', ['clone', '-q', repo, dest])
  else cpSync(repo, dest, { recursive: true, filter: (s) => !/\/(bin|obj|node_modules|__pycache__|\.pytest_cache)$/.test(s) })
}

const toolTally = (logs) => {
  const skills = [], tools = {}
  for (const f of logs) for (const line of readFileSync(f, 'utf8').split('\n')) {
    let e; try { e = JSON.parse(line) } catch { continue }
    for (const b of (e.message && Array.isArray(e.message.content) ? e.message.content : [])) {
      if (b.type !== 'tool_use') continue
      tools[b.name] = (tools[b.name] || 0) + 1
      if (b.name === 'Skill') skills.push(b.input && b.input.skill)
    }
  }
  console.log(`  Skill: ${skills.join(', ') || 'нет'}`)
  console.log(`  tools: ${Object.entries(tools).map(([k, v]) => `${k}=${v}`).join(' ')}`)
}

function reviewer(c, r) {
  const mines = JSON.parse(readFileSync(join(here, 'reviewer', c, 'case.json'), 'utf8')).mines
  console.log(`  status=${r.status} verdict=${r['review-verdict']} intent-status=${r['intent-status']} findings=${r.findings.length}`)
  console.log(`  run-status: ${cut(r['run-status'], 160)}`)
  console.log(`  red-run: ${cut(r['red-run'], 160)}`)
  for (const m of mines) {
    const hits = r.findings.filter(f => near(f, m))
    console.log(`  ${m.id}${m.blocking ? '*' : ''} ${m.file}:${m.lines.join('-')} -> ${hits.map(f => f.severity).join(',') || '-'}`)
  }
  r.findings.forEach((f, i) => console.log(`  [${i}] ${f.severity} ${f.axis} ${f.anchor}: ${cut(f.text, 220)}`))
}

function coder(id, c, r, repo, logs) {
  const caseDir = join(here, 'coder', c)
  const sc = JSON.parse(readFileSync(join(caseDir, 'case.json'), 'utf8')).score
  const log = execFileSync('git', ['-C', repo, 'log', '--format=%h %s', 'main..HEAD'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  console.log(`  status=${r.status} commit=${r.commit || '-'} коммитов на ветке: ${log.length}${log.length ? ' - ' + log.map(l => cut(l, 80)).join('; ') : ''}`)
  console.log(`  plan (${(r.plan || []).length}):\n` + (r.plan || []).map(x => `    ${x.where}: ${x.change} [${x.trace}]`).join('\n'))
  console.log(`  run-status: ${cut(r['run-status'], 160)}`)
  console.log(`  red-run: ${cut(r['red-run'], 240)}`)
  console.log(`  uncovered: ${r['uncovered-status']} ${cut((r.uncovered || []).join('; '), 200)}`)
  console.log(`  dependents: ${r['dependents-status']} ${cut((r.dependents || []).join('; '), 200)}`)
  console.log(`  fact-check: ${cut(r['fact-check'], 160)}`)
  ;(r.decisions || []).forEach(d => console.log(`  decision: ${cut(d, 220)}`))
  if (r.missing) console.log(`  missing: ${cut(r.missing)}`)
  if ((r.degraded || []).length) console.log(`  degraded: ${cut(r.degraded.join('; '))}`)
  toolTally(logs)
  const base = join(out, id, 'eval-')
  const src = log.length ? 'HEAD' : 'рабочее дерево (коммита нет)'
  snapshot(repo, base + 'oracle', log.length)
  cpSync(join(caseDir, 'oracle'), join(base + 'oracle', sc.oracle_dest), { recursive: true })
  const o = sh(sc.oracle_cmd, base + 'oracle', sc.fail_re)
  console.log(`  оракул на ${src}: exit=${o.code} упали: ${o.failed.join(', ') || (o.code ? o.tail : 'нет')}`)
  for (const [what, cmd] of Object.entries(sc.shape || {})) {
    let t; try { t = execFileSync('bash', ['-c', cmd], { cwd: repo, encoding: 'utf8' }) } catch (e) { t = String(e.stdout || e.message) }
    console.log(`  форма - ${what}:\n    ${t.trim().split('\n').join('\n    ')}`)
  }
  // Эталон вместо реализации кодера снимает его добавки к API: убит тот мутант, на котором краснеет тест, зелёный на эталоне.
  const overlay = (name, from) => {
    snapshot(repo, base + name, log.length)
    cpSync(from, base + name, { recursive: true })
    return sh(sc.tests_cmd, base + name, sc.fail_re)
  }
  const ref = overlay('ref', join(caseDir, 'ref'))
  console.log(`  эталон под тестами кодера: exit=${ref.code}${ref.code ? ` упали: ${ref.failed.join(', ') || ref.tail}` : ''}`)
  // Мутант, уронивший только тесты, красные и на эталоне, не судим: тест закрепил выбор сверх требований, и дефект за ним не виден.
  const tally = { убит: 0, ЖИВ: 0, 'не судим': 0 }
  for (const [m, what] of Object.entries(sc.mutants)) {
    const x = overlay(m, join(caseDir, 'mutants', m))
    const kills = x.failed.filter(t => !ref.failed.includes(t))
    const v = kills.length || (x.code && !ref.code) ? 'убит' : x.code ? 'не судим' : 'ЖИВ'
    tally[v]++
    console.log(`    ${v.padEnd(8)} ${m} (${what})${v === 'убит' ? ': ' + cut(kills.join(', ') || x.tail, 120) : ''}`)
  }
  console.log(`  мутанты из ${Object.keys(sc.mutants).length}: ${Object.entries(tally).map(([k, n]) => `${k} ${n}`).join(', ')}`)
}

// Причина засчитана, если якорь root_cause попал в место засеянной причины; только в приманку - назван симптом.
// Тест диагноста судится прогоном: красный на дереве узла и зелёный под эталонной правкой - падает по причине симптома.
function debuggerNode(id, c, r, repo, logs) {
  const caseDir = join(here, 'debugger', c)
  const k = JSON.parse(readFileSync(join(caseDir, 'case.json'), 'utf8'))
  const anchors = [...String(r.root_cause || '').matchAll(/([\w./-]+\.\w+):(\d+)/g)].map(m => ({ anchor: `${m[1]}:${m[2]}` }))
  const at = (m) => anchors.some(a => near(a, m))
  const verdict = at(k.cause) ? 'ПРИЧИНА' : k.decoys.some(at) ? 'симптом' : anchors.length ? 'мимо' : 'нет якоря'
  const log = execFileSync('git', ['-C', repo, 'log', '--format=%h %s', 'main..HEAD'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  console.log(`  status=${r.status} причина: ${verdict} коммитов на ветке: ${log.length}`)
  console.log(`  root_cause: ${cut(r.root_cause, 300)}`)
  console.log(`  expected-basis: ${cut(r['expected-basis'], 160)}`)
  console.log(`  reproduction: ${cut(r.reproduction, 240)}`)
  console.log(`  fix_proposal: ${cut(r.fix_proposal, 200)}`)
  const fl = r.falsification || []
  console.log(`  falsification (${fl.length}; refuted ${fl.filter(x => x.outcome === 'refuted').length}):\n` + fl.map(x => `    ${x.outcome}: ${cut(x.prediction, 140)} -> ${cut(x.observation, 140)}`).join('\n'))
  console.log(`  fact-check: ${cut(r['fact-check'], 160)}`)
  console.log(`  conflicts: ${r['conflict-status']} ${cut((r.conflicts || []).join('; '), 200)}`)
  if (r.missing) console.log(`  missing: ${cut(r.missing)}`)
  if ((r.degraded || []).length) console.log(`  degraded: ${cut(r.degraded.join('; '))}`)
  toolTally(logs)
  const base = join(out, id, 'eval-')
  const onTree = sh(k.score.tests_cmd, repo, k.score.fail_re)
  snapshot(repo, base + 'ref', false)
  cpSync(join(caseDir, 'ref'), base + 'ref', { recursive: true })
  const onRef = sh(k.score.tests_cmd, base + 'ref', k.score.fail_re)
  console.log(`  тест ${r.repro_test || '-'}: дерево узла exit=${onTree.code} упали: ${onTree.failed.join(', ') || '-'}; под эталоном exit=${onRef.code}${onRef.code ? ' упали: ' + (onRef.failed.join(', ') || onRef.tail) : ''}`)
}

for (const id of readdirSync(out).filter(d => existsSync(join(out, d, 'repo'))).sort()) {
  const c = id.replace(/-(old|new)-\d+$/, '')
  const repo = join(out, id, 'repo')
  const dir = join(projects, slug(repo))
  let wf = null
  for (const f of walk(dir, p => /\/workflows\/[^/]+\.json$/.test(p) && !p.includes('/subagents/'))) wf = JSON.parse(readFileSync(f, 'utf8'))
  let head = {}
  try { head = JSON.parse(readFileSync(join(out, id, 'out.json'), 'utf8')) } catch {}
  const r = wf && wf.result
  const tokens = wf ? (wf.workflowProgress || []).reduce((a, w) => a + (w.tokens || 0), 0) : 0
  console.log(`\n## ${id}  cost(main+nodes)=$${(head.total_cost_usd || 0).toFixed(2)}  node-tokens=${tokens}  dur=${Math.round((head.duration_ms || 0) / 1000)}s`)
  const litter = readdirSync(join(out, id)).filter(e => !['repo', 'out.json', 'err.log'].includes(e) && !e.startsWith('eval-')).map(e => `../${e}`)
  // У кодера и диагноста вывод сборки и тестов под .gitignore законен; следом считается только неотслеживаемое и изменённое.
  const dirty = execFileSync('git', ['-C', repo, 'status', '--porcelain', ...(nodeName === 'reviewer' ? ['--ignored'] : [])], { encoding: 'utf8' }).split('\n').filter(Boolean)
  console.log(`  следы: ${[...litter, ...dirty].join(', ') || 'нет'}`)
  if (!r) { console.log('  результата нет'); continue }
  const logs = walk(dir, p => /\/subagents\/.*agent-[^/]*\.jsonl$/.test(p))
  if (nodeName === 'coder') coder(id, c, r, repo, logs)
  else if (nodeName === 'debugger') debuggerNode(id, c, r, repo, logs)
  else { reviewer(c, r); toolTally(logs) }
}
