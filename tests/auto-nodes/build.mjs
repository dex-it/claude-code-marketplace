// build.mjs <узел> <out.js>: скрипт Workflow прогона узла - источники tracks-shared, own-commits.js нужен hunksAsk из self-review.js (модели узлов - NODE из nodes.js, как в треке), кейсы узла только с полями из перечня NODE_FIELDS (поля судьи - JUDGE_FIELDS - вырезаются, неизвестное поле - отказ сборки), тело <узел>/node.js.

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const [nodeName, out] = process.argv.slice(2)
if (!nodeName || !out) { console.error('использование: build.mjs <узел> <out.js>'); process.exit(2) }
const shared = join(here, '../../plugins/auto/tracks-shared')
// Скрипт лежит в каталоге прогона выше рабочего каталога узла, прочитать его узел может: поле судьи, попавшее в CASES, подсказывает ответ.
// Поэтому два закрытых перечня: новое поле кейса ни туда, ни туда не попадёт молча.
const JUDGE_FIELDS = ['mines', 'score', 'cause', 'decoys', 'expect', 'false_lead']
const NODE_FIELDS = ['task', 'kind', 'stack', 'goal', 'expected', 'done', 'boundary', 'source', 'test_cmd', 'build_cmd', 'requirements', 'files',
  'commit', 'base', 'change', 'coder', 'repro', 'findings', 'axes']
const cases = {}
for (const d of readdirSync(join(here, nodeName)).sort()) {
  const f = join(here, nodeName, d, 'case.json')
  if (!existsSync(f)) continue
  const c = {}
  for (const [k, v] of Object.entries(JSON.parse(readFileSync(f, 'utf8')))) {
    if (JUDGE_FIELDS.includes(k)) continue
    if (!NODE_FIELDS.includes(k)) { console.error(`build.mjs: поле «${k}» кейса ${d} не в перечне NODE_FIELDS и не в JUDGE_FIELDS: отнеси его к одному из двух`); process.exit(1) }
    c[k] = v
  }
  cases[d] = c
}
const PHASE = { reviewer: 'Review', coder: 'Implement', debugger: 'Reproduce', skeptic: 'Falsify' }
const meta = `export const meta = {\n  name: 'auto-node-${nodeName}',\n  description: 'Прогон узла ${nodeName} на кейсе tests/auto-nodes',\n  phases: [{ title: '${PHASE[nodeName] || 'Review'}' }],\n}\n`
const src = (f) => `// >>> ${f}\n${readFileSync(join(shared, f), 'utf8')}\n`
// Схема диагноста живёт в треке, не в tracks-shared: берётся из bugfix.js как есть.
const fromTrack = (track, name) => readFileSync(join(here, '../../plugins/auto/dex-auto/tracks', track), 'utf8').match(new RegExp(`^const ${name} = [\\s\\S]*?^\\}, required: .*$`, 'm'))[0] + '\n'
const repro = nodeName === 'debugger' ? fromTrack('bugfix.js', 'REPRO') : ''
// Промпт узла - тот же, что в треке: хвост шага кодера сверяется с feature.js, расхождение - отказ сборки (молча разъехавшийся
// промпт делает меру стенда мерой не того узла, который едет в треке).
if (nodeName === 'coder') {
  const tail = (s) => (s.match(/\\nПо завершении: [^`]*`/) || [])[0]
  const track = tail(readFileSync(join(here, '../../plugins/auto/dex-auto/tracks/feature.js'), 'utf8').split('\n').find(l => l.includes("fix = await own('кодер'")) || '')
  const bench = tail(readFileSync(join(here, 'coder/node.js'), 'utf8'))
  if (!track || track !== bench) { console.error(`промпт кодера стенда разошёлся с feature.js: ${bench} против ${track}`); process.exit(1) }
}

writeFileSync(out, meta + src('contract.js') + src('nodes.js') + src('domain.js') + src('falsify.js') + src('own-commits.js') + src('self-review.js') + repro
  + `const CASES = ${JSON.stringify(cases, null, 2)}\n` + readFileSync(join(here, nodeName, 'node.js'), 'utf8'))
console.log(out)
