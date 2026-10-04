export const meta = { name: 'dex-fixture-auto-track', description: 'Фикстурный трек: вызывает узел трека по agentType' }
const out = await agent('Шаг 1: выход по схеме трека.', { label: 'node', agentType: 'dex-fixture-auto:fixture-node', schema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] } })
return out
