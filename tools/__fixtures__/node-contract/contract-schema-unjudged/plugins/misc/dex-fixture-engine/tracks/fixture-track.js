// Фикстурный трек: схемы, которые сканер не разбирает литералом, - константа, шаблон, spread (и spread схемы, которая сама не разобрана), вычисляемый ключ, вызов вместо перечня; незакрытый шаблон в конце файла.
export const meta = {
  name: 'fixture-track',
  description: 'Трек песочницы: схемы узлов не литералом',
  phases: [{ title: 'Fix' }],
}

const STATUS = { type: 'string', enum: ['complete', 'blocked', 'partial'] }
const REQ = ['status', 'run_status']
const PROPS = { status: STATUS }
const FIX = { type: 'object', properties: PROPS, required: REQ }
const VERIFY = { type: 'object', properties: { status: STATUS }, required: [...REQ, 'status'] }
const LITERAL = { type: 'object', properties: { status: STATUS }, required: ['status'], additionalProperties: false }
const OTHER = 'run_status'
const CONST_ITEM = { type: 'object', properties: { status: STATUS }, required: ['status', OTHER] }
const TMPL_ITEM = { type: 'object', properties: { status: STATUS }, required: ['status', `run_status`] }
const SPREAD = { type: 'object', properties: { ...PROPS, uncovered: STATUS }, required: ['status'] }
const COMPUTED = { type: 'object', properties: { status: STATUS, ['run_status']: STATUS }, required: ['status'] }
const CALLED = { type: 'object', properties: { status: STATUS }, required: ['status'].concat(REQ) }
const PAREN = { type: 'object', properties: { status: STATUS }, required: (REQ) }
const NUL = { type: 'object', properties: null, required: false }
const EXTENDED = { type: 'object', properties: { ...LITERAL.properties, uncovered: STATUS }, required: [...LITERAL.required, 'uncovered'] }
const CHAINED = { type: 'object', properties: { ...SPREAD.properties }, required: [...FIX.required] }

phase('Fix')
const made = await agent('собери', { label: 'made', phase: 'Fix', schema: makeSchema() })
const fix = await agent(`почини предмет песочницы, итог в поле
run-status`, { label: 'fix', phase: 'Fix', schema: FIX })
const tail = `незакрытый промпт
