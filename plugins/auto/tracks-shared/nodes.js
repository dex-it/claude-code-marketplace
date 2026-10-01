// Цену узла ставит трек, frontmatter узла её не несёт; запись без model и effort - уровень сессии.
const NODE = {
  // sonnet - модель пробы в прогонах P76-P86.
  'goal-reader': { agentType: 'dex-auto:goal-reader', model: 'sonnet' },
  // opus - модель контроля dex-self-reviewer: сверка P74 различает норму, а не модель.
  reviewer: { agentType: 'dex-auto:reviewer', model: 'opus' },
  // без model - замера модели скептика нет (#289).
  skeptic: { agentType: 'dex-auto:skeptic' },
  // sonnet - модель кодеров каталога: сверка P75 различает норму, а не модель.
  coder: { agentType: 'dex-auto:coder', model: 'sonnet' },
  // opus - модель контроля dex-debugger: сверка P91 различает норму, а не модель.
  debugger: { agentType: 'dex-auto:debugger', model: 'opus' },
  // sonnet - узел исполняет публикацию по каналу хостинга, суждения о коде у него нет.
  deliverer: { agentType: 'dex-auto:deliverer', model: 'sonnet' },
}
