// Что мод отдаёт модели по кнопке «ревью» и «поправить»: текст поручения.
// Чистый модуль без `$`: что именно уйдёт агенту, решается здесь и
// проверяется прогоном, а запуск (`$.prompt.submit`, `$.agent.spawn`) остаётся
// в точке входа.
//
// Ревью идёт командой каталога в основной цикл, а не отдельным агентом: ревью
// публикует находки в чужой PR только по команде оператора, и канал к
// оператору есть у главного цикла, у фонового агента его нет.
// Фиксер, напротив, фоновый: правка тредов - работа с известным входом и
// понятным исходом, оператор нужен ему только на пуше, и тот закрыт настройкой.

import type { Thread } from './github.ts'
import { threadsListText } from './text.ts'
import type { Watched } from './watched.ts'
import { openThreadsOf } from './watched.ts'

/** Какие треды отдать фиксеру: все открытые либо один по номеру из `/pr threads`. */
export type FixTarget = 'all' | number

export type FixPick =
  | { ok: true; threads: Thread[] }
  | { ok: false; reason: string }

/**
 * Выбрать треды по цели. Нумерация - порядок `openThreadsOf`, тот же, что в
 * `/pr threads`: номер, который человек видит, и номер, который мод ищет, не
 * расходятся.
 */
export function pickThreads(watched: Watched, target: FixTarget): FixPick {
  const data = watched.data

  if (!data) return { ok: false, reason: `${watched.label}: данных ещё нет` }

  if (data.state !== 'OPEN') {
    return { ok: false, reason: `${watched.label}: PR не открыт (${data.state.toLowerCase()}), править нечего` }
  }

  const open = openThreadsOf(data)

  if (open.length === 0) return { ok: false, reason: `${watched.label}: открытых тредов нет` }

  if (target === 'all') return { ok: true, threads: open }

  const thread = open[target - 1]

  return thread
    ? { ok: true, threads: [thread] }
    : { ok: false, reason: `${watched.label}: тред ${target} не найден, открытых ${open.length}` }
}

/** Поручение на ревью: команда каталога и ссылка на PR. */
export const reviewPrompt = (command: string, watched: Watched): string | null => {
  const url = watched.data?.webUrl

  return url === undefined || url === '' ? null : `/${command.replace(/^\//, '')} ${url}`
}

/**
 * Поручение агенту-фиксеру. Агент стартует с пустым контекстом, поэтому в
 * тексте всё: куда идти (ветка PR), что чинить (треды с адресами), как
 * проверить и чего не делать. «Не делать» названо явно: резолв треда и ответ в
 * него - решение ревьюера и автора, а не исполнителя правки.
 */
export function fixPrompt(
  watched: Watched,
  threads: readonly Thread[],
  options: { push: boolean },
): string {
  const data = watched.data

  if (!data) return ''

  const list = threadsListText(watched, data, threads, 'Замечания', 12000)
  const delivery = options.push
    ? `Запушь коммиты в ветку ${data.headRefName} этого же PR (новую ветку и новый PR не заводи), историю ветки не переписывай.`
    : 'Запушить нельзя: коммиты остаются локальными в worktree, путь и список коммитов - в отчёте.'

  return [
    `Поправь замечания ревью в pull request ${watched.label} (${data.webUrl}): ${data.title}.`,
    `Ветка PR: ${data.headRefName} -> ${data.baseRefName}.`,
    '',
    list,
    '',
    'Порядок работы:',
    `1. Заведи отдельный git worktree на ветке ${data.headRefName} (актуальная версия с origin). Текущую рабочую копию и её ветку не трогай.`,
    '2. По каждому замечанию прочитай тред целиком по ссылке и код вокруг указанной строки. Чини причину, а не симптом. Замечание, с которым не согласен или которое неясно, не правь: верни его с обоснованием.',
    '3. После правок прогони проверки проекта, которых коснулись изменения (сборка, тесты, линтер). Красная проверка не закрывается словом «скорее всего не из-за меня»: покажи вывод.',
    '4. Один коммит на замечание либо на группу связанных, сообщение - что исправлено и по какому замечанию.',
    `5. ${delivery}`,
    '6. Треды не резолви и в PR не отвечай - это решают ревьюер и автор.',
    '',
    'Отчёт: по каждому замечанию - исправлено (коммит) либо не исправлено (причина); результат проверок.',
  ].join('\n')
}
