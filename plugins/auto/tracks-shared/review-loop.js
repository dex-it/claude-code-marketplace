const KEEP = 'Инварианты правки - источник намерения ниже и закрытые в этом прогоне находки: правка их не нарушает и не сужает поведение допущением о входе или среде, которого в источнике нет; такое допущение находку не закрывает.'
const keepText = (closed) => `\n${KEEP}${closed.length ? `\nЗакрытые в этом прогоне:\n${closed.map(f => `- ${f.id} ${f.anchor}: ${f.closure || f.text}`).join('\n')}` : ''}`
const deltaOf = (v) => v && Array.isArray(v.delta) ? v.delta : null
// Цикл - docs/domain.md §4; t несёт различия треков: review, coder, intent, run (команды прогона), verify, red (итог незелёной верификации), afterCoder (выход трека либо null), afterVerify, checkNote (необязательный: строка сверке по верификации правки), moved (необязательный: сменила ли правка тест диагноста bugfix; true - сверка не пропускается).
const OFFERED = 'На твоё решение - порога не держат: правь, только если правка не выходит за места, которые уже меняет правка цели либо называет находка, и не меняет наблюдаемого поведения вне находки; иначе запись prior disputed с основанием.'
async function reviewLoop(t) {
  const { fix, ver, firstBase } = t
  let fix2 = null, ver2 = null, deltaFrom = null, red = '', offeredOnly = false, chk
  const spots = await hunksOf('первое', firstBase)
  const rev = await t.review('первое', fix, ver, LEDGER, firstBase, spots); loops.review = 1
  const first = { step: 3, doer: NODE.reviewer.agentType, status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1, verdict: rev ? rev['review-verdict'] : null, head: shaOf(ver), base: firstBase }
  trail.push(first)
  const dropped = []
  let fal = null
  if (rev && rev.status !== 'blocked') {
    if (!needsSkeptic(rev, LEDGER)) { trail.push({ step: '3-falsify', doer: 'не куплен: P0/P1 нет', status: 'skipped' }); fal = SKIPPED }
    else {
      fal = await falsifyOf('первое', rev, LEDGER, firstBase, spots)
      trail.push({ step: '3-falsify', doer: NODE.skeptic.agentType, status: fal ? fal.status : 'null', confirmed: fal ? fal.confirmed.length : -1, dropped: fal ? fal.dropped.length : -1 })
      if (judged(fal)) dropped.push(...fal.dropped)
    }
    // Ревью с разрывом итога базой следующего прогона не служит: его вердикт не вынесен (priorBase).
    first.settled = !falsifyGap(rev, fal) && !intentGap(rev, fal)
  }
  const reg = registry(UNSETTLED)
  LEDGER.forEach(reg.doubt)
  reg.apply(verdictOf(rev, fal), judged(fal) ? 'скептик' : 'саморевьюер')
  const offeredHere = new Set()
  // Вопрос оператору (domain.md §2) едет и в выходе из цикла: иначе P2 видна только записью prior.
  const state = (exit) => ({ exit: exit && { ...exit, decisions: [...(exit.decisions || []), ...askLines(reg)] }, rev, fal, chk, reg, spots, fix2, ver2, dropped, offeredOnly })
  while (rev && rev.status !== 'blocked' && loops.review_fix < REVIEW_FIX_CEILING) {
    // Не держащая порог подаётся кодеру один раз: оспоренная им осталась бы открытой и гоняла круги до потолка.
    const may = reg.offers().filter(f => !offeredHere.has(f.id))
    if (!reg.fixes().length && !may.length && !red) break
    const k = ++loops.review_fix, must = reg.fixes().length > 0 || !!red
    may.forEach(f => offeredHere.add(f.id))
    if (deltaFrom === null) deltaFrom = shaOf(ver2 || ver)
    fix2 = await t.coder(`${HEAD}Шаг 2 (правка по находкам ${k} из ${REVIEW_FIX_CEILING}):${red ? ` верификация прошлой правки не прошла: ${red}.` : ''}${reg.fixes().length ? ` закрой находки:\n${reg.fixes().map(findingLine).join('\n')}` : ''}${may.length ? `\n${OFFERED}\n${may.map(findingLine).join('\n')}` : ''}${keepText(reg.closed())}\n${t.intent()}\n${t.run()}\nПосле правки коммит локально, push не делать. По каждой находке - запись в prior с её id: closed с уликой либо disputed с основанием, почему закрывать не следует.`)
    if (fix2) decisions.push(...said(fix2))
    const exit = fix2 && t.afterCoder(fix2, k, { review: rev, prior: reg.all() })
    if (exit) return state(exit)
    const prevVer = ver2 || ver
    ver2 = !fix2 || fix2.status === 'blocked' ? null : await t.verify('после саморевью', deltaFrom)
    t.afterVerify(ver2)
    offeredOnly = !must
    trail.push({ step: '2-after-review', attempt: k, doer: NODE.coder.agentType, status: fix2 ? fix2.status : 'null', passed: passed(ver2), 'red-run': fix2 ? fix2['red-run'] : null })
    const openNow = { review: rev, falsify: fal, prior: reg.all(), dropped }
    if (!fix2 || fix2.status === 'blocked') return state(nodeBail('Review: правка по находкам', lack(fix2, 'узел-кодер'), openNow))
    if (noRun(ver2)) return state(nodeBail('Review: верификация после правки', lack(ver2, 'верификатор'), openNow))
    // Правка одних offered сверку не покупает: их исход итога не держит (domain.md §4); сменивший тест диагноста круг пропуска не получает (t.moved).
    if (!must && passed(ver2) && !(t.moved && t.moved(prevVer, ver2))) {
      const shut = (fix2.prior || []).filter(p => p.status === 'closed' && may.some(f => f.id === p.id))
      shut.forEach(p => reg.seat(p, 'closed', `закрыто кодером без сверки: ${p.evidence}`))
      decisions.push(...shut.map(p => `${p.id}: закрыто кодером без сверки - ${p.evidence}`))
      trail.push({ step: '3-check', attempt: k, doer: 'не куплена: правка одних offered, верификация зелёная', status: 'skipped', closed: shut.length })
      break
    }
    if (!passed(ver2)) {
      red = t.red(ver2)
      trail.push({ step: '3-check', attempt: k, doer: 'не куплена: верификация правки не зелёная', status: 'skipped' })
      continue
    }
    red = ''
    if (!deltaOf(ver2)) degraded.push(`дельта правки по находкам ${k} не получена - новые находки сверки после неё считаются внесёнными правкой`)
    const listed = reg.listing()
    chk = await checkOf(k, deltaFrom, listed, fix2, t.checkNote ? t.checkNote(ver2) : ''); loops.check = k
    trail.push({ step: '3-check', attempt: k, doer: NODE.reviewer.agentType, status: chk ? chk.status : 'null', findings: chk ? chk.findings.length : -1, head: shaOf(ver2), base: deltaFrom, settled: first.settled !== false })
    // Сверка без выхода либо blocked статусов не выносит: реестр остаётся, каким его оставило ревью.
    if (!chk || chk.status === 'blocked') break
    listed.forEach(reg.doubt)
    reg.apply(chk, 'сверка правки', listed, introducedAt(deltaOf(ver2)))
  }
  return state(null)
}
