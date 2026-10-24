import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  absorbChunk,
  emptyStats,
  maskSecrets,
  percentOf,
  snippet,
  todoProgress,
  tokensWord,
  topOf,
  windowOf,
} from '../hooks/transcript.ts'

const line = (value: unknown): string => JSON.stringify(value)

const assistant = (requestId: string, content: unknown[], usage?: Record<string, number>) =>
  line({ type: 'assistant', requestId, timestamp: 't', message: { model: 'claude-x', content, ...(usage ? { usage } : {}) } })

describe('absorbChunk', () => {
  it('считает usage один раз на запрос, хотя блоков несколько', () => {
    const usage = { input_tokens: 2, cache_creation_input_tokens: 10, cache_read_input_tokens: 100, output_tokens: 7 }
    const text = [
      assistant('r1', [{ type: 'text', text: 'думаю' }], usage),
      assistant('r1', [{ type: 'tool_use', name: 'Skill', input: { skill: 'review' } }], usage),
      assistant('r2', [{ type: 'text', text: 'готово' }], { ...usage, output_tokens: 3 }),
    ].join('\n') + '\n'

    const stats = absorbChunk(emptyStats(), { text, from: 0 })

    assert.equal(stats.calls, 2)
    assert.equal(stats.outputTokens, 10)
    assert.equal(stats.inputTokens, 24)
    assert.equal(stats.cacheReadTokens, 200)
    assert.equal(stats.contextTokens, 112)
    assert.equal(stats.model, 'claude-x')
    assert.equal(stats.lastAnswer, 'готово')
    assert.deepEqual(stats.skills, { review: 1 })
  })

  it('отличает слова человека от ответов инструментов, заметок и сообщений соседей', () => {
    const text = [
      line({ type: 'user', message: { content: 'сделай тесты' } }),
      line({ type: 'user', message: { content: [{ type: 'tool_result', content: 'ok' }] } }),
      line({ type: 'user', isMeta: true, message: { content: 'служебное' } }),
      line({ type: 'user', origin: { kind: 'task-notification' }, message: { content: 'уведомление' } }),
      line({ type: 'user', origin: { kind: 'peer', name: 'приёмка' }, message: { content: 'привет' } }),
    ].join('\n') + '\n'

    const stats = absorbChunk(emptyStats(), { text, from: 0 })

    assert.equal(stats.prompts, 1)
    assert.equal(stats.lastPrompt, 'сделай тесты')
    assert.deepEqual(stats.received, [{ who: 'приёмка', text: 'привет' }])
  })

  it('берёт план, шаги, субагентов, отправленные сообщения, заголовок и PR', () => {
    const text = [
      assistant('r1', [
        { type: 'tool_use', name: 'TodoWrite', input: { todos: [{ content: 'a', status: 'completed' }, { content: 'b', status: 'in_progress' }, { content: 'c', status: 'pending' }] } },
        { type: 'tool_use', name: 'Agent', input: { description: 'проверка слоя' } },
        { type: 'tool_use', name: 'SendMessage', input: { to: 'DP-3168', message: 'привет' } },
        { type: 'tool_use', name: 'ExitPlanMode', input: { plan: '\n# План дня\n\nтекст' } },
      ]),
      line({ type: 'ai-title', aiTitle: 'Приёмка слоя' }),
      line({ type: 'pr-link', prUrl: 'https://github.com/o/r/pull/1' }),
      line({ type: 'pr-link', prUrl: 'https://github.com/o/r/pull/1' }),
    ].join('\n') + '\n'

    const stats = absorbChunk(emptyStats(), { text, from: 0 })

    assert.deepEqual(todoProgress(stats.todos), { done: 1, total: 3, current: 'b' })
    assert.equal(stats.subagents, 1)
    assert.deepEqual(stats.subagentNotes, ['проверка слоя'])
    assert.deepEqual(stats.sent, [{ who: 'DP-3168', text: 'привет' }])
    assert.equal(stats.plan, 'План дня')
    assert.equal(stats.title, 'Приёмка слоя')
    assert.deepEqual(stats.pullRequests, ['https://github.com/o/r/pull/1'])
  })

  it('кусок не с начала файла теряет первую (оборванную) строку', () => {
    const whole = line({ type: 'user', message: { content: 'первая' } })
    const text = `${whole.slice(10)}\n${line({ type: 'user', message: { content: 'вторая' } })}\n`

    const stats = absorbChunk(emptyStats(), { text, from: 500 })

    assert.equal(stats.prompts, 1)
    assert.equal(stats.lastPrompt, 'вторая')
    assert.equal(stats.since, 500)
  })

  it('оборванная последняя запись не теряется: offset встаёт до неё, дочитывается потом', () => {
    const full = line({ type: 'user', message: { content: 'целая' } })
    const cut = line({ type: 'user', message: { content: 'половина' } })
    const first = `${full}\n${cut.slice(0, 15)}`
    const stats = absorbChunk(emptyStats(), { text: first, from: 0 })

    assert.equal(stats.prompts, 1)
    assert.equal(stats.offset, new TextEncoder().encode(`${full}\n`).length)

    const tail = `${cut}\n`

    absorbChunk(stats, { text: tail, from: stats.offset })

    assert.equal(stats.prompts, 2)
    assert.equal(stats.lastPrompt, 'половина')
  })

  it('мусорные строки пропускаются', () => {
    const stats = absorbChunk(emptyStats(), { text: 'не json\n{"type":"user"\n\n', from: 0 })

    assert.equal(stats.prompts, 0)
  })
})

describe('вспомогательные', () => {
  it('snippet чистит управляющие символы и режет длину', () => {
    assert.equal(snippet('а\u001b[31m\nб   в'), 'а б в')
    assert.equal(snippet('x'.repeat(50), 10), 'xxxxxxxxx…')
  })

  it('окно контекста: названное, иначе угаданное', () => {
    const stats = emptyStats()

    assert.equal(windowOf(stats, 0), 200_000)
    assert.equal(windowOf(stats, 123), 123)

    stats.contextTokens = 300_000

    assert.equal(windowOf(stats, 0), 1_000_000)
    assert.equal(percentOf(300_000, 1_000_000), 30)
    assert.equal(percentOf(5, 0), 0)
    assert.equal(percentOf(9_000_000, 1_000_000), 100)
  })

  it('tokensWord и topOf', () => {
    assert.equal(tokensWord(950), '950')
    assert.equal(tokensWord(1500), '1.5k')
    assert.equal(tokensWord(42_000), '42k')
    assert.equal(tokensWord(2_500_000), '2.5M')
    assert.deepEqual(topOf({ a: 1, b: 3, c: 3 }, 2), [['b', 3], ['c', 3]])
  })
})

describe('absorbChunk: хвост, начатый посреди многобайтного символа', () => {
  const enc = new TextEncoder()
  const dec = new TextDecoder()
  const user = (text: string) => JSON.stringify({ type: 'user', message: { role: 'user', content: text } })

  it('offset считается по сырым байтам и равен размеру файла', () => {
    const file = enc.encode(`${user('привет, мир')}\n${user('второе задание')}\n`)
    const mid = file.indexOf(0xd0) + 1 // вторая половина первого кириллического символа

    // tail отдаёт сырые байты, а мод получает строку: обрубок символа становится U+FFFD.
    const text = dec.decode(file.slice(mid))
    const stats = absorbChunk(emptyStats(), { text, from: mid })

    assert.equal(stats.offset, file.length)
    assert.equal(stats.prompts, 1)
    assert.equal(stats.lastPrompt, 'второе задание')
  })

  it('следующее чтение с этого offset ничего не теряет', () => {
    const first = enc.encode(`${user('привет')}\n${user('раз')}\n`)
    const second = enc.encode(`${user('два')}\n`)
    const mid = first.indexOf(0xd0) + 1
    const stats = absorbChunk(emptyStats(), { text: dec.decode(first.slice(mid)), from: mid })

    absorbChunk(stats, { text: dec.decode(second), from: stats.offset })

    assert.equal(stats.offset, first.length + second.length)
    assert.equal(stats.lastPrompt, 'два')
  })

  it('начало на границе символа ведёт себя как раньше', () => {
    const file = enc.encode(`${user('привет')}\n${user('мир')}\n`)
    const cut = file.indexOf(0xd0) + 2 // ровно после первого символа: границы символа соблюдены
    const stats = absorbChunk(emptyStats(), { text: dec.decode(file.slice(cut)), from: cut })

    assert.equal(stats.offset, file.length)
    assert.equal(stats.lastPrompt, 'мир')
  })
})

describe('snippet: секреты маскируются', () => {
  const FAKE = 'FAKE-test-only-not-a-key'

  it('токены известных видов заменяются заглушкой', () => {
    const tokens = [
      `ghp_${'A1b2C3d4E5'.repeat(3)}`,
      `github_pat_${'A1b2C3d4E5'.repeat(3)}`,
      `glpat-${'A1b2C3d4E5'.repeat(2)}`,
      `sk-ant-${'A1b2C3d4E5'.repeat(3)}`,
      'AKIAABCDEFGHIJKLMNOP',
      `xoxb-${'1234567890'.repeat(2)}`,
      `Bearer ${'abcDEF123456'.repeat(3)}`,
      `sk_live_${'A1b2C3d4E5'.repeat(3)}`,
      `rk_test_${'A1b2C3d4E5'.repeat(3)}`,
      `AIza${'A1b2C3d4E5'.repeat(3)}abcde`,
      `npm_${'A1b2C3d4E5'.repeat(3)}abcdef`,
      `gldt-${'A1b2C3d4E5'.repeat(2)}`,
      `eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.${'A1b2C3d4E5'.repeat(2)}`,
      `Basic ${'dXNlcjpwYXNzd29yZA=='}`,
      `\u001b[0mghp_${'A1b2C3d4E5'.repeat(3)}`,
      `\u001b[38:5:1msk-${'A1b2C3d4E5'.repeat(2)}`,
      `\u001b[>4;1msk-${'A1b2C3d4E5'.repeat(2)}`,
      `tokenghp_${'A1b2C3d4E5'.repeat(3)}`,
    ]

    for (const token of tokens) {
      const out = snippet(`запусти curl с ${token} и всё`)

      assert.ok(!out.includes(token), token)
      assert.match(out, /\[секрет скрыт\]/)
      assert.match(out, /^запусти curl с .* и всё$/)
    }
  })

  it('приватный ключ в несколько строк уходит целиком', () => {
    const out = snippet(`ключ:\n-----BEGIN RSA PRIVATE KEY-----\n${FAKE}\nMIIBOg\n-----END RSA PRIVATE KEY-----\nдальше`)

    assert.ok(!out.includes(FAKE))
    assert.ok(!out.includes('MIIBOg'))
    assert.match(out, /дальше$/)
  })

  it('маска ставится до обрезки: хвост токена на границе не торчит', () => {
    const token = `ghp_${'Z9y8X7w6V5'.repeat(3)}`
    const out = snippet(`${'я'.repeat(20)} ${token}`, 30)

    assert.ok(!out.includes('ghp_Z9'))
  })

  it('обычный текст, похожий на префикс, не трогается', () => {
    assert.equal(snippet('task-sk-1 и ghp короткое'), 'task-sk-1 и ghp короткое')
    assert.equal(snippet('Basic authentication включена'), 'Basic authentication включена')
    assert.equal(snippet('max_tokens: 100000'), 'max_tokens: 100000')

    for (const plain of [
      'input_tokens: 12345678',
      '"output_tokens":123456789',
      'tokenizer: cl100k_base',
      'Secretary: Johnson-Smith',
      'secrets: /home/u/.config/app/secrets.yaml',
      'const secretKey = getSecretKeyFromVault();',
      'token: process.env.GH_TOKEN',
      'Basic auth/authorization flow',
      'basic config/settings.json',
    ]) {
      assert.equal(snippet(plain), plain, plain)
    }
  })

  it('маска линейна: длинный пробельный кусок не морозит клиент', () => {
    for (const filler of [
      ' '.repeat(100_000),
      '\n'.repeat(100_000),
      `token${' '.repeat(100_000)}=`,
      `${'token='.repeat(20_000)}.`,
      'eyJ-'.repeat(20_000),
      `${'eyJabcdefgh.'.repeat(10_000)}-`,
      `${'Basic '.repeat(20_000)}x`,
      `token=${'a'.repeat(100_000)}(`,
    ]) {
      const started = performance.now()

      maskSecrets(`a${filler}b`)

      assert.ok(performance.now() - started < 500, `${filler.slice(0, 8)} x${filler.length}`)
    }
  })

  it('ключ длиннее любого потолка скрыт целиком', () => {
    const long = 'A1b2C3d4E5'.repeat(600)

    for (const [text, kept] of [
      [`jwt eyJ${long}.eyJ${long}.${long} конец`, 'jwt [секрет скрыт] конец'],
      [`token=${long} конец`, 'token=[секрет скрыт] конец'],
      [`Basic ${long}== конец`, '[секрет скрыт] конец'],
    ] as const) {
      assert.equal(maskSecrets(text), kept)
    }
  })

  it('значение перед точкой в конце фразы скрыто, перед точкой кода - нет', () => {
    assert.equal(maskSecrets('мой token=abcd1234efgh.'), 'мой token=[секрет скрыт].')
    assert.equal(maskSecrets('token = settings.tokenValue'), 'token = settings.tokenValue')
  })

  it('пароль в URL и значение по ключу скрываются, ключ и адрес остаются', () => {
    assert.equal(snippet('postgres://app:S3cretPass@db:5432/x'), 'postgres://app:[секрет скрыт]@db:5432/x')
    assert.equal(snippet('AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMIK7MDENG'), 'AWS_SECRET_ACCESS_KEY=[секрет скрыт]')
    assert.equal(snippet('api_key: "abcd1234efgh"'), 'api_key: "[секрет скрыт]"')
    assert.equal(snippet('password=hunter2hunter2 дальше'), 'password=[секрет скрыт] дальше')
    assert.equal(snippet('redis://:p4ssw0rd@host:6379'), 'redis://:[секрет скрыт]@host:6379')
    assert.equal(snippet('Authorization: basic dXNlcjpwYXNz'), 'Authorization: basic [секрет скрыт]')
  })
})
