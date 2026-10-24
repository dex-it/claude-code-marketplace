import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isInside, MISS_RETRY_MS, needsScan, projectSlug, projectsRoot, subagentsDir, transcriptPath } from '../hooks/paths.ts'

describe('paths', () => {
  it('имя папки проекта - путь с заменой не букв и не цифр', () => {
    assert.equal(projectSlug('/Users/anonymous/Desktop/Work/Marketplace'), '-Users-anonymous-Desktop-Work-Marketplace')
    assert.equal(projectSlug('/a/.cache/b_c'), '-a--cache-b-c')
  })

  it('путь транскрипта и папка субагентов', () => {
    const path = transcriptPath('/h/.claude/', '/p/q', 'id1')

    assert.equal(path, '/h/.claude/projects/-p-q/id1.jsonl')
    assert.equal(subagentsDir(path ?? ''), '/h/.claude/projects/-p-q/id1/subagents')
    assert.equal(projectsRoot('/h/.claude/'), '/h/.claude/projects')
  })

  it('слишком длинный путь не восстанавливается', () => {
    assert.equal(transcriptPath('/h', `/${'a'.repeat(250)}`, 'id'), null)
  })
})

describe('isInside: префикс пути с разделителем', () => {
  it('сам каталог и вложенные входят', () => {
    assert.equal(isInside('/repo/app', '/repo/app'), true)
    assert.equal(isInside('/repo/app/src', '/repo/app'), true)
    assert.equal(isInside('/repo/app/src', '/repo/app/'), true)
  })

  it('сосед с общим началом имени не входит', () => {
    assert.equal(isInside('/repo/app2', '/repo/app'), false)
    assert.equal(isInside('/home/mmx2', '/home/mmx'), false)
  })

  it('пустой корень не содержит ничего, корень / содержит всё', () => {
    assert.equal(isInside('/a', ''), false)
    assert.equal(isInside('/a', '/'), true)
  })
})

describe('needsScan: неудачный поиск транскрипта помнится', () => {
  it('ещё не искали - ищем', () => {
    assert.equal(needsScan(undefined, 1000, '/p'), true)
  })

  it('не нашли только что - не ищем снова', () => {
    assert.equal(needsScan({ at: 1000, cwd: '/p' }, 1000 + 10_000, '/p'), false)
  })

  it('через минуту ищем снова', () => {
    assert.equal(needsScan({ at: 1000, cwd: '/p' }, 1000 + MISS_RETRY_MS, '/p'), true)
  })

  it('сменился каталог сессии - ищем сразу', () => {
    assert.equal(needsScan({ at: 1000, cwd: '/p' }, 1000 + 1000, '/q'), true)
  })
})
