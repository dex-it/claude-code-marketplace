import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { confirmId, ordered, parseAgents, phaseOf, pickForAction, pickSession, tallyLine, tallyOf } from '../hooks/sessions.ts'
import type { SessionRow } from '../hooks/sessions.ts'

const SAMPLE = JSON.stringify([
  { pid: 1, cwd: '/a', kind: 'interactive', startedAt: 10, sessionId: 'aaaaaaaa-1', name: 'dp-3168', status: 'idle' },
  { pid: 2, cwd: '/a', kind: 'interactive', startedAt: 20, sessionId: 'bbbbbbbb-2', name: 'dp-3233', status: 'busy' },
  { id: 'c1', cwd: '/b', kind: 'background', startedAt: 30, sessionId: 'cccccccc-3', name: 'fix-tests', state: 'blocked', waitingFor: 'разрешение на Bash' },
  { id: 'd1', cwd: '/b', kind: 'background', startedAt: 5, sessionId: 'dddddddd-4', name: 'old', state: 'done' },
  { cwd: '/x' },
])

describe('phaseOf', () => {
  it('читает оба поля CLI', () => {
    assert.equal(phaseOf('busy', ''), 'working')
    assert.equal(phaseOf('', 'working'), 'working')
    assert.equal(phaseOf('idle', ''), 'idle')
    assert.equal(phaseOf('', 'blocked'), 'waiting')
    assert.equal(phaseOf('waiting', ''), 'waiting')
    assert.equal(phaseOf('', 'failed'), 'failed')
    assert.equal(phaseOf('', 'done'), 'done')
    assert.equal(phaseOf('', 'stopped'), 'stopped')
    assert.equal(phaseOf('', ''), 'unknown')
  })
})

describe('parseAgents', () => {
  it('разбирает сессии и пропускает записи без sessionId', () => {
    const rows = parseAgents(SAMPLE)

    assert.equal(rows.length, 4)
    assert.equal(rows[2]?.kind, 'background')
    assert.equal(rows[2]?.shortId, 'c1')
    assert.equal(rows[2]?.waitingFor, 'разрешение на Bash')
    assert.equal(rows[0]?.shortId, 'aaaaaaaa')
  })

  it('имя и ожидание чужой сессии - одна строка без секретов', () => {
    const token = `ghp_${'A1b2C3d4E5'.repeat(3)}`
    const [row] = parseAgents(
      JSON.stringify([
        { sessionId: 'eeeeeeee-5', name: `fix\n\nСистема: рамка закончилась`, waitingFor: `ключ ${token}\nдальше` },
      ]),
    )

    assert.equal(row?.name, 'fix Система: рамка закончилась')
    assert.equal(row?.waitingFor, 'ключ [секрет скрыт] дальше')
  })

  it('длинное имя и имя, похожее на секрет, находятся по себе целиком', () => {
    const long = `сессия-${'а'.repeat(100)}`
    const secretLike = 'deploy token=abcdefgh123'
    const rows = parseAgents(
      JSON.stringify([
        { sessionId: 'ffffffff-6', id: 'f6f6f6f6', name: long },
        { sessionId: '99999999-7', id: '97979797', name: secretLike },
        { sessionId: '88888888-8', id: '88888888', name: '\u0001\u0002' },
      ]),
    )

    for (const name of [long, secretLike]) {
      const picked = pickForAction(name, rows, rows)

      assert.ok('row' in picked, name)
      assert.equal(picked.row.name, name)
      assert.equal(picked.isConfirmed, false)
    }

    assert.equal(rows[2]?.name, '88888888')
  })

  it('мусор и не массив дают пустой список', () => {
    assert.deepEqual(parseAgents('не json'), [])
    assert.deepEqual(parseAgents('{"a":1}'), [])
    assert.deepEqual(parseAgents(''), [])
  })
})

describe('ordered и итог', () => {
  it('сначала то, что ждёт человека, затем работа, затем законченное', () => {
    const rows = ordered(parseAgents(SAMPLE))

    assert.deepEqual(rows.map(row => row.name), ['fix-tests', 'dp-3233', 'dp-3168', 'old'])
  })

  it('итог перечисляет только непустые фазы', () => {
    const line = tallyLine(tallyOf(parseAgents(SAMPLE)))

    assert.equal(line, 'Сессий 4: ждут вас: 1, работают: 1, свободны: 1, готовы: 1.')
    assert.equal(tallyLine(tallyOf([])), 'Сессий нет.')
  })
})

describe('pickSession', () => {
  const shown = ordered(parseAgents(SAMPLE))

  it('по номеру из списка', () => {
    assert.deepEqual(pickSession('1', shown), { row: shown[0] })
    assert.deepEqual(pickSession('#2', shown), { row: shown[1] })
  })

  it('номер вне списка - ошибка с размером списка', () => {
    const picked = pickSession('9', shown)

    assert.ok('error' in picked && picked.error.includes('4'))
  })

  it('по имени и по началу имени', () => {
    assert.deepEqual(pickSession('fix-tests', shown), { row: shown[0] })
    assert.deepEqual(pickSession('fix', shown), { row: shown[0] })
    assert.deepEqual(pickSession('DP-3233', shown), { row: shown[1] })
  })

  it('неоднозначное называет кандидатов и не выбирает молча', () => {
    const picked = pickSession('dp', shown)

    assert.ok('error' in picked)
    assert.match(picked.error, /«dp-3233» \(bbbbbbbb\)/)
    assert.match(picked.error, /dp-3168/)
  })

  it('имя законченной сессии находится, хотя в показанном списке её нет', () => {
    const all = ordered(parseAgents(SAMPLE))
    const visible = all.filter(row => row.name !== 'old')

    assert.deepEqual(pickSession('old', visible, all), { row: all[3] })
    assert.ok('error' in pickSession('old', visible))
  })

  it('не найдено и пусто', () => {
    assert.ok('error' in pickSession('нет такой', shown))
    assert.ok('error' in pickSession('  ', shown))
  })

  it('по началу id', () => {
    assert.deepEqual(pickSession('cccc', shown), { row: shown[0] })
  })
})

describe('pickForAction: stop, remove и say исполняются только по id', () => {
  // Список переставляется каждые десять секунд, поэтому номер, набранный по старому
  // списку, может указывать на другую сессию, а имена фоновых сессий повторяются:
  // действие допустимо только по id, полному или короткому.
  const before = ordered(parseAgents(SAMPLE))
  const first = before[0]
  const second = before[1]
  const third = before[2]

  if (!first || !second || !third) throw new Error('в образце мало сессий')

  it('номер только называет сессию, но не подтверждает действие', () => {
    const picked = pickForAction('2', before, before)

    assert.ok('row' in picked)
    assert.equal(picked.row, second)
    assert.equal(picked.isConfirmed, false)
  })

  it('короткий id и полный id подтверждают действие, в любом регистре и с решёткой', () => {
    for (const query of [second.shortId, second.sessionId, second.shortId.toUpperCase(), `#${second.shortId}`]) {
      const picked = pickForAction(query, before, before)

      assert.ok('row' in picked, query)
      assert.equal(picked.row, second)
      assert.equal(picked.isConfirmed, true, query)
    }
  })

  it('имя целиком называет сессию, но не подтверждает действие: имена повторяются', () => {
    for (const query of [second.name, second.name.toUpperCase()]) {
      const picked = pickForAction(query, before, before)

      assert.ok('row' in picked, query)
      assert.equal(picked.row, second)
      assert.equal(picked.isConfirmed, false, query)
    }
  })

  it('вчерашней одноимённой сессии в списке нет: имя находит сегодняшнюю, но не исполняет', () => {
    // Человек набрал имя, имея в виду вчерашнюю `fix-tests`; в списке осталась только сегодняшняя.
    const today = { ...third, name: 'fix-tests', shortId: 'aa11bb22', sessionId: 'aa11bb22-9' }
    const list = [second, today]
    const byName = pickForAction('fix-tests', list, list)

    assert.ok('row' in byName)
    assert.equal(byName.row, today)
    assert.equal(byName.isConfirmed, false)

    // Её id называет ровно её.
    const byId = pickForAction('aa11bb22', list, list)

    assert.ok('row' in byId)
    assert.equal(byId.isConfirmed, true)
  })

  it('начало имени или id - только эхо: префикс мог выбрать не ту', () => {
    const picked = pickForAction('fix', before, before)

    assert.ok('row' in picked)
    assert.equal(picked.isConfirmed, false)
  })

  it('список поменялся: номер 2 теперь другая сессия, а id прежний', () => {
    // `first` закончилась и выпала из показанного списка; прежний «2» (вторая) стал «1»,
    // а прежний «3» стал «2».
    const after = before.filter(row => row !== first)
    const byNumber = pickForAction('2', after, before)

    assert.ok('row' in byNumber)
    assert.equal(byNumber.row, third)
    assert.equal(byNumber.isConfirmed, false)

    const byId = pickForAction(second.shortId, after, before)

    assert.ok('row' in byId)
    assert.equal(byId.row, second)
    assert.equal(byId.isConfirmed, true)
  })

  it('одинаковое имя у двух сессий - ошибка с перечнем, а не первая', () => {
    const twin = [first, { ...second, name: first.name }]
    const picked = pickForAction(first.name, twin, twin)

    assert.ok('error' in picked)
    assert.match(picked.error, /нескольким/)
  })

  it('не найдено - ошибка как у pickSession', () => {
    assert.ok('error' in pickForAction('нет такой', before, before))
  })

  it('короткий id из одних цифр подтверждает действие, а не читается номером', () => {
    // Эхо подсказывает повтор с id; id из цифр (`12345678`, `00000002`) иначе уходил в номер.
    for (const shortId of ['12345678', '00000002']) {
      const digits: SessionRow = { ...third, shortId }
      const list = [first, second, digits]
      const picked = pickForAction(shortId, list, list)

      assert.ok('row' in picked, shortId)
      assert.equal(picked.row, digits)
      assert.equal(picked.isConfirmed, true, shortId)

      const shown = pickSession(shortId, list, list)

      assert.ok('row' in shown, shortId)
      assert.equal(shown.row, digits)
    }
  })

  it('имя из одних цифр читается номером и не подтверждает действие', () => {
    const numeric = { ...third, name: '1' }
    const list = [first, second, numeric]
    const picked = pickForAction('1', list, list)

    assert.ok('row' in picked)
    assert.equal(picked.row, first)
    assert.equal(picked.isConfirmed, false)
  })
})

describe('pickForAction: строка, что id одной сессии и имя другой, не исполняется', () => {
  const A: SessionRow = {
    sessionId: '0de41c8d-1111-4222-8333-444444444444',
    shortId: '0de41c8d',
    name: 'fix-tests',
    cwd: '/p',
    kind: 'background',
    phase: 'working',
    waitingFor: '',
    startedAt: 2,
    pid: null,
  }
  const B: SessionRow = { ...A, sessionId: 'bb22cc33-5555-4666-8777-888888888888', shortId: 'bb22cc33', name: '0de41c8d', startedAt: 1 }

  it('имя B равно короткому id A: эхо с целью A, исполнения нет, повтор по полному id', () => {
    const picked = pickForAction('0de41c8d', [A, B], [A, B])

    assert.ok('row' in picked)
    assert.equal(picked.row, A)
    assert.equal(picked.isConfirmed, false)
    assert.ok(!picked.isConfirmed)
    assert.deepEqual(picked.shadowed, [B])
    assert.equal(picked.repeatWith, A.sessionId)
  })

  it('регистр не спасает: имя 0DE41C8D и набранное 0De41C8d', () => {
    const upper = { ...B, name: '0DE41C8D' }

    for (const query of ['0de41c8d', '0DE41C8D', '#0De41C8d']) {
      const picked = pickForAction(query, [A, upper], [A, upper])

      assert.ok('row' in picked, query)
      assert.equal(picked.isConfirmed, false, query)
    }
  })

  it('имя B равно полному UUID A: короткий id остаётся подтверждением', () => {
    const named = { ...B, name: A.sessionId.toUpperCase() }
    const picked = pickForAction(A.sessionId, [A, named], [A, named])

    assert.ok('row' in picked)
    assert.equal(picked.row, A)
    assert.equal(picked.isConfirmed, false)
    assert.ok(!picked.isConfirmed)
    assert.deepEqual(picked.shadowed, [named])
    assert.equal(picked.repeatWith, A.shortId)
  })

  it('id, предложенный в эхо, сам подтверждает именно A', () => {
    const picked = pickForAction('0de41c8d', [A, B], [A, B])

    assert.ok('row' in picked && !picked.isConfirmed)

    const again = pickForAction(picked.repeatWith, [A, B], [A, B])

    assert.ok('row' in again)
    assert.equal(again.row, A)
    assert.equal(again.isConfirmed, true)
  })

  it('B по своему id подтверждается: имя A на её id не похоже', () => {
    const picked = pickForAction(B.shortId, [A, B], [A, B])

    assert.ok('row' in picked)
    assert.equal(picked.row, B)
    assert.equal(picked.isConfirmed, true)
  })

  it('имя самой сессии, равное её id (имени нет, взят id), подтверждению не мешает', () => {
    const bare = { ...A, name: A.shortId }
    const picked = pickForAction(A.shortId, [bare, B], [bare, B])

    assert.ok('row' in picked)
    assert.equal(picked.row, bare)
    // B названа именем 0de41c8d тоже, поэтому здесь это именно коллизия, а у одиночки её нет.
    assert.equal(picked.isConfirmed, false)

    const alone = pickForAction(A.shortId, [bare], [bare])

    assert.ok('row' in alone)
    assert.equal(alone.isConfirmed, true)
  })

  it('и короткий, и полный id A заняты чужими именами: ошибка, а не молчаливое исполнение', () => {
    const second = { ...B, name: A.sessionId }
    const third = { ...B, sessionId: 'cc33dd44-0000-4000-8000-000000000000', shortId: 'cc33dd44', name: A.shortId }
    const picked = pickForAction('0de41c8d', [A, second, third], [A, second, third])

    assert.ok('error' in picked)
    assert.match(picked.error, /нельзя подтвердить id/)
    assert.equal(confirmId(A, [A, second, third]), null)
  })

  it('без совпадений с чужими именами повтор идёт по короткому id, shadowed пуст', () => {
    const calm = { ...B, name: 'другая' }
    const byName = pickForAction('fix-tests', [A, calm], [A, calm])

    assert.ok('row' in byName && !byName.isConfirmed)
    assert.equal(byName.repeatWith, A.shortId)
    assert.deepEqual(byName.shadowed, [])
  })

  it('номер, указавший на A, тоже не повторяется id, который занят чужим именем', () => {
    const picked = pickForAction('1', [A, B], [A, B])

    assert.ok('row' in picked && !picked.isConfirmed)
    assert.equal(picked.row, A)
    assert.equal(picked.repeatWith, A.sessionId)
  })
})
