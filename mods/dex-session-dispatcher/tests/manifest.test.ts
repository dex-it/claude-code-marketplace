import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const here = (path: string): string => resolve(dirname(fileURLToPath(import.meta.url)), path)

describe('вызов send другой сессии', () => {
  it('register.tsx вызывает send без приведения типа и без подавления проверки', () => {
    const source = readFileSync(here('../hooks/register.tsx'), 'utf8')

    assert.doesNotMatch(source, /as unknown as/)
    assert.doesNotMatch(source, /@ts-(ignore|expect-error)/)
    assert.doesNotMatch(source, /typeof \$\.session\.send/)
  })
})

describe('permissionMode в настройках мода', () => {
  const manifest = JSON.parse(readFileSync(here('../.claude-plugin/plugin.json'), 'utf8')) as {
    userConfig?: Record<string, { options?: string[]; default?: string }>
    options?: Record<string, { options?: string[]; default?: string }>
  }
  const entry = (manifest.userConfig ?? manifest.options ?? {}).permissionMode

  it('список режимов без auto: доступность на других аккаунтах не проверена', () => {
    assert.ok(entry, 'permissionMode не найден в plugin.json')
    assert.deepEqual(entry.options, ['inherit', 'default', 'acceptEdits', 'plan'])
    assert.equal(entry.default, 'inherit')
  })

  it('README не утверждает, что auto принимается везде', () => {
    const readme = readFileSync(here('../README.md'), 'utf8')
    const row = readme.split('\n').find(line => line.startsWith('| `permissionMode`')) ?? ''

    assert.ok(row !== '', 'строка permissionMode не найдена')
    assert.doesNotMatch(row, /принимается/)
  })
})
