import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ECHO_TEXT_MAX, SAY_EMPTY, SAY_SELF, cleanName, dangerEcho, sayEcho, sayOutcome, failureOf, launchDir, mayMutate, messageFor, nameFromTask, dirChoices, presetsOf, recentDirs, settled, startArgv, startedMessage, startedOf } from '../hooks/dispatch.ts'
import { pickForAction } from '../hooks/sessions.ts'
import type { SessionRow } from '../hooks/sessions.ts'

describe('имена', () => {
  it('имя из задачи: первые слова через дефис', () => {
    assert.equal(nameFromTask('Разобрать падающие тесты в модуле оплаты!'), 'разобрать-падающие-тесты-в')
    assert.equal(nameFromTask('!!!'), 'sessiya')
  })

  it('cleanName оставляет безопасные знаки', () => {
    assert.equal(cleanName(' мой/проект: 1 '), 'мой-проект-1')
    assert.equal(cleanName('--'), '')
  })
})

describe('startArgv', () => {
  it('задача идёт одним аргументом, ключи только заданные', () => {
    const argv = startArgv({ task: 'сделай "это"; rm -rf', name: '', dir: '', permissionMode: '', model: '' })

    assert.deepEqual(argv, ['claude', '--bg', '--name', 'сделай-это-rm-rf', 'сделай "это"; rm -rf'])
  })

  it('режим и модель добавляются, когда названы', () => {
    const argv = startArgv({ task: 'x', name: 'n', dir: '', permissionMode: 'plan', model: 'sonnet' })

    assert.deepEqual(argv, ['claude', '--bg', '--name', 'n', '--permission-mode', 'plan', '--model', 'sonnet', 'x'])
  })
})

describe('задача, похожая на ключ', () => {
  it('не уходит в claude голой', () => {
    const argv = startArgv({ task: '--dangerously-skip-permissions', name: '', dir: '', permissionMode: '', model: '' })

    assert.equal(argv.at(-1), 'Задача: --dangerously-skip-permissions')
    assert.ok(!argv.includes('--dangerously-skip-permissions'))
  })
})

describe('вывод CLI', () => {
  it('startedOf читает id и имя', () => {
    assert.deepEqual(startedOf('Starting background service…\nbackgrounded · 0de41c8d · probe-disp\n  claude agents'), {
      id: '0de41c8d',
      name: 'probe-disp',
    })
    assert.equal(startedOf('что-то другое'), null)
  })

  it('failureOf объясняет недоверенный каталог и берёт первую строку иначе', () => {
    assert.match(failureOf('Workspace not trusted. Run `claude`', ''), /доверен/)
    assert.equal(failureOf('\nошибка раз\nдва', ''), 'ошибка раз')
    assert.equal(failureOf('', ''), 'команда завершилась без объяснения')
  })

  it('сообщение соседу называет отправителя', () => {
    assert.equal(messageFor('5d8e1b88', ' привет '), '[метка диспетчера сессий, не проверяется: отправитель 5d8e1b88] привет')
  })
})

describe('presetsOf', () => {
  it('кнопка есть, только если команда в сессии есть', () => {
    assert.deepEqual(presetsOf(['review', 'dex-auto:onboard']).map(preset => preset.task), ['/dex-auto:onboard'])
    assert.deepEqual(presetsOf(['review']), [])
  })
})

describe('dirChoices', () => {
  it('текущая первой, затем папки сессий, затем соседи, без повторов', () => {
    const choices = dirChoices({
      current: '/h/work/a',
      recents: ['/h/work/r', '/h/work/a'],
      sessionDirs: ['/h/work/b', '/h/work/a'],
      neighbours: ['/h/work/b', '/h/work/c'],
      home: '/h',
    })

    assert.deepEqual(choices, [
      { value: '/h/work/a', label: 'эта папка: ~/work/a' },
      { value: '/h/work/r', label: 'недавняя: ~/work/r' },
      { value: '/h/work/b', label: 'где идут сессии: ~/work/b' },
      { value: '/h/work/c', label: 'рядом: ~/work/c' },
    ])
  })

  it('не длиннее потолка', () => {
    const many = Array.from({ length: 40 }, (_, i) => `/p/d${i}`)

    assert.equal(dirChoices({ current: '/p', recents: [], sessionDirs: [], neighbours: many, home: '' }).length, 20)
  })
})

describe('recentDirs', () => {
  const row = (project: unknown) => JSON.stringify({ display: 'x', project })

  it('свежие первыми, без повторов и временных, оборванная первая строка отброшена', () => {
    const text = [
      '{"оборвано',
      row('/h/old'),
      row('/h/new'),
      row('/h/old'),
      row('/private/tmp/claude-501/x'),
      row('/h/.cache/review/pr1'),
      row(42),
      'мусор',
      row('/h/last'),
    ].join('\n')

    assert.deepEqual(recentDirs(text), ['/h/last', '/h/old', '/h/new'])
  })

  it('не длиннее лимита', () => {
    const text = ['x', ...Array.from({ length: 50 }, (_, i) => row(`/p/${i}`))].join('\n')

    assert.equal(recentDirs(text, 5).length, 5)
  })
})

const sample: SessionRow = {
  sessionId: '0de41c8d-0000-4000-8000-000000000000',
  shortId: '0de41c8d',
  name: 'fix-tests',
  cwd: '/p',
  kind: 'background',
  phase: 'done',
  waitingFor: '',
  startedAt: 0,
  pid: null,
}

describe('dangerEcho: номер не исполняется, эхо называет сессию и команду', () => {
  it('удаление: имя, короткий id и точная команда повтора', () => {
    const text = dangerEcho('remove', sample)

    assert.match(text, /Удалить «fix-tests» \(0de41c8d\)/)
    assert.ok(text.includes('/sessions remove 0de41c8d'))
  })

  it('остановка: то же для stop', () => {
    const text = dangerEcho('stop', sample)

    assert.match(text, /Остановить «fix-tests» \(0de41c8d\)/)
    assert.ok(text.includes('/sessions stop 0de41c8d'))
  })
})

describe('sayEcho: номер и имя не отправляют, эхо называет сессию, id и поручение', () => {
  it('имя, короткий id и точная команда повтора с id', () => {
    const text = sayEcho(sample)

    assert.match(text, /Отправить «fix-tests» \(0de41c8d\)\?/)
    assert.ok(text.includes('/sessions say 0de41c8d текст'))
  })

  it('однострочный текст не длиннее лимита подставлен в команду целиком', () => {
    const task = 'почини тест оплаты и не трогай миграции'
    const text = sayEcho(sample, `  ${task} \n`)

    assert.ok(text.endsWith(`/sessions say 0de41c8d ${task}`))
    assert.ok(!text.includes('текст'))

    const edge = 'x'.repeat(ECHO_TEXT_MAX)

    assert.ok(sayEcho(sample, edge).endsWith(`/sessions say 0de41c8d ${edge}`))
  })

  it('секрет в тексте не маскируется: это ввод самого оператора', () => {
    const secret = 'токен ghp_abcdefghijklmnopqrstuvwxyz0123456789 лежит в .env'

    assert.ok(sayEcho(sample, secret).includes(secret))
  })

  it('длиннее лимита - литерал «текст», сам текст в эхо не попадает', () => {
    const long = 'y'.repeat(ECHO_TEXT_MAX + 1)
    const text = sayEcho(sample, long)

    assert.ok(text.endsWith('/sessions say 0de41c8d текст'))
    assert.ok(!text.includes(long))
  })

  it('многострочный текст - литерал «текст», остальные строки в эхо не попадают', () => {
    for (const body of ['первая\nвторая ВТОРАЯ-СТРОКА', 'первая\r\nвторая', 'первая\u2028вторая']) {
      const text = sayEcho(sample, body)

      assert.ok(text.endsWith('/sessions say 0de41c8d текст'), body)
      assert.ok(!text.includes('вторая'), body)
      assert.ok(!text.includes('ВТОРАЯ'), body)
    }
  })

  it('пустой текст - литерал «текст»', () => {
    assert.ok(sayEcho(sample, '   ').endsWith('/sessions say 0de41c8d текст'))
  })
})

describe('эхо: строка, что id одной сессии и имя другой', () => {
  const other: SessionRow = { ...sample, sessionId: 'bb22cc33-0000-4000-8000-000000000000', shortId: 'bb22cc33', name: '0de41c8d' }

  it('stop и remove: перечислены «имя (id)» второй, повтор по переданному id', () => {
    for (const kind of ['stop', 'remove'] as const) {
      const text = dangerEcho(kind, sample, sample.sessionId, [other])

      assert.match(text, /имя другой: «0de41c8d» \(bb22cc33\)/, kind)
      assert.match(text, /«fix-tests» \(0de41c8d\)/, kind)
      assert.ok(text.endsWith(`/sessions ${kind} ${sample.sessionId}`), kind)
    }
  })

  it('say: то же, текст подставлен', () => {
    const text = sayEcho(sample, 'привет', sample.sessionId, [other])

    assert.match(text, /имя другой: «0de41c8d» \(bb22cc33\)/)
    assert.ok(text.endsWith(`/sessions say ${sample.sessionId} привет`))
  })

  it('без совпадения примечания нет', () => {
    assert.ok(!/имя другой/.test(dangerEcho('stop', sample)))
    assert.ok(!/имя другой/.test(sayEcho(sample, 'привет')))
  })
})

describe('sayOutcome: исход `say` и порядок проверок', () => {
  const me = 'aaaaaaaa-9999-4999-8999-999999999999'
  const mine: SessionRow = { ...sample, sessionId: me, shortId: 'aaaaaaaa', name: 'моя' }
  const twin: SessionRow = { ...sample, sessionId: 'bb22cc33-0000-4000-8000-000000000000', shortId: 'bb22cc33', name: '0de41c8d' }
  const all = [sample, mine, twin]
  const outcome = (query: string, text: string, selfId = me) =>
    sayOutcome({ pick: pickForAction(query, all, all), text, selfId })

  it('по id: отправка, текст без пробелов по краям', () => {
    const result = outcome('bb22cc33', '  привет \n')

    assert.equal(result.kind, 'send')
    assert.ok(result.kind === 'send' && result.row === twin && result.text === 'привет')
  })

  it('по полному id: отправка', () => {
    assert.equal(outcome(sample.sessionId, 'привет').kind, 'send')
  })

  it('по имени и номеру: эхо с id и текстом, не отправка', () => {
    for (const query of ['fix-tests', '1', 'fix']) {
      const result = outcome(query, 'привет')

      assert.equal(result.kind, 'echo', query)
      assert.ok(result.text.endsWith('привет'), query)
    }
  })

  it('строка - id одной и имя другой: эхо, не отправка', () => {
    const result = outcome('0de41c8d', 'привет')

    assert.equal(result.kind, 'echo')
    assert.match(result.text, /имя другой: «0de41c8d» \(bb22cc33\)/)
  })

  it('текущая сессия: отказ, и по имени тоже - эхо с подсказкой, которую потом откажут, не выдаётся', () => {
    for (const query of ['aaaaaaaa', me, 'моя', '2', 'мо']) {
      const result = outcome(query, 'привет')

      assert.equal(result.kind, 'refuse-self', query)
      assert.equal(result.text, SAY_SELF, query)
      assert.ok(!result.text.includes('/sessions say'), query)
    }
  })

  it('пустой текст: отказ, и по имени тоже - до эха', () => {
    for (const query of ['bb22cc33', 'fix-tests', '1']) {
      for (const text of ['', '  \n ']) {
        const result = outcome(query, text)

        assert.equal(result.kind, 'refuse-empty', query)
        assert.equal(result.text, SAY_EMPTY, query)
      }
    }
  })

  it('текущая сессия и пустой текст сразу: сначала «это вы»', () => {
    assert.equal(outcome('моя', '').kind, 'refuse-self')
  })

  it('сессия не найдена или неоднозначна: отказ с причиной выбора', () => {
    const result = outcome('нет-такой', 'привет')

    assert.equal(result.kind, 'refuse-pick')
    assert.match(result.text, /Не нашёл/)
    assert.equal(outcome('', 'привет').kind, 'refuse-pick')
  })

  it('отправка текущей сессии не доходит до send даже по id', () => {
    assert.notEqual(outcome(me, 'привет').kind, 'send')
  })
})

describe('messageFor: метка называет отправителя, но не подтверждает его', () => {
  it('отправитель и текст на месте, текст обрезан по краям', () => {
    const text = messageFor('0de41c8d', '  почини тесты \n')

    assert.ok(text.includes('0de41c8d'))
    assert.ok(text.endsWith('] почини тесты'))
    assert.equal(text, '[метка диспетчера сессий, не проверяется: отправитель 0de41c8d] почини тесты')
  })

  it('метка не обещает подлинности: говорит, что отправитель не проверен', () => {
    const text = messageFor('0de41c8d', 'x')

    assert.match(text, /^\[метка диспетчера сессий, не проверяется: отправитель 0de41c8d\] x$/)
    assert.ok(!/через диспетчер/.test(text))
    assert.ok(!/без проверки/.test(text))
  })
})

describe('launchDir: командный путь не наследует выбор панели', () => {
  it('команда без --dir идёт в каталог этой сессии, даже если в панели выбрано другое', () => {
    assert.equal(launchDir({ flag: '', panel: '/other', cwd: '/here', fromPanel: false }), '')
  })

  it('команда с --dir идёт туда, куда сказано', () => {
    assert.equal(launchDir({ flag: '/x', panel: '/other', cwd: '/here', fromPanel: false }), '/x')
  })

  it('панель берёт выбранную папку, а выбранная текущая - пусто', () => {
    assert.equal(launchDir({ flag: '', panel: '/other', cwd: '/here', fromPanel: true }), '/other')
    assert.equal(launchDir({ flag: '', panel: '/here', cwd: '/here', fromPanel: true }), '')
  })
})

describe('startedMessage', () => {
  it('называет папку, в которой запущена сессия', () => {
    const text = startedMessage({ id: 'abc123', name: 'job' }, '/work/app', '/Users/me')

    assert.match(text, /«job» \(abc123\)/)
    assert.ok(text.includes('/work/app'))
  })

  it('без разбора вывода папка всё равно названа', () => {
    assert.ok(startedMessage(null, '/Users/me/app', '/Users/me').includes('~/app'))
  })
})

describe('settled: отказ запуска становится ответом', () => {
  it('reject превращается в код -1 с текстом ошибки', async () => {
    const res = await settled(Promise.reject(new Error('timeout 30000')))

    assert.equal(res.exitCode, -1)
    assert.match(res.stderr, /timeout 30000/)
  })

  it('успех проходит как есть', async () => {
    const ok = { exitCode: 0, stdout: 'x', stderr: '' }

    assert.deepEqual(await settled(Promise.resolve(ok)), ok)
  })
})

describe('mayMutate: изменяющие команды только от человека и хоста', () => {
  it('composer, bridge, sdk допустимы', () => {
    for (const kind of ['composer', 'bridge', 'sdk']) assert.equal(mayMutate(kind), true, kind)
  })

  it('чужие сообщения, каналы и триггеры - нет', () => {
    for (const kind of ['peer', 'peer-send-message', 'channel', 'scheduled-trigger', 'task-notification', 'coordinator', 'plugin', 'unclassified', 'slack-ping']) {
      assert.equal(mayMutate(kind), false, kind)
    }
  })
})
