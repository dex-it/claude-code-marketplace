export const meta = { name: 'dex-fixture-auto-load', description: 'Фикстурный трек: промпт узла предписывает Skill' }
const out = await agent('Шаг 1: вызови Skill dex-skill-fixture:fixture.', { label: 'load', agentType: 'dex-fixture-auto:fixture-node' })
return out
