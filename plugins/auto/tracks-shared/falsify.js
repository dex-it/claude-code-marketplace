const AXIS_CHECK = ['upheld', 'overturned']
// Исход оси ревьюера - claim: ось clean/n/a без записи скептика ушла бы в выход чистой непроверенной.
const axesCheckGap = (axes, check, confirmed) => {
  const c = check || []
  const unchecked = (axes || []).filter(a => ['clean', 'n/a'].includes(a.outcome) && !c.some(x => x.name === a.name)).map(a => a.name)
  const bare = c.filter(x => x.verdict === 'overturned' && !(confirmed || []).some(f => f.axis === x.name && stillOpen(f))).map(x => x.name)
  return [unchecked.length ? `исход оси не сверен скептиком: ${unchecked.join(', ')}` : '', bare.length ? `ось опровергнута без находки: ${bare.join(', ')}` : ''].filter(Boolean).join('; ')
}
const ROOT_CHECK = ['upheld', 'overturned']
// Вердикт по решению - claim в обе стороны, а overturned у legitimate и illegitimate значит противоположное: запись сверки - на одно решение.
const rootsCheckGap = (roots, check, found) => {
  const r = (roots || []).filter(x => x.verdict !== 'none')
  // Решения ревьюера пересекаются между собой: запись с местом решения иначе задела бы и соседнее.
  const exact = (y) => r.filter(x => String(spot(x.anchor)) === String(spot(y.anchor)))
  const hits = (check || []).map(y => [y, exact(y).length ? exact(y) : r.filter(x => sameSpot(y.anchor, x.anchor))])
  const wide = hits.filter(([, xs]) => xs.length > 1).map(([y]) => y.anchor)
  const own = (x) => hits.filter(([, xs]) => xs.length === 1 && xs[0] === x).map(([y]) => y)
  const unchecked = r.filter(x => !own(x).length).map(x => x.anchor)
  const bare = r.filter(x => own(x).some(y => (x.verdict === 'legitimate') === (y.verdict === 'overturned')) && !hasFinding(x, found)).map(x => x.anchor)
  return [wide.length ? `запись сверки покрывает несколько решений: ${wide.join(', ')}` : '', unchecked.length ? `решение не сверено скептиком: ${unchecked.join(', ')}` : '', bare.length ? `решение нелегитимно после сверки без находки: ${bare.join(', ')}` : ''].filter(Boolean).join('; ')
}
// Решение, которого ревьюер не назвал (и под none тоже), сверка его записей не видит - его называет скептик этим полем; запись на месте названного решения - спор о его вердикте, его судит roots-check.
const rootsMissedGap = (missed, roots) => {
  const bare = (missed || []).filter(x => !(roots || []).some(r => r.verdict !== 'none' && sameSpot(r.anchor, x.anchor)))
  return bare.length ? `решение не перечислено ревьюером: ${bare.map(x => `${x.anchor} - ${x.decision}`).join('; ')}` : ''
}
// Находка ревьюера - claim: молчание скептика о ней убрало бы её из реестра без следа.
const silentGap = (findings, fal) => {
  const seen = [...(fal.confirmed || []), ...(fal.dropped || []), ...(fal.prior || [])]
  const bare = (findings || []).filter(f => !seen.some(x => sameFinding(x, f))).map(f => f.anchor)
  return bare.length ? `находка не сверена скептиком: ${bare.join(', ')}` : ''
}
// Места правки снимает не ревьюер: перечень, собранный тем, чью полноту он проверяет, ничего не проверяет.
const hunkList = (hunks) => (hunks || []).length ? `\nМеста правки (без тестов) - каждое пересекает запись roots: решение либо none с причиной:\n${hunks.map(h => `- ${h}`).join('\n')}` : ''
const bareHunks = (hunks, roots) => (hunks || []).filter(h => !(roots || []).some(x => sameSpot(h, x.anchor)))
const hunkGap = (hunks, roots) => {
  const bare = bareHunks(hunks, roots)
  return bare.length ? `место правки без записи roots: ${bare.join(', ')}` : ''
}
// Правила проекта ищет узел снимка, читает ревьюер: прочтение - поле выдачи, иначе непрочитанное правило неотличимо от соблюдённого.
const CONVENTIONS = {
  conventions: { type: 'array', items: { type: 'string' }, description: 'пути от корня репозитория: документы, которыми проект нормирует код и ревью; не нашёл - пусто' },
  'conventions-searched': { type: 'string', description: 'где искал правила проекта' },
}
const CONVENTIONS_READ = { type: 'array', items: { type: 'string' }, description: 'пути из правил проекта во входе, прочитанные до суждения' }
const conventionsAsk = 'Правила проекта - conventions: документы, предписывающие, каким быть коду и ревью: CLAUDE.md, AGENTS.md и аналоги в корне и на пути к изменённым файлам, названное ими нормой, гайды вклада и стиля, ADR. Не правила: конфиги сборки и линтера, заметки, которые проект нормой не называет. conventions-searched - где искал.'
const conventionsOf = (x) => x && x.status !== 'blocked' ? x.conventions || [] : []
// Прочитанное называется путём из поданного перечня: свободную строку разведка и ревьюер пишут разной формой, и прочитанное правило числится непрочитанным.
const conventionsRead = (x) => conventionsOf(x).length ? { ...CONVENTIONS_READ, items: { type: 'string', enum: [...new Set(conventionsOf(x))] } } : CONVENTIONS_READ
const conventionsText = (x) => !x || x.status === 'blocked' ? '' : conventionsOf(x).length
  ? `\nПравила проекта - прочитай каждое до суждения: нарушение правила - находка, в evidence путь и ключ либо цитата правила; где правило расходится с отраслевой нормой о форме кода, судит правило:\n${conventionsOf(x).map(c => `- ${c}`).join('\n')}`
  : `\nПравил проекта не найдено (искали: ${x['conventions-searched'] || 'не названо'}).`
const conventionsGap = (x, rev) => {
  const path = (c) => String(c).trim().replace(/^\.\//, '')
  const read = ((rev && rev['conventions-read']) || []).map(path)
  const unread = conventionsOf(x).filter(c => !read.includes(path(c)))
  return unread.length ? `правила проекта не прочитаны: ${unread.join(', ')}` : ''
}
const axesText = (axes) => (axes || []).map(a => `- ${a.name}: ${a.outcome}${a.checked ? ` - ${a.checked}` : ''}`).join('\n') || '- не названы'
const rootsText = (roots) => (roots || []).map(x => `- ${x.anchor}: ${x.decision} - корень: ${x.root} - ${x.verdict}${x.finding ? ` (находка ${x.finding})` : ''}${x.evidence ? ` - ${x.evidence}` : ''}`).join('\n') || '- не названы'
const FALSIFY = { type: 'object', properties: {
  status: STATUS,
  confirmed: { type: 'array', items: FINDING },
  dropped: { type: 'array', items: { type: 'object', properties: { ref: { type: 'string', description: 'ref снимаемой находки ревьюера' }, anchor: { type: 'string' }, reason: { type: 'string' } }, required: ['ref', 'anchor', 'reason'] } },
  coverage: { type: 'string', description: 'вердикт по покрытию изменённого поведения: непокрытые ветки поимённо либо "покрыто: <чем>"' },
  'axes-check': { type: 'array', items: { type: 'object', properties: { name: AXIS, verdict: { type: 'string', enum: AXIS_CHECK }, evidence: { type: 'string' } }, required: ['name', 'verdict', 'evidence'] } },
  'roots-check': { type: 'array', items: { type: 'object', properties: { anchor: { type: 'string' }, verdict: { type: 'string', enum: ROOT_CHECK }, evidence: { type: 'string' } }, required: ['anchor', 'verdict', 'evidence'] } },
  'roots-missed': { type: 'array', items: { type: 'object', properties: { anchor: { type: 'string' }, decision: { type: 'string' } }, required: ['anchor', 'decision'] } },
  'review-verdict': VERDICT,
  prior: { type: 'array', items: PRIOR, description: 'сверенный с кодом статус каждой прежней находки перечня; прежних нет - пусто' },
  missing: { type: 'string' },
}, required: ['status', 'confirmed', 'dropped', 'coverage', 'axes-check', 'roots-check', 'roots-missed', 'review-verdict', 'prior', 'missing'] }
