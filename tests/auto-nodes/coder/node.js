// Тело прогона: промпт кодера собран, как в feature.js на шаге 2 (попытка 1, дерево зелёное до правок, подготовки нет).
const A = args
const C = CASES[A.case]
const degraded = []
const TREE = `Рабочий каталог - ${A.cwd}: отдельное git worktree трека на ветке auto/${C.task}, процесс уже в нём; чужой работы в нём нет - всё незакоммиченное в нём от этой работы. Дерево сессии, от которого оно заведено, не трогай. Push, деплой, миграции данных и удаление вне рабочего дерева не делать - это стоп-линия. Оператора нет: невыводимое не додумывай, верни status: blocked с полем нехватки.\n`
const HEAD = `mode: autonomous\nцель (${C.task}): ${C.goal}\nкритерий «готово»: ${C.done}\nграница: ${C.boundary}\nфайл цели: нет\ndecision-log: n/a (трек журнал решений не ведёт; решения - полем decisions)\n${TREE}`
const PROMPT = `${HEAD}Шаг 2, попытка 1 из 3: реализация по требованиям, TDD (тесты на каждую R).\nТребования:\n${C.requirements.join('\n')}\nФайлы: ${C.files.join(', ')}. Тесты: ${C.test_cmd || 'нет'}. Сборка: ${C.build_cmd || 'нет'}. До правок трека сборка и тесты были зелёными: любое падение внесено правками трека.\nПо завершении: сборка и тесты зелёные, коммит локально (сообщение по цели, без служебной нумерации R), push не делать.`
const opts = { label: `fix:${A.node}:${A.case}`, phase: 'Implement', schema: FIX }
phase('Implement')
const r = A.node === 'old'
  ? await node('кодер', PROMPT, opts, CODER[C.stack])
  : await own('кодер', PROMPT, opts, { agentType: 'dex-auto:coder', model: 'sonnet' })
return { ...r, degraded }
