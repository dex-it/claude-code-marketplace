export const meta = { name: 'fixture-track', description: 'Фикстурный трек: вызывает узел по agentType' }
const NODE = { 'fixture-node': { agentType: 'dex-fixture-specialist:fixture-node', model: 'sonnet' } }
return await agent('узел', { label: 'узел', ...NODE['fixture-node'] })
