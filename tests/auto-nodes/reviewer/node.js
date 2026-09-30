// Тело прогона: промпт узла саморевью собран, как в feature.js и bugfix.js на шаге 3 (первое ревью, прежних находок нет).
const A = args
const C = CASES[A.case]
const TREE = `Рабочий каталог - ${A.cwd}: отдельное git worktree трека на ветке auto/${C.task}, процесс уже в нём; чужой работы в нём нет - всё незакоммиченное в нём от этой работы. Дерево сессии, от которого оно заведено, не трогай. Push, деплой, миграции данных и удаление вне рабочего дерева не делать - это стоп-линия. Оператора нет: невыводимое не додумывай, верни status: blocked с полем нехватки.\n`
const TAIL = `\nфайл цели: нет\ndecision-log: n/a (трек журнал решений не ведёт; решения - полем decisions)\n${TREE}`
const HEAD = C.kind === 'bugfix'
  ? `mode: autonomous\nцель (${C.task}): починить баг - симптом: ${C.goal}\nожидаемое: ${C.expected}\nокружение: не задано\nкритерий «готово»: ${C.done}\nграница: ${C.boundary}${TAIL}`
  : `mode: autonomous\nцель (${C.task}): ${C.goal}\nкритерий «готово»: ${C.done}\nграница: ${C.boundary}${TAIL}`
const causeOf = (d) => `Первопричина: ${d.root_cause}\nВоспроизведение: ${d.reproduction}\nОснование ожидаемого: ${d['expected-basis']}\nПредложение фикса: ${d.fix_proposal}${d.repro_test ? `\nТест диагноста: ${d.repro_test}` : ''}`
const INTENT = C.kind === 'bugfix' ? ` Источник намерения:\n${causeOf(C.repro)}` : ` Источник намерения - требования:\n${C.requirements.join('\n')}`
const PROMPT = `${HEAD}Шаг 3 (первое): pre-push саморевью локальной ветки - коммиты этой цели плюс рабочее дерево.${coderInput(C.coder)}${INTENT}\nПрогон build/test реальный, итог - в run-status, не в findings. Код не меняй.`
const NODES = {
  old: { agentType: 'dex-self-reviewer:self-reviewer', schema: REVIEW },
  new: { agentType: 'dex-auto:reviewer', model: 'opus', schema: REVIEW },
}
phase('Review')
return await agent(PROMPT, { label: `review:${A.node}:${A.case}`, phase: 'Review', ...NODES[A.node] })
