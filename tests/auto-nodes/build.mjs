// build.mjs <узел> <out.js>: скрипт Workflow прогона узла - источники tracks-shared, кейсы узла без полей судьи (mines, score), тело <узел>/node.js.
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
  if (existsSync(f)) { const { mines, score, ...c } = JSON.parse(readFileSync(f, 'utf8')); cases[d] = c }
}
const PHASE = { reviewer: 'Review', coder: 'Implement' }
const meta = `export const meta = {\n  name: 'auto-node-${nodeName}',\n  description: 'Прогон узла ${nodeName} на кейсе tests/auto-nodes',\n  phases: [{ title: '${PHASE[nodeName] || 'Review'}' }],\n}\n`
const src = (f) => `// >>> ${f}\n${readFileSync(join(shared, f), 'utf8')}\n`
writeFileSync(out, meta + src('contract.js') + src('domain.js') + src('self-review.js')
  + `const CASES = ${JSON.stringify(cases, null, 2)}\n` + readFileSync(join(here, nodeName, 'node.js'), 'utf8'))
console.log(out)
