// Один опрос: о чём спрашивается GitHub и как добираются страницы тредов.
// Здесь же поиск PR по имени ветки и текст самих запросов - они форма того же
// решения «что спросить за один раз».
//
// Почему GraphQL, а не REST: состояние ревью-треда - решён он или нет -
// существует только здесь. REST `GET /repos/{owner}/{repo}/pulls/{n}/comments`
// такого поля не несёт вовсе (docs.github.com/rest/pulls/comments, сверено
// 25.09.2026), а резолв тредов - и есть то, ради чего за PR следят. Один
// запрос отвечает за четыре REST-вызова и стоит одну точку лимита вместо
// четырёх (docs.github.com/graphql/overview/resource-limitations).
//
// Модуль ничего не импортирует в рантайме - только типы. Это не стиль, а
// условие проверяемости: прогон подменяет `Api` и импортирует этот файл
// напрямую, а Node резолвит относительные импорты без расширения только
// внутри процесса Claude Code. Разбор ответа живёт в `github.ts`, и его
// проверяет свой прогон.

import type { Api } from './backend.ts'
import type { PollRaw, PrRef } from './github.ts'

/** Коммитов в ответе: панель рисует меньше, счётчик приходит отдельным полем. */
export const COMMITS_PAGE = 20

/**
 * Тредов за запрос. Потолок GraphQL на `first` - 100
 * (docs.github.com/graphql/overview/resource-limitations, сверено 25.09.2026);
 * пятьдесят взято ниже потолка, потому что запрос держит и коммиты, и
 * проверки, а на обработку у GitHub есть десять секунд.
 */
export const THREADS_PAGE = 50

/**
 * Страниц тредов за опрос. Очень длинное обсуждение обрывается, и это видно:
 * счётчик тредов приходит полем `totalCount` и остаётся верным, даже когда
 * прочитаны не все страницы.
 */
export const MAX_THREAD_PAGES = 5

/**
 * Что читается у треда. Фрагмент один для первой страницы и для добора:
 * иначе две формы разъезжаются молча, и добор приносит треды беднее.
 *
 * `subjectType` не запрашивается намеренно: тред уровня файла отличается от
 * треда на строке отсутствием строки, а лишнее поле - ещё один способ уронить
 * запрос целиком на старом Enterprise Server.
 *
 * `comments(first: 1)` и `tail: comments(last: 1)` - одно поле под двумя
 * псевдонимами: первый комментарий несёт замечание, последний - кто отвечал
 * последним, а `first` и `last` в одном обращении несовместимы.
 */
const THREAD_FIELDS = `
fragment threadFields on PullRequestReviewThread {
  id
  isResolved
  isOutdated
  path
  line
  originalLine
  comments(first: 1) {
    totalCount
    nodes { author { login } body url createdAt }
  }
  tail: comments(last: 1) {
    nodes { author { login } createdAt }
  }
}`

/**
 * Один опрос: состояние PR, объём, метки, ревьюеры, вердикт ревью, последние
 * ревью каждого, проверки головного коммита, коммиты и первая страница тредов.
 *
 * `head: commits(last: 1)` отдельным обращением, а не полем внутри
 * `commits(last: $commits)`: иначе `statusCheckRollup` запрашивался бы у
 * каждого коммита страницы, и узлов вышло бы в двадцать раз больше при том же
 * ответе. Последний узел `commits` - головной коммит ветки.
 *
 * `isRequired(pullRequestNumber:)` - главное, чего нет у GitLab: у GitHub
 * рядом с обязательными проверками ветки крутятся необязательные, и роллап
 * краснеет от любой из них. Без этого поля строка над вводом краснела бы на
 * опциональной джобе, которая мержу не мешает.
 */
export const PR_QUERY = `
query pr($owner: String!, $name: String!, $number: Int!, $commits: Int!, $threads: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      number
      title
      state
      isDraft
      mergeable
      mergeStateStatus
      reviewDecision
      additions
      deletions
      changedFiles
      url
      updatedAt
      headRefName
      baseRefName
      author { login }
      labels(first: 20) { nodes { name } }
      assignees(first: 10) { nodes { login } }
      reviewRequests(first: 20) {
        nodes {
          requestedReviewer {
            __typename
            ... on User { login }
            ... on Team { name }
          }
        }
      }
      latestReviews(first: 50) { nodes { state author { login } } }
      comments { totalCount }
      commits(last: $commits) {
        totalCount
        nodes { commit { oid abbreviatedOid messageHeadline author { name user { login } } } }
      }
      head: commits(last: 1) {
        nodes {
          commit {
            oid
            statusCheckRollup {
              state
              contexts(first: 50) {
                nodes {
                  __typename
                  ... on CheckRun {
                    name
                    status
                    conclusion
                    detailsUrl
                    isRequired(pullRequestNumber: $number)
                  }
                  ... on StatusContext {
                    context
                    state
                    targetUrl
                    isRequired(pullRequestNumber: $number)
                  }
                }
              }
            }
          }
        }
      }
      reviewThreads(first: $threads) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes { ...threadFields }
      }
    }
  }
}
${THREAD_FIELDS}`

/** Добор тредов: продолжение того же перечня с курсора. */
export const THREADS_QUERY = `
query threads($owner: String!, $name: String!, $number: Int!, $threads: Int!, $after: String!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: $threads, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { ...threadFields }
      }
    }
  }
}
${THREAD_FIELDS}`

/**
 * Открытый PR названной ветки. `headRefName` фильтрует по имени ветки-головы,
 * а не по «владелец:ветка» как одноимённый параметр REST, поэтому PR из форка
 * с той же ветки сюда тоже попадёт; сортировка по обновлению берёт свежий.
 */
export const BRANCH_QUERY = `
query branch($owner: String!, $name: String!, $branch: String!) {
  repository(owner: $owner, name: $name) {
    pullRequests(
      headRefName: $branch
      states: OPEN
      first: 1
      orderBy: { field: UPDATED_AT, direction: DESC }
    ) {
      nodes { number }
    }
  }
}`

const rec = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const prOf = (data: unknown) => rec(rec(rec(data).repository).pullRequest)

const pageOf = (threads: unknown) => {
  const info = rec(rec(threads).pageInfo)

  return {
    hasNext: info.hasNextPage === true,
    cursor: typeof info.endCursor === 'string' ? info.endCursor : '',
  }
}

/**
 * Один опрос PR, ответ как есть. `null` - GitHub не показал PR: его нет, он не
 * в этом репозитории, либо токену не хватает прав; различить нельзя (см. `Api`).
 */
export async function pollRaw(api: Api, ref: PrRef): Promise<PollRaw | null> {
  const data = await api.graphql(PR_QUERY, {
    owner: ref.owner,
    name: ref.repo,
    number: ref.number,
    commits: COMMITS_PAGE,
    threads: THREADS_PAGE,
  })

  if (data === null) return null

  const pr = prOf(data)

  // `repository` есть, `pullRequest` пуст: номер не тот. Отдельного признака
  // у GraphQL на это нет - приходит `null` без `errors`.
  if (Object.keys(pr).length === 0) return null

  const threadPages: unknown[] = [pr.reviewThreads]
  let page = pageOf(pr.reviewThreads)

  for (let taken = 1; taken < MAX_THREAD_PAGES && page.hasNext && page.cursor !== ''; taken += 1) {
    const more = await api.graphql(THREADS_QUERY, {
      owner: ref.owner,
      name: ref.repo,
      number: ref.number,
      threads: THREADS_PAGE,
      after: page.cursor,
    })

    if (more === null) break

    const next = prOf(more).reviewThreads

    threadPages.push(next)
    page = pageOf(next)
  }

  return { pr, threadPages }
}

/**
 * Номер открытого PR названной ветки, либо `null`, если его нет. Отказ доступа
 * от отсутствия PR тут тоже не отличить, и это тот же `null`: ветка без PR -
 * обычное состояние, а не повод рисовать ошибку.
 */
export async function prOfBranch(
  api: Api,
  input: { owner: string; repo: string; branch: string },
): Promise<number | null> {
  const data = await api.graphql(BRANCH_QUERY, {
    owner: input.owner,
    name: input.repo,
    branch: input.branch,
  })

  if (data === null) return null

  const nodes = rec(rec(rec(data).repository).pullRequests).nodes
  const first = Array.isArray(nodes) ? rec(nodes[0]).number : undefined

  return typeof first === 'number' ? first : null
}
