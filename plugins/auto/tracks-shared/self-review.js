// Исход по тесту - enum: показанный красным трек передаёт следующей попытке как факт, а не ищет слово в прозе.
const RED_STATUS = ['shown', 'unverifiable']
const RED_RUN = (scope) => ({ type: 'array', items: { type: 'object', properties: { test: { type: 'string', description: 'имя или путь теста' }, status: { type: 'string', enum: RED_STATUS }, evidence: { type: 'string', description: 'shown - нарушение, на котором тест был красным (код до правки либо порча целевой ветки), и сверенная причина падения; unverifiable - чем пробовал' } }, required: ['test', 'status', 'evidence'] }, description: scope })
const redLines = (rr) => (rr || []).length ? rr.map(r => `${r.test} ${r.status}: ${r.evidence}`).join('; ') : 'пусто'
// Ключи - имена полей выдачи из файлов узлов буквально: трансляция - место тихого расхождения схемы и нормы узла.
const FIX = { type: 'object', properties: {
  status: STATUS,
  plan: { type: 'array', items: { type: 'object', properties: { where: { type: 'string' }, change: { type: 'string' }, trace: { type: 'string' } }, required: ['where', 'change', 'trace'] }, description: 'план реализации в итоговой редакции: where - файл или символ, change - суть изменения, у отступления - с причиной, trace - требование, правило проекта с якорем, стандарт или практика' },
  'diff-scope': { type: 'array', items: { type: 'string' }, description: 'пути изменённых файлов и ветка, не тела' },
  commit: { type: 'string', description: 'sha локального коммита либо пусто' },
  commands: { type: 'object', properties: { build_cmd: { type: 'string' }, test_cmd: { type: 'string' }, report_cmd: { type: 'string' } }, required: ['build_cmd', 'test_cmd', 'report_cmd'] },
  'run-status': { type: 'string', description: 'свой прогон сборки и тестов: команда и исход; проверка неприменима - n/a с причиной, запуск невозможен - unverifiable с тем, что пробовал, и тогда status partial; зелёность трек судит VERIFY-узлом, не этим полем' },
  'red-run': RED_RUN('запись на каждый новый и изменённый тест и на существующий, чью целевую ветку тронула правка (прежняя запись истекает с прежним поведением); подпадающих тестов нет - пустой перечень'),
  // Признак замкнутости - enum: свободную строку модель отдаёт синонимами, а пустое значение неотличимо от невыясненного.
  'uncovered-status': { type: 'string', enum: ['none', 'some', 'unknown'], description: 'осталось ли непокрытое тестами: none - не осталось, some - перечень в uncovered, unknown - покрытие не выяснялось; догадка сюда не пишется' },
  uncovered: { type: 'array', items: { type: 'string' }, description: 'при some - непокрытое перечнем (ветка, случай, граница); иначе пустой' },
  'dependents-status': { type: 'string', enum: ['none', 'some', 'unknown'], description: 'видно ли правку за пределами diff-scope: вызывающий код, контракт на проводе, схема данных, публичный API. none - не видно, some - видно (перечень в dependents), unknown - не разобрался; догадка сюда не пишется' },
  dependents: { type: 'array', items: { type: 'string' }, description: 'при some - потребители перечнем file:line; иначе пустой' },
  'fact-check': FACT_CHECK('сигнатура или поведение стороннего API в правке'),
  decisions: { type: 'array', items: { type: 'string' }, description: 'первой строкой - вызванные скиллы либо почему ни один не подошёл; далее каждая закрытая узлом развилка: что выбрано, из чего, почему' },
  // Пометку пробы судит ревью: кодеру находку с ней не подают, и его запись её не трогает.
  prior: { type: 'array', items: { type: 'object', properties: { id: PRIOR.properties.id, anchor: PRIOR.properties.anchor, severity: SEV, axis: PRIOR.properties.axis, text: PRIOR.properties.text, status: PRIOR.properties.status, evidence: PRIOR.properties.evidence }, required: ['id', 'anchor', 'severity', 'axis', 'text', 'status', 'evidence'] }, description: 'по каждой находке задания - запись с её id: closed - закрыта правкой, disputed - закрывать не следует; находок в задании нет - пусто' },
  missing: { type: 'string' },
}, required: ['status', 'plan', 'diff-scope', 'commit', 'commands', 'run-status', 'red-run', 'uncovered-status', 'uncovered', 'dependents-status', 'dependents', 'fact-check', 'decisions', 'prior', 'missing'] }
const REVIEW = { type: 'object', properties: {
  status: STATUS,
  findings: { type: 'array', items: { type: 'object', properties: { ref: FINDING.properties.ref, anchor: FINDING.properties.anchor, severity: SEV, axis: FINDING.properties.axis, text: FINDING.properties.text,
    closure: FINDING.properties.closure, evidence: FINDING.properties.evidence, premise: FINDING.properties.premise },
  required: ['ref', 'anchor', 'severity', 'axis', 'text', 'closure', 'evidence', 'premise'] }, description: 'только находки, которых нет в перечне прежних' },
  axes: AXES,
  roots: ROOTS,
  'run-status': { type: 'string', description: 'прогон свой, не пересказ входа' },
  'red-run': { type: 'string', description: 'вердикт по записям red-run кодера во входе: по каждому тесту дельты запись действует / красным не показан (unverifiable кодера) / отсутствует / истекла; записей не было - unverifiable + что искал; тестов в дельте нет - n/a' },
  'fact-check': FACT_CHECK('техутверждения находок о стороннем API'),
  'conventions-read': CONVENTIONS_READ,
  intent: { type: 'string', description: 'сверка с источником намерения входа: соответствует / расхождения «корректно, но не то»; источника нет - n/a' },
  'intent-status': { type: 'string', enum: ['match', 'mismatch', 'n/a'], description: 'mismatch - сделано не то, чего требует источник намерения входа: подробности в intent, каждое расхождение - ещё и находка P0/P1: новая - в findings, из перечня - открытой записью prior' },
  prior: { type: 'array', items: PRIOR, description: 'по каждой находке перечня прежних - запись с её id, статус с уликой; перечня нет - пусто' },
  'review-verdict': { ...VERDICT, description: 'сигнал оператору, порог допуска трека его не читает' },
  missing: { type: 'string', description: 'при blocked - чего не хватило для ревью; иначе пусто' },
}, required: ['status', 'findings', 'axes', 'roots', 'run-status', 'red-run', 'fact-check', 'conventions-read', 'intent', 'intent-status', 'prior', 'review-verdict', 'missing'] }
const UNSETTLED = 'статус саморевью не сверен'
const LISTED = 'Перечень находок: по каждой - запись в prior с её id, статус с уликой; находка перечня идёт только в prior, в findings - то, чего в перечне нет:'
// fix перезаписывается каждой попыткой: решения и оспаривание прежней находки без переноса в decisions до выхода не доезжают.
const said = (f) => [...(f.decisions || []), ...(f.prior || []).filter(p => p.status === 'disputed').map(p => `${p.id || p.anchor}: кодер оспорил закрытие - ${p.evidence}`)]
// Записи red-run и uncovered кодера - вход саморевьюера: он судит red-run по записям входа, а uncovered адресован следующему узлу.
const coderInput = (f) => f ? `\nВход от кодера - план:\n${(f.plan || []).map(p => `- ${p.where}: ${p.change}`).join('\n') || '- не подан'}\nred-run: ${redLines(f['red-run'])}\nuncovered: ${f['uncovered-status']}${(f.uncovered || []).length ? ' - ' + f.uncovered.join('; ') : ''}\ndependents: ${f['dependents-status']}${(f.dependents || []).length ? ' - ' + f.dependents.join('; ') : ''}` : ''
// partial кодера и опровергнутая им сверка - исход автора: зелёная верификация и чистое ревью их не закрывают.
const authorGap = (f, offeredOnly = false) => !f ? '' : f.status === 'partial' && !offeredOnly ? `кодер вернул partial: ${f.missing || f['run-status'] || 'нехватка не названа'}` : (f['fact-check'] || []).some(c => c.status === 'contradicted') ? `fact-check кодера: contradicted - ${f['fact-check'].filter(c => c.status === 'contradicted').map(c => `${c.claim} (${c.source})`).join('; ')}` : ''
// partial правки одних offered итога не держит: её находки порога не держат; partial реализации держит (domain.md §4).
const coderGap = (fix, fix2, offeredOnly) => offeredOnly ? authorGap(fix) || authorGap(fix2, true) : authorGap(fix2 || fix)
// Порог допуска: зелёная верификация и ноль открытых P0/P1 реестра прогона; review-verdict - сигнал оператору, порог его не читает.
const stuckLine = (p) => `${p.id} ${p.status} - ${awaitsProbe(p) ? `нужна проба оператора: ${p.premise}` : p.evidence}`
const admit = (green, rev, stuck, gaps) => !green ? 'верификация после правки по саморевью не прошла'
  : !rev ? 'саморевьюер не вернул выход'
  : rev.status === 'blocked' ? `саморевью не выполнено: ${lack(rev, 'саморевьюер')}`
  : stuck.some(isBlocking) ? `открытые P0/P1: ${stuck.filter(isBlocking).map(stuckLine).join('; ')}` : gaps
// Не правится в прогоне и порог не держит, но вопрос оператору не теряется: «продолжить» подаёт такую находку кодеру из ledger.
const askLines = (r) => r.asking().map(f => `${f.id} [${f.severity}] ${f.anchor}: ${awaitsProbe(f) ? `нужна проба оператора - ${f.premise}` : `${f.introduced ? 'внесена правкой, ' : ''}порога не держит, решение за оператором - ${f.text}`}`)
// Закрытая в прогоне находка в перечне - чтобы ревью сверило, не вернула ли её правка.
const listedLine = (p) => `${priorLine(p)}${p.status === 'closed' ? ' (закрыта в этом прогоне: сверь, что правка её не вернула)' : ''}`
// Ревизия - поле head_sha: head - текст git log, у модели-верификатора его первое слово не обязано быть sha.
const shaOf = (v) => isSha(String(v && v.head_sha || '').trim()) ? String(v.head_sha).trim() : ''
const isSha = (x) => /^[0-9a-f]{7,40}$/i.test(String(x || ''))
// Ветку до head ревью либо сверки complete уже прочли: повторное чтение всего диффа ветки - главная статья прогона дочистки.
// Диагноз либо разведка, выведенные узлом, а не взятые из ledger, - новое намерение: ревью до них судили прежнее.
const INTENT_STEPS = ['1-repro', '1-req']
// Шаг 3-repeat пишут прогоны до 9.2.0 - их trail ещё читается из ledger.
const priorBase = (trail) => {
  const all = steps(trail), from = all.reduce((k, e, i) => INTENT_STEPS.includes(e.step) && !/^ledger/.test(e.doer || '') ? i : k, -1)
  return (all.slice(from + 1).filter(e => [3, '3-check', '3-repeat'].includes(e.step) && e.status === 'complete' && e.settled !== false && isSha(e.head)).pop() || {}).head || ''
}
const scope = (base) => base ? `дельта от ${base} - коммиты после него плюс рабочее дерево. Новые находки ищи в дельте, вне её - только сломанное правкой дельты; статус прежних находок перечня суди на текущем коде. ${base} не предок HEAD - ревью по всем коммитам цели.` : 'коммиты этой цели плюс рабочее дерево.'
const HUNKS = { type: 'object', properties: {
  status: STATUS,
  hunks: { type: 'array', items: { type: 'string' }, description: 'путь от корня репозитория без a/ и b/, место file:from-to по +start,count заголовка @@ (from = start, to = start+count-1); только удалённые строки (count 0) - file:start; удалённый файл - file; переименованный - ещё и старый путь, как удалённый' },
  conventions: CONVENTIONS.conventions, 'conventions-searched': CONVENTIONS['conventions-searched'],
  missing: { type: 'string' },
}, required: ['status', 'hunks', 'conventions', 'conventions-searched', 'missing'] }
// Места правки считает скрипт: арифметику заголовков @@ модель путает на единицу; узлу остаётся отсев файлов тестов.
// Сомнение, относится ли документ к правке, - не неполнота снимка: partial снимка - строка degraded.
const HUNKS_STATUS = 'Документ, о котором неясно, относится ли он к правке, включи в conventions. status - complete, когда места сняты; partial - только когда места сняты не целиком.'
const hunksAsk = (base) => A.scripts ? `ТОЛЬКО перечень мест правки и правил проекта, код не менять. Выполни python3 '${A.scripts}/verify.py' --hunks${base ? ` ${base}` : ''}: hunks - поле hunks его вывода как есть, без файлов тестов; поле error в выводе либо вывод не JSON - status partial, error либо последние строки вывода в missing. ${conventionsAsk} ${HUNKS_STATUS}`
  : `ТОЛЬКО перечень мест правки и правил проекта, код не менять. ${base ? `git diff -U0 ${base}; ${base} не предок HEAD (git merge-base --is-ancestor) - как без базы. ` : ''}Без базы - git diff -U0 "$(${OWN_COMMITS} | tail -1)^", своих коммитов нет - git diff -U0 HEAD. Место - путь от корня репозитория без a/ и b/, место file:from-to по +start,count заголовка @@ (from = start, to = start+count-1); только удалённые строки (count 0) - file:start; удалённый файл - file; переименованный - ещё и старый путь, как удалённый. Файлы тестов не включай. ${conventionsAsk} ${HUNKS_STATUS}`
const hunksOf = (tag, base) => node('снимок правки', `${HEAD}Шаг 3 (${tag}): ${hunksAsk(base)}`, { label: `hunks:${tag}`, phase: 'Review', model: 'haiku', effort: 'low', schema: HUNKS })
const spotsOf = (h) => h && h.status !== 'blocked' ? h.hunks : []
const doubted = (rev, listed) => listed.map(p => { const c = (rev.prior || []).find(q => q.id === p.id); return `${priorLine(p)} - саморевьюер: ${c ? `${c.status} - ${c.evidence}` : 'статус не назван'}` }).join('\n')
const falsifyOf = (tag, rev, listed, base, h) => own('скептик', `${HEAD}Шаг 3 (${tag}): фальсификация находок, исходов осей, решений и статусов прежних из саморевью; вердикт по покрытию. Объём - ${scope(base)} Код не меняй.${conventionsText(h)}\nНаходки:\n${rev.findings.map(findingLine).join('\n') || '- находок нет: только вердикт по покрытию'}${listed.length ? `\nПрежние находки - статус саморевьюера:\n${doubted(rev, listed)}` : ''}\nОси саморевьюера:\n${axesText(rev.axes)}\nРешения саморевьюера:\n${rootsText(rev.roots)}`,
  { label: `falsify:${tag}`, phase: 'Review', schema: FALSIFY }, NODE.skeptic)
const judged = (fal) => !!fal && fal.status !== 'blocked' && !fal.skipped
// Сверка стоит как само ревью, а без P0/P1 исход итога от неё не зависит (P115).
const needsSkeptic = (rev, listed) => [...rev.findings, ...listed].some(isBlocking)
const SKIPPED = { skipped: true, status: 'skipped', confirmed: [], dropped: [], prior: [] }
// В реестр входит выход скептика; без него - claims ревьюера, и разрыв не выпускает complete.
const verdictOf = (rev, fal) => judged(fal) ? { status: fal.status, findings: fal.confirmed, prior: fal.prior } : rev
const spotGap = (rev, h) => !rev || rev.status === 'blocked' ? '' : !h || h.status === 'blocked' ? `места правки не сняты: ${lack(h, 'снимок правки')}`
  : [h.status === 'partial' ? `места правки сняты не целиком: ${h.missing || 'нехватка не названа'}` : '', hunkGap(h.hunks, rev.roots) ? `саморевью: ${hunkGap(h.hunks, rev.roots)}` : '', conventionsGap(h, rev) ? `саморевью: ${conventionsGap(h, rev)}` : ''].filter(Boolean).join('; ')
const falsifyGap = (rev, fal) => !rev || rev.status === 'blocked' || (fal && fal.skipped) ? '' : !judged(fal) ? `фальсификация саморевью не выполнена: ${lack(fal, 'скептик')}`
  : [fal.status === 'partial' ? `фальсификация саморевью не завершена: ${fal.missing || 'нехватка не названа'}` : '', silentGap(rev.findings, fal) ? `саморевью: ${silentGap(rev.findings, fal)}` : ''].filter(Boolean).join('; ')
// Разрыв итога - вердикт не вынесен; разрыв учёта (traceGap) - строка degraded, итог не держит (domain.md §4). chk undefined - сверки не было.
const intentGap = (r, fal) => r['intent-status'] === 'mismatch' && ![...(verdictOf(r, fal).findings || []), ...(verdictOf(r, fal).prior || [])].some(f => isBlocking(f) && stillOpen(f)) ? `саморевью: реализовано не то, а находки P0/P1 нет: ${r.intent}` : ''
const fixCheckGap = (c) => c === undefined ? '' : !c || c.status === 'blocked' ? `сверка правки не выполнена: ${lack(c, 'саморевьюер')}` : c.status === 'partial' ? `сверка правки не завершена: ${c.missing || 'нехватка не названа'}` : ''
const reviewGap = (r, fal, chk) => !r || r.status === 'blocked' ? '' : [r.status === 'partial' ? `саморевью не завершено: ${r.missing || 'нехватка не названа'}` : '', intentGap(r, fal), falsifyGap(r, fal), fixCheckGap(chk)].filter(Boolean).join('; ')
// Место находки, дописанное скептиком (places), есть только в реестре: без него решение на этом месте числится без находки.
const traceGap = (r, h, fal, reg = []) => {
  if (!r || r.status === 'blocked') return ''
  const found = judged(fal) ? [...(fal.confirmed || []), ...(fal.prior || [])] : []
  const parts = [axesGap(r.axes, r.findings), rootsGap(r.roots, [...(r.findings || []), ...(r.prior || []), ...reg]), ...(judged(fal) ? [axesCheckGap(r.axes, fal['axes-check'], found), rootsCheckGap(r.roots, fal['roots-check'], found), rootsMissedGap(fal['roots-missed'], r.roots)] : [])]
  return [spotGap(r, h), ...parts.filter(Boolean).map(g => `саморевью: ${g}`)].filter(Boolean).join('; ')
}
const CHECK = { type: 'object', properties: {
  status: STATUS,
  prior: { type: 'array', items: PRIOR, description: 'по каждой находке перечня - запись с её id, статус с уликой из кода ревизии' },
  findings: { type: 'array', items: { type: 'object', properties: { ref: FINDING.properties.ref, anchor: FINDING.properties.anchor, severity: SEV, axis: FINDING.properties.axis, text: FINDING.properties.text, closure: FINDING.properties.closure, evidence: FINDING.properties.evidence, premise: FINDING.properties.premise },
    required: ['ref', 'anchor', 'severity', 'axis', 'text', 'closure', 'evidence', 'premise'] }, description: 'только дефекты, внесённые дельтой правки: место пересекает дельту, находки нет в перечне' },
  missing: { type: 'string', description: 'при blocked либо partial - чего не хватило для сверки; иначе пусто' },
}, required: ['status', 'prior', 'findings', 'missing'] }
// Сверка - не ревью (domain.md §1): решения, оси и правила проекта судило ревью, полный прогон дала верификация.
const checkOf = (k, base, listed, f, note) => own('саморевьюер', `${HEAD}Шаг 3 (сверка правки ${k}): не ревью. Объём - ${base ? `дельта от ${base}: коммиты после него плюс рабочее дерево; ${base} не предок HEAD - коммиты правок по находкам этого прогона` : 'коммиты правок по находкам этого прогона плюс рабочее дерево'}. По каждой находке перечня - запись в prior с её id, статус на текущем коде с уликой; правка закрыла путь, а не механизм, - partial либо open, незакрытые пути в evidence. В findings - только дефект, внесённый дельтой: его место пересекает дельту. Решения правки, оси и правила проекта не суди. Сборку и тесты целиком прогнала верификация, она зелёная: запускай только то, что нужно улике.${coderInput(f)}${note}\nПеречень:\n${listed.map(listedLine).join('\n')}\nКод не меняй.`,
  { label: 'check:правки', phase: 'Review', schema: CHECK }, NODE.reviewer)
