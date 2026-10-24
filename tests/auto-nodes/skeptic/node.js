// Тело прогона: промпт скептика собран, как в review.js на шаге 3 (первичное ревью, прежних находок нет); выход ревьюера - из кейса, дерево на HEAD правки.
const A = args
const C = CASES[A.case]
const MR = `локальная ветка auto/${C.task} (хостинга нет)`
const HEAD = `mode: autonomous\nцель (${C.task}): ревью ${MR}.\nread-only: код не менять, тесты не писать, в MR ничего не публиковать - публикует отдельный узел по санкции.\nРабочий каталог - ${A.cwd}, процесс уже в нём. Веток не создавай, код не меняй, коммитов не делай. Оператора нет: невыводимое верни status: blocked с полем нехватки; неясность намерения по diff - вопрос автору в перечне, не оператору.\n`
const intent = `требования FEAT.md - ${C.requirements.join(' ') || 'нет'}`
const common = `MR/PR: ${MR}, BASE_SHA ${A.base}, HEAD_SHA ${A.head}, файлов ${C.files.length}. intent: ${intent}. publish: false - ноль записей в MR. Дерево ${A.cwd} переключено на ${A.head}, код читай с диска; ревизию не переключай - нужна другая, читай её через git show.${conventionsText({ conventions: C.conventions || [], 'conventions-searched': C['conventions-searched'] || 'кейс не задаёт' })}`
const fmt = (fs) => fs.map(findingLine).join('\n')
const PROMPT = `${HEAD}Шаг 3: фальсификация находок, исходов осей и решений ревьюера, вердикт по покрытию. ${common}\nНаходки:\n${fmt(C.findings) || '- находок нет: только вердикт по покрытию'}\nОси ревьюера:\n${axesText(C.axes)}\nРешения ревьюера:\n${rootsText(C.roots)}`
const NODES = { new: { ...NODE.skeptic, schema: FALSIFY } }
phase('Falsify')
return await agent(PROMPT, { label: `falsify:${A.node}:${A.case}`, phase: 'Falsify', ...NODES[A.node] })
