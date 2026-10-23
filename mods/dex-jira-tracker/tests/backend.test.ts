// Источник данных - jira-cli. Host подменён: прогон проверяет, какие аргументы
// уходят в `jira`, как читаются его отказы и что именно говорится человеку,
// когда бинаря нет или вход не настроен. Тексты ошибок сняты с jira-cli 1.7.0.
//
//   node --test mods/dex-jira-tracker/tests

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { Host, RunResult } from '../hooks/backend.ts'
import { JiraAuthError, backendOf, failureText, problemText } from '../hooks/backend.ts'

type Script = (argv: readonly string[]) => RunResult | 'missing'

const ok = (stdout = ''): RunResult => ({ exitCode: 0, stdout, stderr: '' })
const fail = (stderr: string): RunResult => ({ exitCode: 1, stdout: '', stderr })

function hostOf(script: Script): { host: Host; calls: string[][] } {
  const calls: string[][] = []

  return {
    calls,
    host: {
      run: async argv => {
        calls.push([...argv])

        const out = script(argv)

        if (out === 'missing') throw new Error('spawn jira ENOENT')

        return out
      },
    },
  }
}

const VERSION = '(Version="1.7.0", GitCommit="Homebrew")'

const working: Script = argv => {
  if (argv[1] === 'version') return ok(VERSION)
  if (argv[1] === 'me') return ok('a.petrova\n')

  return ok()
}

describe('backendOf: что не так с jira-cli', () => {
  test('бинаря нет - missing, и текст отсылает к /jira install', async () => {
    const { host } = hostOf(() => 'missing')
    const choice = await backendOf(host, { project: '', cwd: '/w' })

    assert.equal(choice.kind, 'missing')
    assert.match(problemText('missing', choice.reason ?? ''), /\/jira install/)
  })

  test('бинарь есть, токена нет - auth, и текст называет JIRA_API_TOKEN', async () => {
    const { host } = hostOf(argv =>
      argv[1] === 'version' ? ok(VERSION) : fail('\u001b[0;33mThe tool needs a Jira API token to function.\u001b[0m For cloud server: ...'),
    )
    const choice = await backendOf(host, { project: '', cwd: '/w' })

    assert.equal(choice.kind, 'auth')
    assert.match(problemText('auth', choice.reason ?? ''), /JIRA_API_TOKEN/)
    assert.doesNotMatch(choice.reason ?? '', /\u001b/)
  })

  test('нет конфига - setup, и текст зовёт jira init', async () => {
    const { host } = hostOf(argv => (argv[1] === 'version' ? ok(VERSION) : fail('open /x/.config.yml: no such file or directory')))
    const choice = await backendOf(host, { project: '', cwd: '/w' })

    assert.equal(choice.kind, 'setup')
    assert.match(problemText('setup', choice.reason ?? ''), /jira init/)
  })

  test('работает: логин из jira me и версия', async () => {
    const { host } = hostOf(working)
    const choice = await backendOf(host, { project: '', cwd: '/w' })

    assert.equal(choice.login, 'a.petrova')
    assert.equal(choice.version, '1.7.0')
    assert.ok(choice.source)
  })
})

describe('Source', () => {
  const build = async (script: Script, project = '') => {
    const { host, calls } = hostOf(script)
    const choice = await backendOf(host, { project, cwd: '/w' })

    assert.ok(choice.source)

    calls.length = 0

    return { source: choice.source, calls }
  }

  test('list: запрос, raw, порядок по обновлению и страница; проект - через -p', async () => {
    const { source, calls } = await build(
      argv => (argv[1] === 'issue' ? ok(JSON.stringify([{ key: 'SUP-1', fields: { summary: 's' } }])) : working(argv)),
      'SUP',
    )
    const page = await source.list('(resolution = Unresolved)', 50)

    assert.deepEqual(calls[0], [
      'jira', 'issue', 'list', '-q', '(resolution = Unresolved)', '--raw', '--order-by', 'updated', '--paginate', '0:50', '-p', 'SUP',
    ])
    assert.equal(page.issues[0]?.key, 'SUP-1')
    assert.equal(page.truncated, false)
  })

  test('list: страница ровно в limit - выдача могла быть обрезана', async () => {
    const two = JSON.stringify([{ key: 'SUP-1', fields: {} }, { key: 'SUP-2', fields: {} }])
    const { source } = await build(argv => (argv[1] === 'issue' ? ok(two) : working(argv)))

    assert.equal((await source.list('x', 2)).truncated, true)
  })

  test('пустая выдача - не ошибка: jira-cli выходит с 1 и пишет «No result found»', async () => {
    const { source } = await build(argv => (argv[1] === 'issue' ? fail('\u001b[0;31m✗\u001b[0m No result found for given query in project "SUP"') : working(argv)))

    assert.deepEqual((await source.list('x', 10)).issues, [])
    assert.equal((await source.keys('x', 10)).size, 0)
  })

  test('keys: только ключи, без заголовков', async () => {
    const { source, calls } = await build(argv => (argv[1] === 'issue' ? ok('SUP-1\nSUP-5\n') : working(argv)))
    const keys = await source.keys('q', 100)

    assert.deepEqual([...keys], ['SUP-1', 'SUP-5'])
    assert.ok(calls[0]?.includes('--plain') && calls[0].includes('--no-headers'))
    assert.ok(calls[0]?.join(' ').includes('--order-by updated'))
  })

  test('отказ по входу - JiraAuthError, чтобы опрос по таймеру встал; прочий отказ - обычная ошибка', async () => {
    const { source } = await build(argv => (argv[1] === 'issue' ? fail('Error:\n  - 401 Unauthorized') : working(argv)))

    await assert.rejects(source.list('x', 10), JiraAuthError)

    const { source: other } = await build(argv => (argv[1] === 'issue' ? fail('Error:\n  - Error in the JQL Query: Expecting a field name') : working(argv)))

    await assert.rejects(other.list('x', 10), (error: unknown) => error instanceof Error && !(error instanceof JiraAuthError) && /JQL/.test(error.message))
  })

  test('view: нет такой задачи - null; есть - детали', async () => {
    const body = JSON.stringify({ key: 'SUP-3', self: 'https://j.example.com/rest/api/2/issue/1', fields: { summary: 's' } })
    const { source } = await build(argv =>
      argv[1] === 'issue' && argv[2] === 'view' ? (argv[3] === 'SUP-3' ? ok(body) : fail('Error:\n  - Issue does not exist or you do not have permission to see it.')) : working(argv),
    )

    assert.equal((await source.view('SUP-404', 5)), null)
    assert.equal((await source.view('SUP-3', 5))?.baseUrl, 'https://j.example.com')
  })

  test('url: адрес берётся из jira open --no-browser, браузер не открывается', async () => {
    const { source, calls } = await build(argv => (argv[1] === 'open' ? ok('https://j.example.com/browse/SUP-3\n') : working(argv)))

    assert.equal(await source.url('SUP-3'), 'https://j.example.com/browse/SUP-3')
    assert.deepEqual(calls[0]?.slice(0, 4), ['jira', 'open', 'SUP-3', '--no-browser'])
  })

  test('assign и move передают аргументы как есть; отказ - исключение с причиной', async () => {
    const { source, calls } = await build(argv => (argv[2] === 'move' ? fail("Error:\n  - Invalid transition 'Nope'") : working(argv)))

    await source.assign('SUP-3', 'a.petrova')

    assert.deepEqual(calls[0], ['jira', 'issue', 'assign', 'SUP-3', 'a.petrova'])
    await assert.rejects(source.move('SUP-3', 'Nope'), /Invalid transition/)
  })
})

describe('failureText', () => {
  test('берёт причину, а не заголовок «Error:», и чистит цвета', () => {
    assert.equal(failureText(fail('\u001b[31mError:\u001b[0m\n  - The value \'NOPE\' does not exist for the field \'project\'.')), "The value 'NOPE' does not exist for the field 'project'.")
  })

  test('пусто на обоих потоках - код выхода', () => {
    assert.equal(failureText({ exitCode: 2, stdout: '', stderr: '' }), 'jira завершился с кодом 2')
  })
})
