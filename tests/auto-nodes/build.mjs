// build.mjs <узел> <out.js>: скрипт Workflow прогона узла - источники tracks-shared (модели узлов - NODE из nodes.js, как в треке), кейсы узла без полей судьи (mines, score, cause, decoys, expect), тело <узел>/node.js.

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const [nodeName, out] = process.argv.slice(2)
if (!nodeName || !out) { console.error('использование: build.mjs <узел> <out.js>'); process.exit(2) }
const shared = join(here, '../../plugins/auto/tracks-shared')
const cases = {}
for (const d of readdirSync(join(here, nodeName)).sort()) {
  const f = join(here, nodeName, d, 'case.json')
  if (existsSync(f)) { const { mines, score, cause, decoys, expect, ...c } = JSON.parse(readFileSync(f, 'utf8')); cases[d] = c }
}
const PHASE = { reviewer: 'Review', coder: 'Implement', debugger: 'Reproduce', skeptic: 'Falsify' }
const meta = `export const meta = {\n  name: 'auto-node-${nodeName}',\n  description: 'Прогон узла ${nodeName} на кейсе tests/auto-nodes',\n  phases: [{ title: '${PHASE[nodeName] || 'Review'}' }],\n}\n`
const src = (f) => `// >>> ${f}\n${readFileSync(join(shared, f), 'utf8')}\n`
// Схемы диагноста и скептика живут в треке, не в tracks-shared: берутся из bugfix.js и review.js как есть.
const fromTrack = (track, name) => readFileSync(join(here, '../../plugins/auto/dex-auto/tracks', track), 'utf8').match(new RegExp(`^const ${name} = [\\s\\S]*?^\\}, required: .*$`, 'm'))[0] + '\n'
const repro = nodeName === 'debugger' ? fromTrack('bugfix.js', 'REPRO') : nodeName === 'skeptic' ? fromTrack('review.js', 'FALSIFY') : ''
// Промпт узла - тот же, что в треке: хвост шага кодера сверяется с feature.js, расхождение - отказ сборки (молча разъехавшийся
// промпт делает меру стенда мерой не того узла, который едет в треке).
if (nodeName === 'coder') {
  const tail = (s) => (s.match(/\\nПо завершении: [^`]*`/) || [])[0]
  const track = tail(readFileSync(join(here, '../../plugins/auto/dex-auto/tracks/feature.js'), 'utf8').split('\n').find(l => l.includes("fix = await own('кодер'")) || '')
  const bench = tail(readFileSync(join(here, 'coder/node.js'), 'utf8'))
  if (!track || track !== bench) { console.error(`промпт кодера стенда разошёлся с feature.js: ${bench} против ${track}`); process.exit(1) }
}

writeFileSync(out, meta + src('contract.js') + src('nodes.js') + src('domain.js') + src('self-review.js') + repro
  + `const CASES = ${JSON.stringify(cases, null, 2)}\n` + readFileSync(join(here, nodeName, 'node.js'), 'utf8'))
console.log(out)
