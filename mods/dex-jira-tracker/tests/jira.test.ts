// Разбор вывода jira-cli и дельта между опросами. Формы взяты с живого
// jira-cli 1.7.0 против Server 9.2 (list --raw - своя плоская структура,
// view --raw - тело REST), содержимое выдумано.
//
//   node --test mods/dex-jira-tracker/tests

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { Comment, Issue } from '../hooks/jira.ts'
import {
  browseUrl,
  changesOf,
  clean,
  commentChanges,
  detailOfRaw,
  fingerprint,
  firstLine,
  issueOfRaw,
  issuesOfStdout,
  keysOfPlain,
  mentions,
  parseTime,
  textOfBody,
} from '../hooks/jira.ts'

/** Элемент `issue list --raw`: assignee и reporter несут только displayName, comment.total всегда 0. */
const listItem = (overrides: Record<string, unknown> = {}) => ({
  key: 'SUP-12',
  fields: {
    summary: 'Падает выгрузка заказов',
    status: { name: 'В работе' },
    issueType: { id: '10004', name: 'Bug', subtask: false },
    priority: { name: 'High' },
    assignee: { displayName: 'Анна Петрова' },
    reporter: { displayName: 'Борис Иванов' },
    resolution: { name: '' },
    created: '2026-10-20T09:00:00.000+0300',
    updated: '2026-10-23T10:04:52.000+0300',
    labels: ['backend'],
    components: [{ name: 'orders' }],
    comment: { comments: null, total: 0 },
    watches: { isWatching: true, watchCount: 2 },
    description: 'Выгрузка падает на пустом заказе.',
    ...overrides,
  },
})

const issueOf = (overrides: Partial<Issue> = {}): Issue => {
  const base = issueOfRaw(listItem())

  assert.ok(base)

  return { ...base, ...overrides }
}

describe('issueOfRaw', () => {
  test('читает форму list --raw', () => {
    const issue = issueOfRaw(listItem())

    assert.equal(issue?.key, 'SUP-12')
    assert.equal(issue?.status, 'В работе')
    assert.equal(issue?.type, 'Bug')
    assert.equal(issue?.priority, 'High')
    assert.equal(issue?.assignee, 'Анна Петрова')
    assert.equal(issue?.resolution, '')
    assert.deepEqual(issue?.labels, ['backend'])
    assert.deepEqual(issue?.components, ['orders'])
    assert.equal(issue?.watching, true)
  })

  test('читает тело REST: issuetype в нижнем регистре, категория статуса', () => {
    const raw = {
      key: 'SUP-3',
      fields: { summary: 's', issuetype: { name: 'Story' }, status: { name: 'To do', statusCategory: { key: 'new' } } },
    }

    assert.equal(issueOfRaw(raw)?.type, 'Story')
    assert.equal(issueOfRaw(raw)?.category, 'new')
    assert.equal(issueOfRaw(listItem())?.category, '')
  })

  test('нет исполнителя и описания - null и пустая строка, не падение', () => {
    const issue = issueOfRaw(listItem({ assignee: null, description: null }))

    assert.equal(issue?.assignee, null)
    assert.equal(issue?.description, '')
  })

  test('не задача без ключа в форме PROJ-N', () => {
    assert.equal(issueOfRaw({ key: 'nope', fields: {} }), null)
    assert.equal(issueOfRaw(null), null)
    assert.equal(issueOfRaw('SUP-1'), null)
  })

  test('чужой текст чистится: цветовые коды и управляющие символы не доходят до экрана', () => {
    const issue = issueOfRaw(listItem({ summary: '\u001b[31mКрасное\u001b[0m\u0007 название\u0000' }))

    assert.equal(issue?.summary, 'Красное название')
  })
})

describe('issuesOfStdout', () => {
  test('пустой вывод и null - пустой список', () => {
    assert.deepEqual(issuesOfStdout(''), [])
    assert.deepEqual(issuesOfStdout('  \n'), [])
    assert.deepEqual(issuesOfStdout('null'), [])
  })

  test('массив разбирается, мусорные элементы отбрасываются', () => {
    const issues = issuesOfStdout(JSON.stringify([listItem(), { key: 'bad' }, 7]))

    assert.deepEqual(issues.map(issue => issue.key), ['SUP-12'])
  })

  test('не JSON - исключение, а не молчаливо пустой список', () => {
    assert.throws(() => issuesOfStdout('Error: boom'))
  })
})

describe('detailOfRaw', () => {
  const rest = {
    id: '44200',
    self: 'https://jira.example.com/jira/rest/api/2/issue/44200',
    key: 'SUP-12',
    fields: {
      summary: 'Падает выгрузка',
      status: { name: 'В работе' },
      comment: {
        total: 4,
        comments: [
          {
            id: '1',
            author: { name: 'a.petrova', emailAddress: 'a@example.com', displayName: 'Анна Петрова' },
            body: 'Воспроизвела на стенде.',
            created: '2026-10-23T10:04:52.000+0300',
          },
        ],
      },
    },
  }

  test('комментарии с логином и адрес сервера из self', () => {
    const detail = detailOfRaw(rest)

    assert.equal(detail?.baseUrl, 'https://jira.example.com/jira')
    assert.equal(detail?.total, 4)
    assert.equal(detail?.comments[0]?.login, 'a.petrova')
    assert.equal(detail?.comments[0]?.author, 'Анна Петрова')
    assert.equal(detail?.comments[0]?.text, 'Воспроизвела на стенде.')
  })

  test('адрес в браузере строится из base и ключа', () => {
    assert.equal(browseUrl('https://jira.example.com/jira', 'SUP-12'), 'https://jira.example.com/jira/browse/SUP-12')
    assert.equal(browseUrl('', 'SUP-12'), '')
  })

  test('self без /rest/ - адреса нет, а не обрезок', () => {
    assert.equal(detailOfRaw({ ...rest, self: 'https://x/y' })?.baseUrl, '')
  })
})

describe('textOfBody', () => {
  test('строка (Server, wiki-разметка) остаётся как написана', () => {
    assert.equal(textOfBody('h1. Заголовок\n* пункт'), 'h1. Заголовок\n* пункт')
  })

  test('ADF (Cloud) собирается в текст', () => {
    const adf = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Первая' }, { type: 'hardBreak' }, { type: 'text', text: 'строка' }] },
        { type: 'paragraph', content: [{ type: 'mention', attrs: { text: '@anna' } }, { type: 'text', text: ' глянь' }] },
      ],
    }

    assert.equal(textOfBody(adf), 'Первая\nстрока\n@anna глянь')
  })

  test('не строка и не документ - пусто', () => {
    assert.equal(textOfBody(undefined), '')
    assert.equal(textOfBody(42), '')
  })
})

describe('мелкие чистые функции', () => {
  test('clean: ANSI, управляющие, CRLF', () => {
    assert.equal(clean('a\u001b[1mb\u001b[0m\r\nc\u0000'), 'ab\nc')
  })

  test('firstLine режет и берёт первую непустую', () => {
    assert.equal(firstLine('\n\n  привет  \nвторая'), 'привет')
    assert.equal(firstLine('x'.repeat(50), 10), 'xxxxxxxxx...')
  })

  test('parseTime понимает +0300 без двоеточия и мусор читает нулём', () => {
    assert.equal(parseTime('2026-10-23T10:04:52.000+0300'), Date.parse('2026-10-23T07:04:52.000Z'))
    assert.equal(parseTime('вчера'), 0)
  })

  test('keysOfPlain берёт ключи из первой колонки и пропускает всё остальное', () => {
    const out = '\u001b[0;31m✗\u001b[0m No result\nSUP-1\tTask\nSUP-22  Bug\nголова\n'

    assert.deepEqual(keysOfPlain(out), ['SUP-1', 'SUP-22'])
  })

  test('fingerprint различает правку и совпадает на равном', () => {
    assert.equal(fingerprint('a b c'), fingerprint('a b c'))
    assert.notEqual(fingerprint('a b c'), fingerprint('a b d'))
  })
})

describe('changesOf', () => {
  const was = { wasMine: false, isMine: false, wasDone: false, isDone: false }

  test('ничего не изменилось - ничего не объявлено', () => {
    assert.deepEqual(changesOf(issueOf(), issueOf(), was), [])
  })

  test('статус', () => {
    const out = changesOf(issueOf({ status: 'To do' }), issueOf({ status: 'В работе' }), was)

    assert.deepEqual(out.map(c => c.kind), ['status'])
    assert.equal(out[0]?.text, 'статус: To do -> В работе')
  })

  test('закрытие объявляется закрытием, а не сменой статуса; resolution приписан, если он есть', () => {
    const out = changesOf(issueOf(), issueOf({ status: 'Closed', resolution: 'Done' }), { ...was, isDone: true })

    assert.deepEqual(out.map(c => c.kind), ['resolved'])
    assert.equal(out[0]?.level, 'good')
    assert.equal(out[0]?.text, 'закрыта: Closed (Done)')
  })

  test('закрытие без resolution (так бывает в workflow) - всё равно закрытие', () => {
    const out = changesOf(issueOf(), issueOf({ status: 'Closed', resolution: '' }), { ...was, isDone: true })

    assert.equal(out[0]?.text, 'закрыта: Closed')
  })

  test('переоткрытие - плохо', () => {
    const out = changesOf(issueOf({ status: 'Closed' }), issueOf({ status: 'Reopened' }), { ...was, wasDone: true })

    assert.deepEqual(out.map(c => c.kind), ['reopened'])
    assert.equal(out[0]?.level, 'bad')
  })

  test('назначение на вас зовёт, назначение другому - нет', () => {
    const toMe = changesOf(issueOf({ assignee: null }), issueOf(), { ...was, isMine: true })
    const toOther = changesOf(issueOf({ assignee: null }), issueOf(), was)

    assert.equal(toMe[0]?.text, 'назначена на вас')
    assert.equal(toMe[0]?.level, 'wait')
    assert.equal(toOther[0]?.level, 'info')
    assert.equal(toOther[0]?.text, 'исполнитель: не назначен -> Анна Петрова')
  })

  test('снятие с вас называется', () => {
    const out = changesOf(issueOf(), issueOf({ assignee: 'Борис Иванов' }), { ...was, wasMine: true })

    assert.equal(out[0]?.text, 'снята с вас, исполнитель: Борис Иванов')
  })

  test('приоритет, название, описание', () => {
    const out = changesOf(
      issueOf({ descFp: fingerprint('старое') }),
      issueOf({ priority: 'Low', summary: 'Другое', descFp: fingerprint('новое') }),
      was,
    )

    assert.deepEqual(out.map(c => c.kind), ['priority', 'summary', 'description'])
  })
})

describe('commentChanges', () => {
  const comment = (id: string, login: string, created: string, text = 'текст'): Comment => ({
    id,
    author: login,
    login,
    email: '',
    created,
    text,
  })
  const since = parseTime('2026-10-23T10:00:00.000+0300')

  test('берёт только новее прежнего updated', () => {
    const out = commentChanges(
      [comment('1', 'a', '2026-10-23T09:00:00.000+0300'), comment('2', 'b', '2026-10-23T10:30:00.000+0300', 'новый')],
      since,
      'me',
    )

    assert.equal(out.length, 1)
    assert.equal(out[0]?.text, 'b: новый')
  })

  test('свои комментарии не объявляются: по логину и по e-mail (Cloud)', () => {
    const own = comment('3', 'me', '2026-10-23T10:30:00.000+0300')
    const cloud: Comment = { ...comment('4', '', '2026-10-23T10:31:00.000+0300'), email: 'me@example.com' }

    assert.deepEqual(commentChanges([own], since, 'me'), [])
    assert.deepEqual(commentChanges([cloud], since, 'me@example.com'), [])
  })

  test('упоминание вас зовёт', () => {
    const out = commentChanges([comment('5', 'b', '2026-10-23T10:30:00.000+0300', 'глянь [~me], пожалуйста')], since, 'me')

    assert.equal(out[0]?.level, 'wait')
    assert.match(out[0]?.text ?? '', /упомянул вас/)
    assert.equal(mentions('глянь [~me]', 'me'), true)
    assert.equal(mentions('глянь [~me]', null), false)
  })
})
