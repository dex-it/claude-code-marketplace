// Фикстурный трек: схемы, которые сканер не разбирает литералом, - константа вместо required и properties, spread в required, незакрытый шаблон в конце файла.
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

phase('Fix')
const fix = await agent(`почини предмет песочницы, итог в поле
run-status`, { label: 'fix', phase: 'Fix', schema: FIX })
const tail = `незакрытый промпт
